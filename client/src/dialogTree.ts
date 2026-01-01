import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { LanguageClient, ExecuteCommandRequest, ExecuteCommandParams } from "vscode-languageclient/node";

// Duplicated from server/src/dialog.ts - can't import due to rootDir constraint
interface DialogReply {
    msgId: number | string;
    line: number;
}

interface DialogOption {
    msgId: number | string;
    target: string;
    type: string;
    line: number;
}

interface DialogNode {
    name: string;
    line: number;
    replies: DialogReply[];
    options: DialogOption[];
    callTargets: string[];
}

interface DialogData {
    nodes: DialogNode[];
    entryPoints: string[];
    messages: Record<string, string>;
}

// Cached assets
let cachedHtml: string | undefined;
let cachedCss: string | undefined;
let cachedJs: string | undefined;
let cachedExtensionPath: string | undefined;

function loadAsset(extensionPath: string, relativePath: string): string {
    const fullPath = path.join(extensionPath, relativePath);
    return fs.readFileSync(fullPath, "utf8");
}

function invalidateCacheIfNeeded(extensionPath: string): void {
    if (cachedExtensionPath && cachedExtensionPath !== extensionPath) {
        cachedHtml = undefined;
        cachedCss = undefined;
        cachedJs = undefined;
    }
    cachedExtensionPath = extensionPath;
}

function getHtmlTemplate(extensionPath: string): string {
    invalidateCacheIfNeeded(extensionPath);
    if (!cachedHtml) {
        cachedHtml = loadAsset(extensionPath, path.join("client", "src", "dialogTree.html"));
    }
    return cachedHtml;
}

function getCss(extensionPath: string): string {
    if (!cachedCss) {
        cachedCss = loadAsset(extensionPath, path.join("client", "src", "dialogTree.css"));
    }
    return cachedCss;
}

