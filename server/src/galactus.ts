import { Position, Range } from "vscode-languageserver-textdocument";
import { conlog, getRelPath, isSubpath, uriToPath } from "./common";
import * as inlay from "./inlay";
import * as language from "./language";
import { Language } from "./language";
import {
    LANG_FALLOUT_SSL,
    LANG_FALLOUT_WORLDMAP_TXT,
    LANG_WEIDU_BAF,
    LANG_WEIDU_D,
    LANG_WEIDU_D_TPL,
    LANG_WEIDU_SLB,
    LANG_WEIDU_SSL,
    LANG_WEIDU_TP2,
    LANG_WEIDU_TP2_TPL,
} from "./core/languages";
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
        id: LANG_FALLOUT_SSL,
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
        id: LANG_FALLOUT_WORLDMAP_TXT,
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
        id: LANG_WEIDU_BAF,
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
        id: LANG_WEIDU_D,
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
        id: LANG_WEIDU_D_TPL,
        dataFrom: LANG_WEIDU_D,
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
        id: LANG_WEIDU_SLB,
        dataFrom: LANG_WEIDU_BAF,
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
        id: LANG_WEIDU_SSL,
        dataFrom: LANG_WEIDU_BAF,
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
        id: LANG_WEIDU_TP2,
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
        id: LANG_WEIDU_TP2_TPL,
        dataFrom: LANG_WEIDU_TP2,
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
            if (l.id == LANG_FALLOUT_SSL) {
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
        await this.translation.init();
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
        if (language !== undefined) {
            return language.completion(uri);
        }
        return undefined;
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
        if (language !== undefined) {
            return language.hover(uri, symbol);
        }
        return undefined;
    }

    definition(langId: string, symbol: string) {
        langId = this.dataLang(langId);
        const language = this.languages.get(langId);
        if (language !== undefined) {
            return language.definition(symbol);
        }
        return undefined;
    }

    signature(langId: string, text: string, position: Position, uri: string) {
        langId = this.dataLang(langId);
        const language = this.languages.get(langId);
        if (language === undefined) {
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
        if (language !== undefined) {
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
        return undefined;
    }

    /** Get message texts for a fallout-ssl file */
    getMessages(uri: string, text: string): Record<string, string> {
        const messages: Record<string, string> = {};
        if (!this.translation.initialized) {
            return messages;
        }
        const filePath = uriToPath(uri);
        const traFileKey = this.translation.traFileKey(filePath, text, LANG_FALLOUT_SSL);
        if (!traFileKey) {
            return messages;
        }
        const traEntries = this.translation.entries(traFileKey);
        if (!traEntries) {
            return messages;
        }
        for (const [id, entry] of traEntries) {
            messages[id] = entry.source;
        }
        return messages;
    }
}
