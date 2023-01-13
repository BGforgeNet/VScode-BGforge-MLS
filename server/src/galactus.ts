import { Position, Range } from "vscode-languageserver-textdocument";
import { conlog, getRelPath, isSubpath, uriToPath } from "./common";
import * as language from "./language";
import { Language } from "./language";
import { MLSsettings, ProjectTraSettings } from "./settings";
import { getRequest as getSignatureRequest } from "./signature";
import {
    Translation,
    isTraRef,
    languages as translationLanguages,
    translatableLanguages,
} from "./translation";
import * as translation from "./translation";
import * as inlay from "./inlay";

interface Languages extends Map<string, Language> {}

export interface Galactus {
    languages: Languages;
    workspaceRoot: string;
    translation: Translation;
}

interface LanguageItem {
    id: string;
    dataId?: string;
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
            parse_requires_game: false,
            signature: true,
            staticCompletion: true,
            staticHover: true,
            staticSignature: true,
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
            parse_requires_game: true,
            signature: false,
            staticCompletion: true,
            staticHover: true,
            staticSignature: false,
        },
    },
    {
        id: "weidu-baf-tpl",
        dataId: "weidu-baf",
        features: {
            completion: true,
            definition: false,
            hover: true,
            udf: false,
            headers: false,
            externalHeaders: false,
            parse: true,
            parse_requires_game: true,
            signature: false,
            staticCompletion: true,
            staticHover: true,
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
            parse_requires_game: true,
            signature: false,
            staticCompletion: true,
            staticHover: true,
            staticSignature: false,
        },
    },
    {
        id: "weidu-d-tpl",
        dataId: "weidu-d",
        features: {
            completion: true,
            definition: false,
            hover: true,
            udf: false,
            headers: false,
            externalHeaders: false,
            parse: true,
            parse_requires_game: true,
            signature: false,
            staticCompletion: true,
            staticHover: true,
            staticSignature: false,
        },
    },
    {
        id: "weidu-slb",
        dataId: "weidu-baf",
        features: {
            completion: true,
            definition: false,
            hover: true,
            udf: false,
            headers: false,
            externalHeaders: false,
            parse: false,
            parse_requires_game: false,
            signature: false,
            staticCompletion: true,
            staticHover: true,
            staticSignature: false,
        },
    },
    {
        id: "weidu-d-ssl",
        dataId: "weidu-baf",
        features: {
            completion: true,
            definition: false,
            hover: true,
            udf: false,
            headers: false,
            externalHeaders: false,
            parse: false,
            parse_requires_game: false,
            signature: false,
            staticCompletion: true,
            staticHover: true,
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
            parse_requires_game: false,
            signature: false,
            staticCompletion: true,
            staticHover: true,
            staticSignature: true,
        },
    },
    {
        id: "weidu-tp2-tpl",
        dataId: "weidu-tp2",
        features: {
            completion: true,
            definition: true,
            hover: true,
            udf: true,
            headers: true,
            externalHeaders: false,
            parse: true,
            parse_requires_game: false,
            signature: false,
            staticCompletion: true,
            staticHover: true,
            staticSignature: true,
        },
    },
];

export class Galactus {
    languages: Languages;
    workspaceRoot: string;
    translation: Translation;
    dataLangIds: Map<string, string>;

    public async init(
        workspaceRoot: string,
        settings: MLSsettings,
        traSettings: ProjectTraSettings
    ) {
        this.workspaceRoot = workspaceRoot;
        this.dataLangIds = new Map();

        const langs: Languages = new Map();
        for (const l of languages) {
            let language: Language;
            // the only language with external headers dir
            if (l.id == "fallout-ssl") {
                language = new Language(
                    l.id,
                    l.features,
                    workspaceRoot,
                    l.id,
                    settings.falloutSSL.headersDirectory
                );
            } else {
                language = new Language(l.id, l.features, workspaceRoot);
            }
            await language.init();
            langs.set(l.id, language);

            if (l.dataId) {
                this.dataLangIds.set(l.id, l.dataId);
            } else {
                this.dataLangIds.set(l.id, l.id);
            }
        }
        this.languages = langs;
        this.translation = new Translation(traSettings);
    }

    /** data langa id */
    dataLang(langId: string) {
        return this.dataLangIds.get(langId);
    }

    completion(langId: string, uri: string) {
        langId = this.dataLang(langId);
        if (!langId) {
            return;
        }
        const language = this.languages.get(langId);
        if (language) {
            return language.completion(uri);
        }
    }

    hover(langId: string, uri: string, symbol: string, text: string) {
        langId = this.dataLang(langId);
        if (!langId) {
            return;
        }

        // check for translation first
        if (isTraRef(symbol, langId) && translatableLanguages.includes(langId)) {
            const filePath = uriToPath(uri);
            const relPath = getRelPath(this.workspaceRoot, filePath);
            const result = this.translation.hover(symbol, text, relPath, langId);
            return result;
        }

        // no translation, now check real languages
        const language = this.languages.get(langId);
        if (language) {
            return language.hover(uri, symbol);
        }
    }

    definition(langId: string, symbol: string) {
        langId = this.dataLang(langId);
        if (!langId) {
            return;
        }
        const language = this.languages.get(langId);
        if (language) {
            return language.definition(symbol);
        }
    }

    signature(langId: string, text: string, position: Position) {
        langId = this.dataLang(langId);
        const language = this.languages.get(langId);
        if (!language) {
            return;
        }
        const request = getSignatureRequest(text, position);
        if (!request) {
            return;
        }
        return language.signature(request);
    }

    reloadFileData(uri: string, langId: string, text: string) {
        conlog("reload filedata " + uri);
        // reload translation
        if (translationLanguages.includes(langId)) {
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
        const filePath = uriToPath(uri);
        const traFileKey = this.translation.traFileKey(filePath, text, langId);
        if (!traFileKey) {
            return;
        }

        const traEntries = this.translation.entries(traFileKey);
        const traExt = translation.getTraExt(langId);
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
