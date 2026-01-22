/**
 * WeiDU language utilities.
 * Handles compilation via WeiDU executable and header parsing for TP2 macros/functions.
 */

import * as cp from "child_process";
import * as fs from "fs";
import * as path from "path";
import { CompletionItemKind, MarkupKind } from "vscode-languageserver/node";
import {
    conlog,
    findFiles,
    ParseItemList,
    ParseResult,
    pathToUri,
    sendParseResult,
    tmpDir,
    uriToPath,
} from "./common";
import * as completion from "./shared/completion";
import * as definition from "./shared/definition";
import * as hover from "./shared/hover";
import { HeaderData as LanguageHeaderData } from "./data-loader";
import * as pool from "./shared/pool";
import { getConnection } from "./lsp-connection";
import { WeiDUsettings } from "./settings";
import { LANG_WEIDU_TP2_TOOLTIP } from "./core/languages";
import { parseHeader, parseHeaderVariables, FunctionInfo, VariableInfo, updateFileIndex, updateVariableIndex } from "./weidu-tp2/header-parser";

const valid_extensions = new Map([
    [".tp2", "tp2"],
    [".tph", "tpa"],
    [".tpa", "tpa"],
    [".tpp", "tpp"],
    [".d", "d"],
    [".baf", "baf"],
]);

/** Header data extracted from a TP2 file. */
interface WeiduHeaderData {
    functions: FunctionInfo[];
    variables: VariableInfo[];
}

/** `text` looks like this
 *
 * `[ua.tp2]  ERROR at line 30 column 1-63` */
function parseWeiduOutput(text: string) {
    const errorsRegex = /\[(\S+)\]\s+(?:PARSE\s+)?ERROR at line (\d+) column (\d+)-(\d+)/g;
    const errors: ParseItemList = [];
    const warnings: ParseItemList = [];

    try {
        let match = errorsRegex.exec(text);
        while (match != null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (match.index === errorsRegex.lastIndex) {
                errorsRegex.lastIndex++;
            }
            const matchUri = match[1];
            const matchLine = match[2];
            const matchColStart = match[3];
            const matchColEnd = match[4];
            if (!matchUri || !matchLine || !matchColStart || !matchColEnd) continue;
            errors.push({
                uri: pathToUri(matchUri),
                line: parseInt(matchLine),
                columnStart: parseInt(matchColStart) - 1, // weidu uses 1-index, while vscode 0 index?
                columnEnd: parseInt(matchColEnd),
                message: text,
            });
            match = errorsRegex.exec(text);
        }
    } catch (err) {
        conlog(err);
    }
    const result: ParseResult = { errors: errors, warnings: warnings };
    return result;
}

function parseGccOutput(text: string) {
    const errorsRegex = /((\S+)\.tpl):(\d+):(\d+): error:.*/g;
    const errors: ParseItemList = [];
    const warnings: ParseItemList = [];

    try {
        let match = errorsRegex.exec(text);
        while (match != null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (match.index === errorsRegex.lastIndex) {
                errorsRegex.lastIndex++;
            }
            const matchUri = match[1];
            const matchLine = match[3];
            const matchCol = match[4];
            if (!matchUri || !matchLine || !matchCol) continue;
            errors.push({
                uri: pathToUri(matchUri),
                line: parseInt(matchLine),
                columnStart: parseInt(matchCol) - 1,
                columnEnd: match[0].length,
                message: text,
            });
            match = errorsRegex.exec(text);
        }
    } catch (err) {
        conlog(err);
    }
    const result: ParseResult = { errors: errors, warnings: warnings };
    return result;
}

function sendDiagnostics(
    uri: string,
    output_text: string,
    tmpUri: string,
    format: "gcc" | "weidu" = "weidu"
) {
    let parseResult: ParseResult;
    if (format == "gcc") {
        parseResult = parseGccOutput(output_text);
    } else {
        parseResult = parseWeiduOutput(output_text);
    }
    sendParseResult(parseResult, uri, tmpUri);
}

