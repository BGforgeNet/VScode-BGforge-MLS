/**
 * Public protocol surface shared between the VS Code client and LSP server.
 * These identifiers are the stable integration points for third-party clients.
 */

/** Standard LSP workspace/executeCommand identifiers exposed by the server. */
export const LSP_COMMAND_COMPILE = "bgforge.compile";
export const LSP_COMMAND_PARSE_DIALOG = "bgforge.parseDialog";

/** VS Code extension command identifiers. These are client-side wrappers, not LSP commands. */
export const VSCODE_COMMAND_COMPILE = "extension.bgforge.compile";
export const VSCODE_COMMAND_DIALOG_PREVIEW = "extension.bgforge.dialogPreview";

/** Custom client/server protocol methods used in addition to standard LSP. */
export const REQUEST_SET_BUILT_IN_COMPILER = "bgforge-mls/setBuiltInCompiler";
export const NOTIFICATION_LOAD_FINISHED = "bgforge-mls/load-finished";

export interface UriCommandParams {
    uri: string;
}