function getJs(extensionPath: string): string {
    if (!cachedJs) {
        // Built by esbuild-webviews to client/out/
        cachedJs = loadAsset(extensionPath, path.join("client", "out", "dialogTree-webview.js"));
    }
    return cachedJs;
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getMsgText(msgId: number | string, messages: Record<string, string>): string {
    if (typeof msgId === "string") {
        return msgId; // expression, return as-is
    }
    const text = messages[String(msgId)];
    return text ? escapeHtml(text) : `(${msgId})`;
}

function buildTreeHtml(data: DialogData): string {
    const nodeMap = new Map(data.nodes.map((n) => [n.name, n]));
    const messages = data.messages || {};

    // Entry points called from talk_p_proc
    const entryPointNames = data.entryPoints.filter((name) => name.startsWith("Node"));
    const entries = entryPointNames
        .map((name) => nodeMap.get(name))
        .filter((n): n is DialogNode => !!n);

    // First pass: compute minimum depth for each node (closest to root wins)
    const minDepth = new Map<string, number>();

    function computeDepths(nodeName: string, depth: number, path: Set<string>): void {
        if (path.has(nodeName)) return; // cycle detection

        const currentMin = minDepth.get(nodeName);
        if (currentMin !== undefined && currentMin <= depth) return;

        minDepth.set(nodeName, depth);

        const node = nodeMap.get(nodeName);
        if (!node) return;

        path.add(nodeName);

        for (const o of node.options) {
            if (o.target && nodeMap.has(o.target)) {
                computeDepths(o.target, depth + 1, path);
            }
        }
        for (const t of node.callTargets) {
            if (nodeMap.has(t)) {
                computeDepths(t, depth + 1, path);
            }
        }

        path.delete(nodeName);
    }

    // Compute depths starting from entry points at depth 1
    for (const name of entryPointNames) {
        computeDepths(name, 1, new Set());
    }

    // Second pass: render tree
    const rendered = new Set<string>();

    const renderNode = (node: DialogNode, currentDepth: number): string => {
        const nodeMinDepth = minDepth.get(node.name);

        // Show link if: already rendered, or this node should appear at a shallower level
        if (rendered.has(node.name) || (nodeMinDepth !== undefined && nodeMinDepth < currentDepth)) {
            return `<div class="item node-ref"><span class="codicon codicon-references"></span> <a href="#" class="node-link" data-target="${node.name}">${node.name}</a></div>`;
        }

        rendered.add(node.name);

        // If node only has call targets (no replies/options), show inline
        if (node.replies.length === 0 && node.options.length === 0 && node.callTargets.length > 0) {
            const targets = node.callTargets.map((t) => {
                const targetNode = nodeMap.get(t);
                return targetNode
                    ? `<a href="#" class="node-link" data-target="${t}">${t}</a>`
                    : `<span class="target">${t}</span>`;
            }).join(", ");
            return `<div class="item node-transition" id="node-${node.name}"><span class="codicon codicon-symbol-function"></span> <span class="node-name">${node.name}</span><span class="target-link"> -> ${targets}</span></div>`;
        }

        // Find first item to show inline (reply or terminal message)
        let inlineHtml = "";
        let skipFirstReply = false;
        let skipFirstTerminalOption = -1; // index of terminal option to skip

        if (node.replies.length > 0) {
            // First reply goes inline
            const r = node.replies[0];
            const text = getMsgText(r.msgId, messages);
            inlineHtml = `<span class="reply">Reply(${r.msgId}):</span> <span class="msg-text" title="${text}">${text}</span>`;
            skipFirstReply = true;
        } else {
            // Check for terminal message (option without target)
            const terminalIdx = node.options.findIndex((o) => !o.target);
            if (terminalIdx !== -1) {
                const o = node.options[terminalIdx];
                const text = getMsgText(o.msgId, messages);
                inlineHtml = `<span class="option">${o.type}(${o.msgId}):</span> <span class="msg-text" title="${text}">${text}</span>`;
                skipFirstTerminalOption = terminalIdx;
            }
        }

        // Build remaining replies (skip first if shown inline)
        const replies = node.replies
            .slice(skipFirstReply ? 1 : 0)
            .map((r) => {
                const text = getMsgText(r.msgId, messages);
                return `<div class="item reply"><span class="codicon codicon-comment"></span> Reply(${r.msgId}): <span class="msg-text" title="${text}">${text}</span></div>`;
            })
            .join("");

        // Build options (skip terminal if shown inline)
        const optionParts: string[] = [];
        for (let i = 0; i < node.options.length; i++) {
            if (i === skipFirstTerminalOption) continue;

            const o = node.options[i];
            const arrow = o.type.startsWith("G") ? "arrow-circle-up" : o.type.startsWith("B") ? "arrow-circle-down" : "arrow-right";
            const text = getMsgText(o.msgId, messages);
            const prefix = `${o.type}(${o.msgId}): `;

            if (o.target) {
                const targetNode = nodeMap.get(o.target);
                const targetHtml = targetNode
                    ? `<a href="#" class="node-link" data-target="${o.target}">${o.target}</a>`
                    : `<span class="target">${o.target}</span>`;
                optionParts.push(`<div class="item option"><span class="codicon codicon-${arrow}"></span> ${prefix}<span class="msg-text" title="${text}">${text}</span><span class="target-link"> -> ${targetHtml}</span></div>`);

                // Render target node as sibling only if it should appear at this depth
                if (targetNode) {
                    const targetMinDepth = minDepth.get(o.target);
                    if (!rendered.has(o.target) && targetMinDepth === currentDepth + 1) {
                        optionParts.push(renderNode(targetNode, currentDepth + 1));
                    }
                }
            } else {
                optionParts.push(`<div class="item option"><span class="codicon codicon-${arrow}"></span> ${prefix}<span class="msg-text" title="${text}">${text}</span></div>`);
            }
        }
        const options = optionParts.join("");

        const children = replies + options;

        // If no children remain, render as single line
        if (!children) {
            return `<div class="item node-inline" id="node-${node.name}"><span class="codicon codicon-symbol-function"></span> <span class="node-name">${node.name}</span> ${inlineHtml}</div>`;
        }

        return `<details open class="node" id="node-${node.name}">
            <summary><span class="codicon codicon-symbol-function"></span> <span class="node-name">${node.name}</span> ${inlineHtml}</summary>
            <div class="children">${children}</div>
        </details>`;
    };

    if (entries.length === 0) return "<p>No dialog nodes found</p>";

    const entryHtml = entries.map((node) => renderNode(node, 1)).join("");

    return `<details open class="node">
        <summary><span class="codicon codicon-symbol-event"></span> <span class="node-name">talk_p_proc</span></summary>
        <div class="children">${entryHtml}</div>
    </details>`;
}

function getDialogPreviewHtml(data: DialogData, codiconsUri: string, extensionPath: string): string {
    const treeContent = buildTreeHtml(data);

    return getHtmlTemplate(extensionPath)
        .replace("{{codiconsUri}}", codiconsUri)
        .replace("{{cssUri}}", "") // Inline CSS instead
        .replace("{{scriptUri}}", "") // Inline JS instead
        .replace('<link href="" rel="stylesheet" />', `<style>${getCss(extensionPath)}</style>`)
        .replace('<script src=""></script>', `<script>${getJs(extensionPath)}</script>`)
        .replace("{{treeContent}}", treeContent);
}

export function registerDialogTree(context: vscode.ExtensionContext, client: LanguageClient): void {
    // Preview dialog tree command - full screen like Markdown preview
    let dialogPanel: vscode.WebviewPanel | undefined;
    context.subscriptions.push(
        vscode.commands.registerCommand("extension.bgforge.dialogPreview", async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== "fallout-ssl") {
                vscode.window.showWarningMessage("Open a Fallout SSL file to preview dialog");
                return;
            }

            const params: ExecuteCommandParams = {
                command: "bgforge.parseDialog",
                arguments: [{ uri: editor.document.uri.toString() }],
            };

            try {
                const data = (await client.sendRequest(ExecuteCommandRequest.type, params)) as DialogData | null;

                if (!data || data.nodes.length === 0) {
                    vscode.window.showWarningMessage("No dialog data found");
                    return;
                }

                const fileName = editor.document.fileName.split(/[/\\]/).pop() || "dialog";

                if (dialogPanel) {
                    dialogPanel.reveal(vscode.ViewColumn.Active);
                } else {
                    // Full screen in current column, like Markdown preview
                    dialogPanel = vscode.window.createWebviewPanel(
                        "bgforgeDialogPreview",
                        `Dialog: ${fileName}`,
                        vscode.ViewColumn.Active,
                        { enableScripts: true }
                    );
                    dialogPanel.onDidDispose(() => {
                        dialogPanel = undefined;
                    });
                }

                const codiconsUri = dialogPanel.webview.asWebviewUri(
                    vscode.Uri.joinPath(context.extensionUri, "node_modules", "@vscode/codicons", "dist", "codicon.css")
                );

                dialogPanel.title = `Dialog: ${fileName}`;
                dialogPanel.webview.html = getDialogPreviewHtml(data, codiconsUri.toString(), context.extensionUri.fsPath);
            } catch {
                vscode.window.showErrorMessage("Failed to generate dialog preview");
            }
        })
    );
}