export function compile(uri: string, settings: WeiDUsettings, interactive = false, text: string) {
    const gamePath = settings.gamePath;
    const weiduPath = settings.path;
    const filePath = uriToPath(uri);
    const cwdTo = tmpDir;
    const baseName = path.parse(filePath).base;
    let ext = path.parse(filePath).ext;
    ext = ext.toLowerCase();
    let tpl = false;
    let realName = baseName; // filename without .tpl
    if (ext == ".tpl") {
        tpl = true;
        realName = baseName.substring(0, baseName.length - 4);
        ext = path.parse(realName).ext;
    }

    /**
     * Preprocessed file.
     * Weidu used to have issues with non-baf extensions, ref https://github.com/WeiDUorg/weidu/issues/237
     */
    const tmpFile = path.join(tmpDir, `tmp${ext}`);
    const tmpUri = pathToUri(tmpFile);
    /** not preprocessed (template) */
    const tmpFileGcc = path.join(tmpDir, `tmp-gcc${ext}`);
    const tmpUriGcc = pathToUri(tmpFileGcc);

    let weiduArgs = "--no-exit-pause --noautoupdate --debug-assign --parse-check";
    if (gamePath == "") {
        // d and baf need game files
        weiduArgs = `--nogame ${weiduArgs}`;
    } else {
        weiduArgs = `--game ${gamePath} ${weiduArgs}`;
    }

    const weiduType = valid_extensions.get(ext);
    if (!weiduType) {
        // vscode loses open file if clicked on console or elsewhere
        conlog(
            "Not a WeiDU file (tp2, tph, tpa, tpp, d, baf, tpl) or template! Focus a WeiDU file to parse."
        );
        if (interactive) {
            getConnection().window.showInformationMessage("Focus a WeiDU file or template to parse!");
        }

        return;
    }

    if ((weiduType == "d" || weiduType == "baf") && gamePath == "") {
        conlog("Path to IE game is not specified in settings, can't parse D or BAF!");
        if (interactive) {
            getConnection().window.showWarningMessage(
                "Path to IE game is not specified in settings, can't parse D or BAF!"
            );
        }
        return;
    }

    // preprocess
    let preprocessFailed = false;
    if (tpl == true) {
        conlog(`preprocessing ${baseName}...`);

        fs.writeFileSync(tmpFileGcc, text);
        const gccArgs = [
            "-E",
            "-x",
            "c",
            "-P",
            "-Wundef",
            "-Werror",
            "-Wfatal-errors",
            "-o",
            `${tmpFile}`,
            `${tmpFileGcc}`,
        ];
        const result = cp.spawnSync("gcc", gccArgs, { cwd: cwdTo });
        conlog("stdout: " + result.stdout);
        if (result.stderr.length > 0) {
            conlog("stderr: " + result.stderr);
        }
        if (result.status != 0) {
            conlog("error: " + result.status);
            if (interactive) {
                getConnection().window.showErrorMessage(`Failed to preprocess ${baseName}!`);
            }
            sendDiagnostics(uri, result.stderr.toString(), tmpUriGcc, "gcc");
            preprocessFailed = true;
        } else {
            if (interactive) {
                getConnection().window.showInformationMessage(`Succesfully preprocessed ${baseName}.`);
            }
        }
    }
    if (preprocessFailed) {
        return;
    }

    // parse
    conlog(`parsing ${realName}...`);
    fs.writeFileSync(tmpFile, text);
    const weiduCmd = `${weiduPath} ${weiduArgs} ${weiduType} ${tmpFile} `;
    cp.exec(weiduCmd, { cwd: cwdTo }, (err, stdout: string, stderr: string) => {
        conlog("stdout: " + stdout);
        const parseResult = parseWeiduOutput(stdout); // dupe, yes
        conlog(parseResult);
        if (stderr) {
            conlog("Parse stderr: " + stderr);
        }
        if (
            (err && err.code != 0) ||
            parseResult.errors.length > 0 || // weidu doesn't always return non-zero on parse failure?
            parseResult.warnings.length > 0
        ) {
            if (err) {
                conlog("Parse  error: " + err.message);
            }
            conlog(parseResult);
            if (interactive) {
                getConnection().window.showErrorMessage(`Failed to parse ${realName}!`);
            }
            if (tpl == false) {
                sendDiagnostics(uri, stdout, tmpUri);
            }
        } else {
            if (interactive) {
                getConnection().window.showInformationMessage(`Succesfully parsed ${realName}.`);
            }
        }
    });
}

