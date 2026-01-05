/**
 * Language data loader.
 *
 * Utility class used by LanguageProvider implementations.
 * Handles loading and caching of language feature data:
 * - Static data from JSON files (completion, hover, signature)
 * - Dynamic data from workspace headers (procedures, macros, definitions)
 *
 * Each provider owns its own Language instance and delegates data operations to it.
 * Server.ts never interacts with Language directly - only through providers.
 */

import { conlog, getRelPath, isDirectory, isSubpath, uriToPath } from "./common";
import * as completion from "./shared/completion";
import * as definition from "./shared/definition";
import * as fallout from "./fallout-ssl/fallout";
import * as hover from "./shared/hover";
import { LANG_FALLOUT_SSL, LANG_WEIDU_TP2, LANG_WEIDU_TP2_TPL } from "./core/languages";
import {
    createEmptyListData,
    createEmptyMapData,
    getListItems,
    lookupMapItem,
    reloadList,
    reloadMap,
} from "./shared/feature-data";
import * as signature from "./shared/signature";
import * as weidu from "./weidu";

export interface Features {
    completion: boolean;
    definition: boolean;
    hover: boolean;

    udf: boolean; // are there any user-defined functions, macros, or anything else
    headers: boolean; // do we parse headers for data?
    externalHeaders?: boolean; // can we add an external header directory?

    // inlay: boolean;
    parse: boolean;
    parseRequiresGame: boolean;
    signature: boolean;

    // these are loaded from server/out/*.json
    staticCompletion: boolean;
    staticHover: boolean;
    staticSignature: boolean;
}

/** Generic processed data from headers */
export interface HeaderData {
    completion: completion.CompletionListEx;
    hover: hover.HoverMapEx;
    definition: definition.Data;
    signature?: signature.SigMap;
}

interface Data {
    completion: completion.Data;
    definition: definition.Data;
    hover: hover.Data;
    // inlay: boolean;
    signature: signature.Data;
}

export interface Language {
    id: string;
    dataId: string; // search completions and hover from this language id
    features: Features;
    data: Data;
    externalHeadersDirectory: string;
}

export class Language implements Language {
    id: string;
    features: Features;
    /** Initialized in init() - callers must await init() before using this class */
    data!: Data;
    workspaceRoot: string;
    externalHeadersDirectory: string;

    constructor(
        id: string,
        features: Features,
        workspaceRoot: string,
        externalHeadersDirectory = ""
    ) {
        this.id = id;
        this.features = features;
        this.externalHeadersDirectory = externalHeadersDirectory;
        this.workspaceRoot = workspaceRoot;
    }

    public async init() {
        this.data = await this.loadData();
    }

    private loadStaticCompletion(): completion.CompletionList {
        if (this.features.staticCompletion) {
            return completion.loadStatic(this.id);
        }
        return [];
    }

    private loadStaticHover(): hover.HoverMap {
        if (this.features.staticHover) {
            return hover.loadStatic(this.id);
        }
        return new Map();
    }

    private loadStaticSignature(): signature.SigMap {
        if (this.features.staticSignature) {
            return signature.loadStatic(this.id);
        }
        return new Map();
    }

    private async loadHeaders(staticHover: hover.HoverMap = new Map()) {
        // Runtime guard: server.ts declares workspaceRoot as string but only conditionally
        // assigns it. If no workspace folders exist, it remains undefined at runtime.
        if (this.workspaceRoot === undefined) {
            return;
        }
        if (this.id == LANG_FALLOUT_SSL) {
            const res = await fallout.loadHeaders(this.workspaceRoot, false, staticHover);
            return res;
        }
        if (this.id == LANG_WEIDU_TP2) {
            const res = weidu.loadHeaders(this.workspaceRoot);
            return res;
        }
        conlog(`Unknown language id ${this.id}, can't load headers.`);
        return undefined;
    }

