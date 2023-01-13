import * as hover from "./hover";
import * as completion from "./completion";
import * as definition from "./definition";
import * as signature from "./signature";
import { conlog, getRelPath, isDirectory, isSubpath, uriToPath } from "./common";
import { Hover } from "vscode-languageserver/node";
import * as fallout from "./fallout-ssl";

export interface Features {
    completion: boolean;
    definition: boolean;
    hover: boolean;

    udf: boolean; // are there any user-defined functions, macros, or anything else
    headers: boolean; // do we parse headers for data?
    externalHeaders?: boolean; // can we add an external header directory?

    // inlay: boolean;
    parse: boolean;
    parse_requires_game: boolean;
    signature: boolean;

    // these are loaded from server/out/*.json
    staticCompletion: boolean;
    staticHover: boolean;
    staticSignature: boolean;
}

interface Data {
    completion?: completion.Data;
    definition?: definition.Data;
    hover?: hover.Data;
    // inlay: boolean;
    signature?: signature.Data;
}

export interface Language {
    id: string;
    dataId: string; // copy completions and hover from this language id
    features: Features;
    data: Data;
    externalHeadersDirectory?: string;
}

export class Language implements Language {
    id: string;
    dataId: string;
    features: Features;
    data: Data;
    workspaceRoot: string;
    externalHeadersDirectory?: string;

    constructor(
        id: string,
        features: Features,
        workspaceRoot: string,
        dataId?: string,
        externalHeadersDirectory = ""
    ) {
        this.id = id;
        this.features = features;
        if (dataId) {
            this.dataId = dataId;
        } else {
            this.dataId = id;
        }
        this.externalHeadersDirectory = externalHeadersDirectory;
        this.workspaceRoot = workspaceRoot;

        this.data = this.loadData();
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

    private loadHeaders() {
        if (this.id == "fallout-ssl") {
            const res = fallout.loadHeaders(this.workspaceRoot);
            return res;
        }
        conlog(`Unknown language id ${this.id}, can't load headers.`);
    }

    private loadExternalHeaders() {
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
            const res = fallout.loadHeaders(this.externalHeadersDirectory, true);
            return res;
        }
        conlog(`Unknown language id ${this.id}, can't load external headers.`);
    }

    private loadData() {
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
        // TODO: support signatures from jsdoc
        signatureData.static = this.loadStaticSignature();

        const data: Data = {
            completion: completionData,
            hover: hoverData,
            definition: definitionData,
            signature: signatureData,
        };

        if (this.features.headers) {
            const headerData = this.loadHeaders();
            if (headerData) {
                data.completion.headers = headerData.completion;
                data.hover.headers = headerData.hover;
                data.definition = headerData.definition;
            }

            if (this.features.externalHeaders && this.externalHeadersDirectory != "") {
                const externalHeaderData = this.loadExternalHeaders();
                if (externalHeaderData) {
                    data.completion.extHeaders = externalHeaderData.completion;
                    data.hover.extHeaders = externalHeaderData.hover;
                    data.definition = new Map([
                        ...data.definition,
                        ...externalHeaderData.definition,
                    ]);
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
        newCompletion = [...newCompletion, ...fileCompletion];
        return newCompletion;
    }

    private reloadFileHover(oldHover: hover.HoverMapEx, fileHover: hover.HoverMapEx, uri: string) {
        let newHover = new Map(
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            Array.from(oldHover).filter(([key, value]) => {
                if (value.uri != uri) {
                    return true;
                }
                return false;
            })
        );
        newHover = new Map([...newHover, ...fileHover]);
        return newHover;
    }

    reloadFileData(uri: string, text: string) {
        let fileData: {
            hover: hover.HoverMapEx;
            completion: completion.CompletionListEx;
            definition: definition.Data;
            signature?: signature.Data;
        };
        const filePath = this.displayPath(uri);

        if (!this.features.udf) {
            return;
        }

        switch (this.id) {
            case "fallout-ssl":
                fileData = fallout.loadFileData(uri, text, filePath);
                break;
            default:
                conlog(`Error: language ${this.id} doesn't support reload.`);
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
            } else if (this.inExternalHeadersDirectory(uri)) {
                this.data.completion.extHeaders = this.reloadFileCompletion(
                    this.data.completion.extHeaders,
                    fileData.completion,
                    uri
                );
                this.data.hover.extHeaders = this.reloadFileHover(
                    this.data.hover.extHeaders,
                    fileData.hover,
                    uri
                );
            }
        } else {
            const oldCompletion = this.data.completion.self.get(uri) || [];
            const oldHover = this.data.hover.self.get(uri) || new Map();
            const newCompletion = this.reloadFileCompletion(
                oldCompletion,
                fileData.completion,
                uri
            );
            const newHover = this.reloadFileHover(oldHover, fileData.hover, uri);
            this.data.completion.self.set(uri, newCompletion);
            this.data.hover.self.set(uri, newHover);
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
        let result: Hover | hover.HoverEx;

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

    signature(request: signature.Request) {
        if (!this.features.signature) {
            return;
        }
        if (this.data.signature.static) {
            const sig = this.data.signature.static.get(request.symbol);
            if (sig) {
                return signature.getResponse(sig, request.parameter);
            }
        }
    }
}