/** All TP2 file extensions to index for definitions. */
const TP2_EXTENSIONS = ["tph", "tpa", "tpp", "tp2"] as const;

/** Known types that link to ielib documentation. */
const KNOWN_TYPES = new Set(["array", "bool", "ids", "int", "list", "map", "resref", "string", "filename"]);

/** Base URL for type documentation. */
const IELIB_TYPES_URL = "https://ielib.bgforge.net/types/#";

/** Maximum length for parameter descriptions in hover table. */
const DESC_MAX_LENGTH = 80;

export async function loadHeaders(headersDirectory: string, headerExtension: string) {
    let completions: completion.CompletionListEx = [];
    const hovers: hover.HoverMapEx = new Map();
    const definitions: definition.Data = new Map();

    // Collect all TP2 files (tph, tpa, tpp, tp2)
    const headerFiles: string[] = [];
    for (const ext of TP2_EXTENSIONS) {
        headerFiles.push(...findFiles(headersDirectory, ext));
    }

    const { results, errors } = await pool.processHeaders(
        headerFiles,
        headersDirectory,
        loadFileData
    );

    if (errors.length > 0) {
        conlog(errors);
    }

    results.map((x) => {
        // Only include completions from header files (determined by headerExtension).
        // Other TP2 files (.tpa/.tpp/.tp2) define functions for their own use, not for sharing.
        // Filter by checking the uri property on each completion item.
        const headerCompletions = x.completion.filter((item) =>
            item.uri?.toLowerCase().endsWith(headerExtension)
        );
        completions = completions.concat(headerCompletions);

        // Hover and definition still work for all file types
        for (const [key, value] of x.hover) {
            hovers.set(key, value);
        }
        for (const [key, value] of x.definition) {
            definitions.set(key, value);
        }
    });

    const result: LanguageHeaderData = {
        completion: completions,
        hover: hovers,
        definition: definitions,
    };
    return result;
}

/**
 * Extract function/macro and variable definitions from TP2 text using tree-sitter.
 */
function findSymbols(text: string, uri: string): WeiduHeaderData {
    const functions = parseHeader(text, uri);
    const variables = parseHeaderVariables(text, uri);
    return { functions, variables };
}


/**
 * Load file data using tree-sitter parsing.
 * @param uri File URI
 * @param text File content
 * @param filePath Cosmetic only, relative path for display
 */
export function loadFileData(uri: string, text: string, filePath: string) {
    const symbols = findSymbols(text, uri);
    const { completions, hovers, definitions } = buildLanguageData(uri, symbols.functions, filePath);
    const variableData = buildVariableData(uri, symbols.variables, filePath);

    // Also update the function and variable indices for go-to-definition
    updateFileIndex(uri, text);
    updateVariableIndex(uri, text);

    // Merge variable data into completions/hovers/definitions
    const allCompletions = [...completions, ...variableData.completions];
    const allHovers = new Map([...hovers, ...variableData.hovers]);
    const allDefinitions = new Map([...definitions, ...variableData.definitions]);

    // Return all data - routing is handled by data-loader.ts:
    // - .tph files → completion.headers (shared across workspace)
    // - .tpa/.tpp/.tp2 files → completion.self (file-local only)
    const result: LanguageHeaderData = {
        hover: allHovers,
        completion: allCompletions,
        definition: allDefinitions,
    };
    return result;
}