    private async loadExternalHeaders(staticHover: hover.HoverMap = new Map()) {
        conlog(`Loading external headers for ${this.id}`);
        try {
            if (!isDirectory(this.externalHeadersDirectory)) {
                conlog(
                    `${this.externalHeadersDirectory} is not a directory, skipping external headers.`
                );
                return;
            }
        } catch {
            conlog(`lstat ${this.externalHeadersDirectory} failed, aborting.`);
            return;
        }
        if (isSubpath(this.workspaceRoot, this.externalHeadersDirectory)) {
            conlog(
                `Real ${this.externalHeadersDirectory} is a subdirectory of workspace ${this.workspaceRoot}, aborting.`
            );
            return;
        }

        if (this.id == LANG_FALLOUT_SSL) {
            const res = await fallout.loadHeaders(this.externalHeadersDirectory, true, staticHover);
            return res;
        }
        conlog(`Unknown language id ${this.id}, can't load external headers.`);
        return undefined;
    }

    private async loadData() {
        const completionData: completion.Data = createEmptyListData();
        const hoverData: hover.Data = createEmptyMapData();
        const definitionData: definition.Data = new Map();
        const signatureData: signature.Data = createEmptyMapData();

        completionData.static = this.loadStaticCompletion();
        hoverData.static = this.loadStaticHover();
        signatureData.static = this.loadStaticSignature();

        const data: Data = {
            completion: completionData,
            hover: hoverData,
            definition: definitionData,
            signature: signatureData,
        };

        if (this.features.headers) {
            let headerData: HeaderData | undefined;
            // hack: skip sfall macro dupes from headers
            if (this.id == LANG_FALLOUT_SSL) {
                headerData = await this.loadHeaders(data.hover.static);
            } else {
                headerData = await this.loadHeaders();
            }
            if (headerData) {
                data.completion.headers = headerData.completion;
                data.hover.headers = headerData.hover;
                data.definition = headerData.definition;
                if (headerData.signature) {
                    data.signature.headers = headerData.signature;
                }
            }

            if (this.features.externalHeaders && this.externalHeadersDirectory != "") {
                // Initialize extHeaders so reload doesn't need defensive checks
                data.completion.extHeaders = [];
                data.hover.extHeaders = new Map();
                data.signature.extHeaders = new Map();

                let externalHeaderData: HeaderData | undefined;
                // hack: skip sfall macro dupes from headers
                if (this.id == LANG_FALLOUT_SSL) {
                    externalHeaderData = await this.loadExternalHeaders(data.hover.static);
                } else {
                    externalHeaderData = await this.loadExternalHeaders();
                }
                if (externalHeaderData) {
                    data.completion.extHeaders = externalHeaderData.completion;
                    data.hover.extHeaders = externalHeaderData.hover;
                    data.definition = new Map([
                        ...data.definition,
                        ...externalHeaderData.definition,
                    ]);
                    if (externalHeaderData.signature) {
                        data.signature.extHeaders = externalHeaderData.signature;
                    }
                }
            }
        }

        return data;
    }

    private inWorkspace(uri: string) {
        const realPath = uriToPath(uri);
        if (isSubpath(this.workspaceRoot, realPath)) {
            return true;
        }
        return false;
    }

    /**
     * For displaying in hovers and such.
     * If in workspace, path is relative to workspace root.
     * Else, it's absolute.
     */
    private displayPath(uri: string) {
        const absPath = uriToPath(uri);
        if (this.inWorkspace(uri)) {
            return getRelPath(this.workspaceRoot, absPath);
        }
        return absPath;
    }

    private isHeader(uri: string) {
        if (this.id == LANG_FALLOUT_SSL && uri.endsWith(".h")) {
            return true;
        }
        if (this.id == LANG_WEIDU_TP2 && uri.endsWith(".tph")) {
            return true;
        }
        return false;
    }

    private inExternalHeadersDirectory(uri: string) {
        if (!this.features.externalHeaders) {
            return false;
        }
        if (this.externalHeadersDirectory == "") {
            return false;
        }
        const realPath = uriToPath(uri);
        if (isSubpath(this.externalHeadersDirectory, realPath)) {
            return true;
        }
        return false;
    }

    private reloadFileCompletion(
        oldCompletion: completion.CompletionListEx,
        fileCompletion: completion.CompletionListEx,
        uri: string
    ) {
        return reloadList(oldCompletion, fileCompletion, uri, this.data.hover.static, (item) => item.label);
    }

    private reloadFileHover(oldHover: hover.HoverMapEx, fileHover: hover.HoverMapEx, uri: string) {
        return reloadMap(oldHover, fileHover, uri, this.data.hover.static);
    }

