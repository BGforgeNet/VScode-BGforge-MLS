import { Position } from "vscode-languageserver-textdocument";
import * as language from "./language";
import { Language } from "./language";
import { MLSsettings } from "./settings";
import { getRequest as getSignatureRequest } from "./signature";

interface Languages extends Map<string, Language> {}

export interface Galactus {
    languages: Languages;
    workspaceRoot: string;
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

    constructor(workspaceRoot: string, settings: MLSsettings) {
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
    }

    completion(langId: string, uri: string) {
        const language = this.languages.get(langId);
        return language.completion(uri);
    }

    hover(langId: string, uri: string, symbol: string) {
        const language = this.languages.get(langId);
        return language.hover(uri, symbol);
    }

    definition(langId: string, uri: string, symbol: string) {
        const language = this.languages.get(langId);
        return language.definition(symbol);
    }

    signature(langId: string, text: string, position: Position) {
        const language = this.languages.get(langId);
        const request = getSignatureRequest(text, position);
        if (!request) {
            return;
        }
        return language.signature(request);
    }

    reloadFileData(uri: string, langId: string, text: string) {
        const language = this.languages.get(langId);
        if (language) {
            language.reloadFileData(uri, text);
        }
    }
}
