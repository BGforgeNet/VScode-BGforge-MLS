import { Position, Range } from "vscode-languageserver-textdocument";
import { conlog, getRelPath, isSubpath, uriToPath } from "./common";
import * as inlay from "./inlay";
import * as language from "./language";
import { Language } from "./language";
import { MLSsettings, ProjectTraSettings } from "./settings";
import { getRequest as getSignatureRequest } from "./signature";
import * as translation from "./translation";
import {
    isTraRef,
    languages as translationLanguages,
    translatableLanguages,
    Translation,
} from "./translation";

interface Languages extends Map<string, Language> {}

export interface Galactus {
    languages: Languages;
    workspaceRoot: string;
    translation: Translation;
}

interface LanguageItem {
    id: string;
    dataFrom?: string;
    features: language.Features;
}
interface LanguageList extends Array<LanguageItem> {}

/** List of languages having any intellisense features */
const languages: LanguageList = [
    {
        id: "fallout-ssl",
        features: {
            completion: true,
            definition: true,
            hover: true,
            udf: true,
            headers: true,
            externalHeaders: true,
            parse: true,
            parseRequiresGame: false,
            signature: true,
            staticCompletion: true,
            staticHover: true,
            staticSignature: true,
        },
    },
    {
        id: "fallout-worldmap-txt",
        features: {
            completion: true,
            definition: false,
            hover: true,
            udf: false,
            headers: false,
            externalHeaders: false,
            parse: false,
            parseRequiresGame: false,
            signature: false,
            staticCompletion: true,
            staticHover: true,
            staticSignature: false,
        },
    },
    {
        id: "weidu-baf",
        features: {
            completion: true,
            definition: false,
            hover: true,
            udf: false,
            headers: false,
            externalHeaders: false,
            parse: true,
            parseRequiresGame: true,
            signature: false,
            staticCompletion: true,
            staticHover: true,
            staticSignature: false,
        },
    },
    {
        id: "weidu-baf-tpl",
        dataFrom: "weidu-baf",
        features: {
            completion: true,
            definition: false,
            hover: true,
            udf: false,
            headers: false,
            externalHeaders: false,
            parse: true,
            parseRequiresGame: true,
            signature: false,
            staticCompletion: false,
            staticHover: false,
            staticSignature: false,
        },
    },
    {
        id: "weidu-d",
        features: {
            completion: true,
            definition: false,
            hover: true,
            udf: false,
            headers: false,
            externalHeaders: false,
            parse: true,
            parseRequiresGame: true,
            signature: false,
            staticCompletion: true,
            staticHover: true,
            staticSignature: false,
        },
    },
    {
        id: "weidu-d-tpl",
        dataFrom: "weidu-d",
        features: {
            completion: true,
            definition: false,
            hover: true,
            udf: false,
            headers: false,
            externalHeaders: false,
            parse: true,
            parseRequiresGame: true,
            signature: false,
            staticCompletion: false,
            staticHover: false,
            staticSignature: false,
        },
    },
    {
        id: "weidu-slb",
        dataFrom: "weidu-baf",
        features: {
            completion: true,
            definition: false,
            hover: true,
            udf: false,
            headers: false,
            externalHeaders: false,
            parse: false,
            parseRequiresGame: false,
            signature: false,
            staticCompletion: false,
            staticHover: false,
            staticSignature: false,
        },
    },
    {
        id: "weidu-ssl",
        dataFrom: "weidu-baf",
        features: {
            completion: true,
            definition: false,
            hover: true,
            udf: false,
            headers: false,
            externalHeaders: false,
            parse: false,
            parseRequiresGame: false,
            signature: false,
            staticCompletion: false,
            staticHover: false,
            staticSignature: false,
        },
    },
    {
        id: "weidu-tp2",
        features: {
            completion: true,
            definition: true,
            hover: true,
            udf: true,
            headers: true,
            externalHeaders: false,
            parse: true,
            parseRequiresGame: false,
            signature: false,
            staticCompletion: true,
            staticHover: true,
            staticSignature: false,
        },
    },
    {
        id: "weidu-tp2-tpl",
        dataFrom: "weidu-tp2",
        features: {
            completion: true,
            definition: true,
            hover: true,
            udf: true,
            headers: false,
            externalHeaders: false,
            parse: true,
            parseRequiresGame: false,
            signature: false,
            staticCompletion: false,
            staticHover: false,
            staticSignature: false,
        },
    },
];