    private reloadFileDefinition(
        oldDefinition: definition.Data,
        fileDefinition: definition.Data,
        uri: string
    ) {
        // Definition doesn't de-duplicate against static, just merges by URI
        const filtered = new Map(
            Array.from(oldDefinition).filter(([, value]) => value.uri !== uri)
        );
        return new Map([...filtered, ...fileDefinition]);
    }

    private reloadFileSignature(
        oldSignature: signature.SigMap,
        fileSignature: signature.SigMap,
        uri: string
    ) {
        return reloadMap(oldSignature, fileSignature, uri, this.data.hover.static);
    }

    reloadFileData(uri: string, text: string) {
        let fileData: HeaderData;
        const filePath = this.displayPath(uri);

        if (!this.features.udf) {
            return;
        }

        switch (this.id) {
            case LANG_FALLOUT_SSL:
                fileData = fallout.loadFileData(uri, text, filePath);
                break;
            case LANG_WEIDU_TP2:
            case LANG_WEIDU_TP2_TPL:
                fileData = weidu.loadFileData(uri, text, filePath);
                break;
            default:
                conlog(`Language ${this.id} doesn't support reload.`);
                return;
        }

        if (this.isHeader(uri)) {
            if (this.inWorkspace(uri)) {
                this.data.completion.headers = this.reloadFileCompletion(
                    this.data.completion.headers,
                    fileData.completion,
                    uri
                );
                this.data.hover.headers = this.reloadFileHover(
                    this.data.hover.headers,
                    fileData.hover,
                    uri
                );

                if (this.features.signature && fileData.signature) {
                    const newSignature = this.reloadFileSignature(
                        this.data.signature.headers,
                        fileData.signature,
                        uri
                    );
                    this.data.signature.self.set(uri, newSignature);
                }
            } else if (this.inExternalHeadersDirectory(uri)) {
                // extHeaders is guaranteed to be initialized in loadData() when
                // externalHeaders feature is enabled (which inExternalHeadersDirectory checks)
                this.data.completion.extHeaders = this.reloadFileCompletion(
                    this.data.completion.extHeaders!,
                    fileData.completion,
                    uri
                );
                this.data.hover.extHeaders = this.reloadFileHover(
                    this.data.hover.extHeaders!,
                    fileData.hover,
                    uri
                );

                if (this.features.signature && fileData.signature) {
                    const newSignature = this.reloadFileSignature(
                        this.data.signature.extHeaders!,
                        fileData.signature,
                        uri
                    );
                    this.data.signature.self.set(uri, newSignature);
                }
            }
        } else {
            this.data.completion.self.set(uri, fileData.completion);
            this.data.hover.self.set(uri, fileData.hover);
            if (this.features.signature && fileData.signature) {
                this.data.signature.self.set(uri, fileData.signature);
            }
        }

        if (this.features.definition) {
            this.data.definition = this.reloadFileDefinition(
                this.data.definition,
                fileData.definition,
                uri
            );
        }
    }

    completion(uri: string) {
        if (!this.features.completion) {
            return;
        }
        return getListItems(this.data.completion, uri);
    }

    hover(uri: string, symbol: string) {
        if (!this.features.hover) {
            return;
        }
        return lookupMapItem(this.data.hover, uri, symbol);
    }

    definition(symbol: string) {
        if (!this.features.definition) {
            return undefined;
        }
        const result = this.data.definition.get(symbol);
        if (result) {
            return result;
        }
        return undefined;
    }

    signature(uri: string, request: signature.Request) {
        if (!this.features.signature) {
            return;
        }

        const staticSig = this.data.signature.static.get(request.symbol);
        if (staticSig !== undefined) {
            return signature.getResponse(staticSig, request.parameter);
        }

        const selfMap = this.data.signature.self.get(uri);
        if (selfMap !== undefined) {
            const sig = selfMap.get(request.symbol);
            if (sig !== undefined) {
                return signature.getResponse(sig, request.parameter);
            }
        }

        const headerSig = this.data.signature.headers.get(request.symbol);
        if (headerSig !== undefined) {
            return signature.getResponse(headerSig, request.parameter);
        }

        if (this.data.signature.extHeaders !== undefined) {
            const sig = this.data.signature.extHeaders.get(request.symbol);
            if (sig !== undefined) {
                return signature.getResponse(sig, request.parameter);
            }
        }
        return undefined;
    }
}