/**
 * Build completion, hover, and definition data from parsed functions.
 *
 * Hover markdown example:
 *
 *     ┌─────────────────────────────────────────────────────────────────┐
 *     │ action function my_func                           ← 1. signature│
 *     ├─────────────────────────────────────────────────────────────────┤
 *     │ lib/utils.tph                                     ← 2. file path│
 *     ├─────────────────────────────────────────────────────────────────┤
 *     │ Does something useful with the given parameters.  ← 3. jsdoc    │
 *     ├─────────────────────────────────────────────────────────────────┤
 *     │        INT vars          Description        Default             │
 *     │ int    count             Number of items    0       ← 4. table  │
 *     │        STR vars                                                 │
 *     │ string name              The name to use                        │
 *     │        RET vars                                                 │
 *     │        result                                                   │
 *     │        RET arrays                                               │
 *     │        my_array                                                 │
 *     ├─────────────────────────────────────────────────────────────────┤
 *     │ Returns int                                       ← 5. @return  │
 *     ├─────────────────────────────────────────────────────────────────┤
 *     │ ⚠️ Deprecated: Use new_func instead              ← 6. @deprecated│
 *     └─────────────────────────────────────────────────────────────────┘
 *
 * Type column links to ielib.bgforge.net for known types.
 * Description column clipped to 80 chars.
 */
function buildLanguageData(uri: string, functions: FunctionInfo[], filePath: string) {
    const langId = LANG_WEIDU_TP2_TOOLTIP;
    const completions: completion.CompletionListEx = [];
    const hovers: hover.HoverMapEx = new Map();
    const definitions: definition.Data = new Map();

    for (const func of functions) {
        // Build JSDoc arg lookup map for type overrides
        const jsdocArgs = new Map<string, { type: string; description?: string }>();
        if (func.jsdoc?.args) {
            for (const arg of func.jsdoc.args) {
                jsdocArgs.set(arg.name, { type: arg.type, description: arg.description });
            }
        }

        // 4. Parameter table (INT vars, STR vars, RET vars, RET arrays)
        let paramTable = "";
        if (func.params) {
            const tableRows: string[] = [];
            let needsHeader = true;

            /** Format type as link if known, plain text otherwise. */
            const formatType = (type: string): string => {
                if (!type) return "";
                return KNOWN_TYPES.has(type) ? `[${type}](${IELIB_TYPES_URL}${type})` : type;
            };

            /** Truncate description to max length with ellipsis. */
            const truncateDesc = (desc: string): string => {
                if (desc.length <= DESC_MAX_LENGTH) return desc;
                return desc.slice(0, DESC_MAX_LENGTH - 3) + "...";
            };

            /** Add section header row. */
            const addSectionHeader = (sectionName: string) => {
                if (needsHeader) {
                    tableRows.push(`| | ${sectionName} | Description | Default |`);
                    tableRows.push("|:---|:---|:---|:---:|");
                    needsHeader = false;
                } else {
                    tableRows.push(`| | **${sectionName}** | | |`);
                }
            };

            /** Add parameter rows for INT_VAR/STR_VAR sections. */
            const addVarSection = (
                sectionName: string,
                params: { name: string; defaultValue?: string }[],
                defaultType: string
            ) => {
                if (params.length === 0) return;
                addSectionHeader(sectionName);

                for (const p of params) {
                    const jsdoc = jsdocArgs.get(p.name);
                    const type = formatType(jsdoc?.type ?? defaultType);
                    const def = p.defaultValue ?? "";
                    const desc = truncateDesc(jsdoc?.description ?? "");
                    tableRows.push(`| ${type} | ${p.name} | ${desc} | ${def} |`);
                }
            };

            /** Add parameter rows for RET/RET_ARRAY sections. */
            const addRetSection = (sectionName: string, params: string[]) => {
                if (params.length === 0) return;
                addSectionHeader(sectionName);

                for (const name of params) {
                    const jsdoc = jsdocArgs.get(name);
                    const type = formatType(jsdoc?.type ?? "");
                    const desc = truncateDesc(jsdoc?.description ?? "");
                    tableRows.push(`| ${type} | ${name} | ${desc} | |`);
                }
            };

            addVarSection("INT vars", func.params.intVar, "int");
            addVarSection("STR vars", func.params.strVar, "string");
            addRetSection("RET vars", func.params.ret);
            addRetSection("RET arrays", func.params.retArray);

            if (tableRows.length > 0) {
                paramTable = "\n\n" + tableRows.join("\n");
            }
        }

        // 1. Function signature
        const signatureLine = `${func.context} ${func.dtype} ${func.name}`;

        // 2. File path
        let markdownValue = [
            "```" + `${langId}`,
            signatureLine,
            "```",
            "```bgforge-mls-comment",
            filePath,
            "```",
        ].join("\n");

        // 3. JSDoc description
        if (func.jsdoc?.desc) {
            markdownValue += `\n\n${func.jsdoc.desc}`;
        }

        // 4. Parameter table
        markdownValue += paramTable;

        // 5. Return type (@return)
        if (func.jsdoc?.ret) {
            markdownValue += `\n\nReturns \`${func.jsdoc.ret.type}\``;
        }

        // 6. Deprecation notice (@deprecated)
        if (func.jsdoc?.deprecated !== undefined) {
            if (func.jsdoc.deprecated === true) {
                markdownValue += "\n\n⚠️ **Deprecated**";
            } else {
                markdownValue += `\n\n⚠️ **Deprecated:** ${func.jsdoc.deprecated}`;
            }
        }

        const markdownContents = { kind: MarkupKind.Markdown, value: markdownValue };

        // Build completion item
        // Category maps to filtering: action functions only in action context, patch in patch
        const category = func.context === "action" ? "actionFunctions" : "patchFunctions";
        const completionItem: completion.CompletionItemEx & { category: string } = {
            label: func.name,
            documentation: markdownContents,
            source: filePath,
            kind: CompletionItemKind.Function,
            labelDetails: { description: filePath },
            uri: uri,
            category,
        };
        if (func.jsdoc?.deprecated !== undefined) {
            const COMPLETION_TAG_deprecated = 1;
            completionItem.tags = [COMPLETION_TAG_deprecated];
        }
        completions.push(completionItem);

        // Build hover item
        const hoverItem = { contents: markdownContents, source: filePath, uri: uri };
        hovers.set(func.name, hoverItem);

        // Build definition location
        definitions.set(func.name, func.location);
    }

    return { completions, hovers, definitions };
}

