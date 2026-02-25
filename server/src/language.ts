import { Hover } from "vscode-languageserver/node";
import { conlog, getRelPath, isDirectory, isSubpath, uriToPath } from "./common";
import * as completion from "./completion";
import * as definition from "./definition";
import * as fallout from "./fallout";
import * as hover from "./hover";
import * as signature from "./signature";
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
    // @ts-expect-error: ts2564 because we init the instance with async init() method explicitly.
    data: Data;
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
        if (this.workspaceRoot === undefined) {
            return;
        }
        if (this.id == "fallout-ssl") {
            const res = await fallout.loadHeaders(this.workspaceRoot, false, staticHover);
            return res;
        }
        if (this.id == "weidu-tp2") {
            const res = weidu.loadHeaders(this.workspaceRoot);
            return res;
        }
        conlog(`Unknown language id ${this.id}, can't load headers.`);
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

        if (this.id == "fallout-ssl") {
            const res = await fallout.loadHeaders(this.externalHeadersDirectory, true, staticHover);
            return res;
        }
        conlog(`Unknown language id ${this.id}, can't load external headers.`);
    }

    private async loadData() {
        const completionData: completion.Data = { self: new Map(), headers: [], static: [] };
        const hoverData: hover.Data = { self: new Map(), headers: new Map(), static: new Map() };
        const definitionData: definition.Data = new Map();
        const signatureData: signature.Data = {
            self: new Map(),
            headers: new Map(),
            static: new Map(),
        };

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
            if (this.id == "fallout-ssl") {
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
                let externalHeaderData: HeaderData | undefined;
                // hack: skip sfall macro dupes from headers
                if (this.id == "fallout-ssl") {
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
        if (this.id == "fallout-ssl" && uri.endsWith(".h")) {
            return true;
        }
        if (this.id == "weidu-tp2" && uri.endsWith(".tph")) {
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
        let newCompletion = oldCompletion.filter((item) => item.uri != uri);
        fileCompletion = fileCompletion.filter((item) => !this.data.hover.static.has(item.label));
        newCompletion = [...newCompletion, ...fileCompletion];
        return newCompletion;
    }

    private reloadFileHover(oldHover: hover.HoverMapEx, fileHover: hover.HoverMapEx, uri: string) {
        let newHover = new Map(
            // eslint-disable-next-line no-unused-vars
            Array.from(oldHover).filter(([key, value]) => {
                if (value.uri != uri) {
                    return true;
                }
                return false;
            })
        );
        fileHover = new Map(
            // eslint-disable-next-line no-unused-vars
            Array.from(fileHover).filter(([key, value]) => {
                return !this.data.hover.static.has(key);
            })
        );
        newHover = new Map([...newHover, ...fileHover]);
        return newHover;
    }

    private reloadFileDefinition(
        oldDefinition: definition.Data,
        fileDefinition: definition.Data,
        uri: string
    ) {
        let newDefinition = new Map(
            // eslint-disable-next-line no-unused-vars
            Array.from(oldDefinition).filter(([key, value]) => {
                if (value.uri != uri) {
                    return true;
                }
                return false;
            })
        );
        newDefinition = new Map([...newDefinition, ...fileDefinition]);
        return newDefinition;
    }

    private reloadFileSignature(
        oldSignature: signature.SigMap,
        fileSignature: signature.SigMap,
        uri: string
    ) {
        let newSignature = new Map(
            // eslint-disable-next-line no-unused-vars
            Array.from(oldSignature).filter(([key, value]) => {
                if (value.uri != uri) {
                    return true;
                }
                return false;
            })
        );
        fileSignature = new Map(
            // eslint-disable-next-line no-unused-vars
            Array.from(fileSignature).filter(([key, value]) => {
                return !this.data.hover.static.has(key);
            })
        );
        newSignature = new Map([...newSignature, ...fileSignature]);
        return newSignature;
    }

    reloadFileData(uri: string, text: string) {
        let fileData: HeaderData;
        const filePath = this.displayPath(uri);

        if (!this.features.udf) {
            return;
        }

        switch (this.id) {
            case "fallout-ssl":
                fileData = fallout.loadFileData(uri, text, filePath);
                break;
            case "weidu-tp2":
            case "weidu-tp2-tpl":
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
                // make tslint happy
                if (!this.data.completion.extHeaders) {
                    this.data.completion.extHeaders = [];
                }
                this.data.completion.extHeaders = this.reloadFileCompletion(
                    this.data.completion.extHeaders,
                    fileData.completion,
                    uri
                );
                // make tslint happy
                if (!this.data.hover.extHeaders) {
                    this.data.hover.extHeaders = new Map();
                }
                this.data.hover.extHeaders = this.reloadFileHover(
                    this.data.hover.extHeaders,
                    fileData.hover,
                    uri
                );

                if (this.features.signature && fileData.signature) {
                    if (!this.data.signature.extHeaders) {
                        this.data.signature.extHeaders = new Map();
                    }
                    const newSignature = this.reloadFileSignature(
                        this.data.signature.extHeaders,
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
        let result: completion.CompletionList;
        result = this.data.completion.self.get(uri) || [];
        result = [...result, ...this.data.completion.static];
        if (this.data.completion.headers) {
            result = [...result, ...this.data.completion.headers];
        }
        if (this.data.completion.extHeaders) {
            result = [...result, ...this.data.completion.extHeaders];
        }
        return result;
    }

    hover(uri: string, symbol: string) {
        if (!this.features.hover) {
            return;
        }
        let result: Hover | hover.HoverEx | undefined;

        const selfMap = this.data.hover.self.get(uri);
        if (selfMap) {
            result = selfMap.get(symbol);
            if (result) {
                return result;
            }
        }

        result = this.data.hover.static.get(symbol);
        if (result) {
            return result;
        }

        result = this.data.hover.headers.get(symbol);
        if (result) {
            return result;
        }

        if (this.data.hover.extHeaders) {
            result = this.data.hover.extHeaders.get(symbol);
            if (result) {
                return result;
            }
        }
    }

    definition(symbol: string) {
        if (!this.features.definition) {
            return;
        }
        const result = this.data.definition.get(symbol);
        if (result) {
            return result;
        }
    }

    signature(uri: string, request: signature.Request) {
        if (!this.features.signature) {
            return;
        }

        if (this.data.signature.static) {
            const sig = this.data.signature.static.get(request.symbol);
            if (sig) {
                return signature.getResponse(sig, request.parameter);
            }
        }

        const selfMap = this.data.signature.self.get(uri);
        if (selfMap) {
            const sig = selfMap.get(request.symbol);
            if (sig) {
                return signature.getResponse(sig, request.parameter);
            }
        }

        if (this.data.signature.headers) {
            const sig = this.data.signature.headers.get(request.symbol);
            if (sig) {
                return signature.getResponse(sig, request.parameter);
            }
        }

        if (this.data.signature.extHeaders) {
            const sig = this.data.signature.extHeaders.get(request.symbol);
            if (sig) {
                return signature.getResponse(sig, request.parameter);
            }
        }
    }
}