export class Galactus {
    // @ts-expect-error: ts2564 because we init the instance with async init() method explicitly.
    languages: Languages;
    // @ts-expect-error: ts2564 because we init the instance with async init() method explicitly.
    workspaceRoot: string;
    // @ts-expect-error: ts2564 because we init the instance with async init() method explicitly.
    translation: Translation;
    // @ts-expect-error: ts2564 because we init the instance with async init() method explicitly.
    dataFrom: Map<string, string>;

    public async init(
        workspaceRoot: string,
        settings: MLSsettings,
        traSettings: ProjectTraSettings
    ) {
        this.workspaceRoot = workspaceRoot;
        this.dataFrom = new Map();

        const langs: Languages = new Map();
        for (const l of languages) {
            let language: Language;
            // the only language with external headers dir
            if (l.id == "fallout-ssl") {
                language = new Language(
                    l.id,
                    l.features,
                    workspaceRoot,
                    settings.falloutSSL.headersDirectory
                );
            } else {
                language = new Language(l.id, l.features, workspaceRoot);
            }
            await language.init();
            langs.set(l.id, language);

            if (l.dataFrom) {
                this.dataFrom.set(l.id, l.dataFrom);
            }
        }
        this.languages = langs;
        this.translation = new Translation(traSettings);
        this.translation.init();
    }

    /** Several languages draw data from other language ids */
    dataLang(langId: string) {
        const result = this.dataFrom.get(langId);
        if (result) {
            return result;
        }
        return langId;
    }

    completion(langId: string, uri: string) {
        langId = this.dataLang(langId);
        const language = this.languages.get(langId);
        if (language) {
            return language.completion(uri);
        }
    }

    hover(langId: string, uri: string, symbol: string, text: string) {
        langId = this.dataLang(langId);
        // check for translation first
        if (
            this.translation.initialized &&
            translatableLanguages.includes(langId) &&
            isTraRef(symbol, langId)
        ) {
            const filePath = uriToPath(uri);
            if (isSubpath(this.workspaceRoot, filePath)) {
                const relPath = getRelPath(this.workspaceRoot, filePath);
                const result = this.translation.hover(symbol, text, relPath, langId);
                return result;
            }
        }

        // no translation, now check real languages
        const language = this.languages.get(langId);
        if (language) {
            return language.hover(uri, symbol);
        }
    }

    definition(langId: string, symbol: string) {
        langId = this.dataLang(langId);
        const language = this.languages.get(langId);
        if (language) {
            return language.definition(symbol);
        }
    }

    signature(langId: string, text: string, position: Position, uri: string) {
        langId = this.dataLang(langId);
        const language = this.languages.get(langId);
        if (!language) {
            return;
        }
        const request = getSignatureRequest(text, position);
        if (!request) {
            return;
        }
        return language.signature(uri, request);
    }

    reloadFileData(uri: string, langId: string, text: string) {
        conlog("reload filedata " + uri);
        // reload translation
        if (this.translation.initialized && translationLanguages.includes(langId)) {
            const wsPath = this.workspacePath(uri);
            if (wsPath) {
                this.translation.reloadFileLines(wsPath, text);
            }
        }

        // reload proper language
        const language = this.languages.get(langId);
        if (language) {
            language.reloadFileData(uri, text);
        }
    }
    inlay(uri: string, langId: string, text: string, range: Range) {
        if (!this.translation.initialized) {
            return;
        }
        const filePath = uriToPath(uri);
        const traFileKey = this.translation.traFileKey(filePath, text, langId);
        if (!traFileKey) {
            return;
        }

        const traEntries = this.translation.entries(traFileKey);
        if (!traEntries) {
            return;
        }
        const traExt = translation.getTraExt(langId);
        if (!traExt) {
            return;
        }
        const hints = inlay.getHints(traFileKey, traEntries, traExt, text, range);
        return hints;
    }

    /** workspace relative path */
    workspacePath(uri: string) {
        const absPath = uriToPath(uri);
        if (isSubpath(this.workspaceRoot, absPath)) {
            return getRelPath(this.workspaceRoot, absPath);
        }
    }
}