/**
 * Build completion, hover, and definition data from parsed variables.
 * All top-level variables are included; JSDoc is optional.
 */
function buildVariableData(uri: string, variables: VariableInfo[], filePath: string) {
    const langId = LANG_WEIDU_TP2_TOOLTIP;
    const completions: completion.CompletionListEx = [];
    const hovers: hover.HoverMapEx = new Map();
    const definitions: definition.Data = new Map();

    for (const varInfo of variables) {
        // Determine display type: JSDoc @type overrides inferred type
        const displayType = varInfo.jsdoc?.type ?? varInfo.inferredType;

        // Build signature line
        const signature = varInfo.value
            ? `${displayType} ${varInfo.name} = ${varInfo.value}`
            : `${displayType} ${varInfo.name}`;

        // Build markdown hover content
        let markdownValue = [
            "```" + `${langId}`,
            signature,
            "```",
            "```bgforge-mls-comment",
            filePath,
            "```",
        ].join("\n");

        // Add JSDoc description if available
        if (varInfo.jsdoc?.desc) {
            markdownValue += `\n\n${varInfo.jsdoc.desc}`;
        }

        // Add deprecation notice if present
        if (varInfo.jsdoc?.deprecated !== undefined) {
            if (varInfo.jsdoc.deprecated === true) {
                markdownValue += "\n\n⚠️ **Deprecated**";
            } else {
                markdownValue += `\n\n⚠️ **Deprecated:** ${varInfo.jsdoc.deprecated}`;
            }
        }

        const markdownContents = { kind: MarkupKind.Markdown, value: markdownValue };

        // Build completion item
        const completionItem: completion.CompletionItemEx = {
            label: varInfo.name,
            documentation: markdownContents,
            source: filePath,
            kind: CompletionItemKind.Variable,
            labelDetails: { description: filePath },
            uri: uri,
        };
        if (varInfo.jsdoc?.deprecated !== undefined) {
            const COMPLETION_TAG_deprecated = 1;
            completionItem.tags = [COMPLETION_TAG_deprecated];
        }
        completions.push(completionItem);

        // Build hover item
        const hoverItem = { contents: markdownContents, source: filePath, uri: uri };
        hovers.set(varInfo.name, hoverItem);

        // Build definition location
        definitions.set(varInfo.name, varInfo.location);
    }

    return { completions, hovers, definitions };
}
