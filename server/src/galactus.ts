import { Position, Range } from "vscode-languageserver-textdocument";
import { getRelPath, isSubpath, uriToPath } from "./common";
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
    features: language.Features;
}
interface LanguageList extends Array<LanguageItem> {}
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
];

export class Galactus {
    languages: Languages;
    workspaceRoot: string;
    translation: Translation;

    constructor(workspaceRoot: string, settings: MLSsettings, traSettings: ProjectTraSettings) {
        this.workspaceRoot = workspaceRoot;

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
            langs.set(l.id, language);
        }
        this.languages = langs;
        this.translation = new Translation(traSettings);
    }

    completion(langId: string, uri: string) {
        const language = this.languages.get(langId);
        return language.completion(uri);
    }

    hover(langId: string, uri: string, symbol: string, text: string) {
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
        const language = this.languages.get(langId);
        if (language) {
            return language.definition(symbol);
        }
    }

    signature(langId: string, text: string, position: Position) {
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
