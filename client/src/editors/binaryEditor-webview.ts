/**
 * Binary editor webview script (.pro files).
 * Receives ParseResult + metadata via postMessage, renders an editable tree,
 * and sends edit messages back to the extension host.
 *
 * Wrapped in IIFE to avoid global scope conflicts with other webview scripts.
 */
(function () {
    // Acquire VSCode API (available in webview context)
    // @ts-expect-error -- acquireVsCodeApi is injected by VSCode webview runtime
    const vscode = acquireVsCodeApi();

    // State
    let currentEnums: Record<string, Record<number, string>> = {};
    let currentFlags: Record<string, Record<number, string>> = {};

    // DOM references
    // treeEl is guaranteed by the extension's HTML template (.tree div is always present
    // in the webview HTML). Using ! assertion since absence indicates a programming error
    // in the extension, not recoverable runtime condition. Defensive null checks would
    // mask this bug and complicate every subsequent line using treeEl.
    const treeEl = document.querySelector(".tree")!;
    const errorsEl = document.querySelector(".errors-container");
    const warningsEl = document.querySelector(".warnings-container");
    const searchInput = document.getElementById("search") as HTMLInputElement | null;
    const expandAllBtn = document.getElementById("expand-all");
    const collapseAllBtn = document.getElementById("collapse-all");

    // -- Message handling ----------------------------------------------------

    window.addEventListener("message", (event) => {
        const msg = event.data;
        switch (msg.type) {
            case "init":
                currentEnums = msg.enums ?? {};
                currentFlags = msg.flags ?? {};
                renderTree(msg.parseResult);
                break;
            case "updateField":
                updateField(msg.fieldPath, msg.displayValue, msg.rawValue);
                break;
            case "validationError":
                showFieldError(msg.fieldPath, msg.message);
                break;
        }
    });

    // Tell the extension we're ready
    vscode.postMessage({ type: "ready" });

    // -- Tree rendering ------------------------------------------------------

    interface ParsedField {
        name: string;
        value: unknown;
        rawValue?: number | string;
        offset: number;
        size: number;
        type: string;
        description?: string;
    }

    interface ParsedGroup {
        name: string;
        description?: string;
        fields: (ParsedField | ParsedGroup)[];
        expanded?: boolean;
    }

    interface ParseResult {
        format: string;
        formatName: string;
        root: ParsedGroup;
        warnings?: string[];
        errors?: string[];
    }

    function isGroup(node: ParsedField | ParsedGroup): node is ParsedGroup {
        return "fields" in node;
    }

    function renderTree(result: ParseResult): void {
        // Render errors/warnings
        if (errorsEl) {
            if (result.errors && result.errors.length > 0) {
                errorsEl.innerHTML = `<div class="errors">${result.errors.map(e => `<div>${escapeHtml(e)}</div>`).join("")}</div>`;
            } else {
                errorsEl.innerHTML = "";
            }
        }
        if (warningsEl) {
            if (result.warnings && result.warnings.length > 0) {
                warningsEl.innerHTML = `<div class="warnings">${result.warnings.map(w => `<div>${escapeHtml(w)}</div>`).join("")}</div>`;
            } else {
                warningsEl.innerHTML = "";
            }
        }

        // Render tree
        treeEl.innerHTML = result.root.fields.map((child) => renderNode(child, "")).join("");

        // Attach event listeners
        attachGroupListeners();
        attachEditListeners();
    }

    function renderNode(node: ParsedField | ParsedGroup, parentPath: string): string {
        if (isGroup(node)) {
            const nodePath = parentPath ? `${parentPath}.${node.name}` : node.name;
            const expanded = node.expanded !== false ? "expanded" : "";
            const children = node.fields.map((child) => renderNode(child, nodePath)).join("");
            return `
                <div class="group ${expanded}">
                    <div class="group-header">
                        <span class="group-name">${escapeHtml(node.name)}</span>
                    </div>
                    <div class="group-content">
                        ${children}
                    </div>
                </div>
            `;
        }

        const fieldPath = parentPath ? `${parentPath}.${node.name}` : node.name;
        const offset = `0x${node.offset.toString(16).toUpperCase().padStart(4, "0")}`;
        const enumTable = currentEnums[node.name];
        const flagTable = currentFlags[node.name];

        let valueHtml: string;

        if (enumTable && node.type === "enum") {
            valueHtml = renderEnumSelect(fieldPath, node, enumTable);
        } else if (flagTable && node.type === "flags") {
            valueHtml = renderFlagsInput(fieldPath, node, flagTable);
        } else if (isNumericType(node.type)) {
            valueHtml = renderNumberInput(fieldPath, node);
        } else {
            // Read-only display (percent, hex strings, etc.)
            const valueClass = getValueClass(node.type);
            valueHtml = `<span class="field-value ${valueClass}">${escapeHtml(String(node.value))}</span>`;
        }

        return `
            <div class="field" data-path="${escapeHtml(fieldPath)}">
                <span class="field-name">${escapeHtml(node.name)}:</span>
                ${valueHtml}
                <span class="field-meta">
                    <span class="field-offset">[${offset}]</span>
                    <span class="field-type">${escapeHtml(node.type)}</span>
                </span>
                <span class="field-error" data-error-for="${escapeHtml(fieldPath)}"></span>
            </div>
        `;
    }

    function renderNumberInput(fieldPath: string, field: ParsedField): string {
        const raw = typeof field.rawValue === "number" ? field.rawValue : (typeof field.value === "number" ? field.value : 0);
        return `<input type="number" class="field-input number" data-field="${escapeHtml(fieldPath)}" value="${raw}" />`;
    }

    function renderEnumSelect(fieldPath: string, field: ParsedField, lookup: Record<number, string>): string {
        const raw = typeof field.rawValue === "number" ? field.rawValue : 0;
        const options = Object.entries(lookup)
            .map(([k, v]) => {
                const numKey = Number(k);
                const selected = numKey === raw ? " selected" : "";
                return `<option value="${numKey}"${selected}>${escapeHtml(v)} (${numKey})</option>`;
            })
            .join("");
        return `<select class="field-input enum" data-field="${escapeHtml(fieldPath)}">${options}</select>`;
    }

    function renderFlagsInput(fieldPath: string, field: ParsedField, flagDefs: Record<number, string>): string {
        const raw = typeof field.rawValue === "number" ? field.rawValue : 0;
        const checkboxes = Object.entries(flagDefs)
            .filter(([bit]) => Number(bit) !== 0)
            .map(([bit, name]) => {
                const bitVal = Number(bit);
                const checked = (raw & bitVal) !== 0;
                const checkedClass = checked ? " checked" : "";
                const ariaChecked = checked ? "true" : "false";
                return `<label class="flag-label"><span role="checkbox" aria-checked="${ariaChecked}" tabindex="0" class="flag-checkbox${checkedClass}" data-field="${escapeHtml(fieldPath)}" data-bit="${bitVal}" data-raw="${raw}"></span>${escapeHtml(name)}</label>`;
            })
            .join("");
        return `<span class="field-flags">${checkboxes}</span>`;
    }

    function isNumericType(type: string): boolean {
        return type.includes("int") || type.includes("uint");
    }

    function getValueClass(type: string): string {
        if (type.includes("int") || type.includes("uint")) return "number";
        if (type === "enum") return "enum";
        return "";
    }

    // -- Edit handling -------------------------------------------------------

    function attachEditListeners(): void {
        // Number inputs
        treeEl.querySelectorAll<HTMLInputElement>('input[type="number"].field-input').forEach((input) => {
            input.addEventListener("change", () => {
                const fieldPath = input.dataset.field;
                if (!fieldPath) return;
                const value = parseInt(input.value, 10);
                if (isNaN(value)) return;
                clearFieldError(fieldPath);
                vscode.postMessage({ type: "edit", fieldPath, value });
            });
        });

        // Enum selects
        treeEl.querySelectorAll<HTMLSelectElement>("select.field-input").forEach((select) => {
            select.addEventListener("change", () => {
                const fieldPath = select.dataset.field;
                if (!fieldPath) return;
                const value = parseInt(select.value, 10);
                clearFieldError(fieldPath);
                vscode.postMessage({ type: "edit", fieldPath, value });
            });
        });

        // Flag checkboxes - using 'click' instead of 'change' since we manually manage state via classList
        treeEl.querySelectorAll<HTMLElement>(".flag-checkbox").forEach((checkbox) => {
            checkbox.addEventListener("click", () => {
                const fieldPath = checkbox.dataset.field;
                if (!fieldPath) return;

                // Toggle checked state
                checkbox.classList.toggle("checked");
                checkbox.setAttribute("aria-checked", checkbox.classList.contains("checked") ? "true" : "false");

                // Compute new flag value from all checkboxes in this group
                const container = checkbox.closest(".field-flags");
                if (!container) return;
                let value = 0;
                container.querySelectorAll<HTMLElement>(".flag-checkbox").forEach((cb) => {
                    if (cb.classList.contains("checked")) value |= parseInt(cb.dataset.bit ?? "0", 10);
                });

                clearFieldError(fieldPath);
                vscode.postMessage({ type: "edit", fieldPath, value });
            });

            // Keyboard support: spacebar/Enter toggles checkbox
            checkbox.addEventListener("keydown", (e: KeyboardEvent) => {
                if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    checkbox.click();
                }
            });
        });

        // Flag labels (clicking label toggles the associated checkbox)
        treeEl.querySelectorAll<HTMLElement>(".flag-label").forEach((label) => {
            label.addEventListener("click", (e) => {
                const checkbox = label.querySelector<HTMLElement>(".flag-checkbox");
                if (checkbox) {
                    e.preventDefault();
                    checkbox.click();
                }
            });
        });
    }

    // -- Field updates from extension ----------------------------------------

    function updateField(fieldPath: string, displayValue: string, rawValue: number): void {
        const fieldEl = treeEl.querySelector(`[data-path="${CSS.escape(fieldPath)}"]`);
        if (!fieldEl) return;

        const input = fieldEl.querySelector<HTMLInputElement>('input[type="number"]');
        if (input) {
            input.value = String(rawValue);
            return;
        }

        const select = fieldEl.querySelector<HTMLSelectElement>("select");
        if (select) {
            select.value = String(rawValue);
            return;
        }

        // Static field
        const valueEl = fieldEl.querySelector(".field-value");
        if (valueEl) {
            valueEl.textContent = displayValue;
        }
    }

    // -- Validation errors ---------------------------------------------------

    function showFieldError(fieldPath: string, message: string): void {
        const errorEl = treeEl.querySelector<HTMLElement>(`[data-error-for="${CSS.escape(fieldPath)}"]`);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add("visible");
        }
    }

    function clearFieldError(fieldPath: string): void {
        const errorEl = treeEl.querySelector<HTMLElement>(`[data-error-for="${CSS.escape(fieldPath)}"]`);
        if (errorEl) {
            errorEl.textContent = "";
            errorEl.classList.remove("visible");
        }
    }

    // -- Group expand/collapse -----------------------------------------------

    function attachGroupListeners(): void {
        treeEl.querySelectorAll(".group-header").forEach((header) => {
            header.addEventListener("click", () => {
                header.parentElement?.classList.toggle("expanded");
            });
        });
    }

    // Expand/collapse all
    expandAllBtn?.addEventListener("click", () => {
        treeEl.querySelectorAll(".group").forEach((group) => group.classList.add("expanded"));
    });

    collapseAllBtn?.addEventListener("click", () => {
        treeEl.querySelectorAll(".group").forEach((group) => group.classList.remove("expanded"));
    });

    // -- Search/filter -------------------------------------------------------

    function filterTree(query: string): void {
        const lowerQuery = query.toLowerCase().trim();

        treeEl.querySelectorAll(".highlight").forEach((el) => el.classList.remove("highlight"));

        if (!lowerQuery) {
            treeEl.querySelectorAll(".hidden").forEach((el) => el.classList.remove("hidden"));
            return;
        }

        treeEl.querySelectorAll(".group, .field").forEach((el) => el.classList.add("hidden"));

        const showWithParents = (el: Element): void => {
            el.classList.remove("hidden");
            let parent = el.parentElement;
            while (parent && parent !== treeEl) {
                if (parent.classList.contains("group")) {
                    parent.classList.remove("hidden");
                    parent.classList.add("expanded");
                }
                if (parent.classList.contains("group-content")) {
                    const group = parent.parentElement;
                    if (group) {
                        group.classList.remove("hidden");
                        group.classList.add("expanded");
                    }
                }
                parent = parent.parentElement;
            }
        };

        treeEl.querySelectorAll(".group-name").forEach((nameEl) => {
            const name = nameEl.textContent!.toLowerCase();
            if (name.includes(lowerQuery)) {
                nameEl.classList.add("highlight");
                const group = nameEl.closest(".group");
                if (group) {
                    showWithParents(group);
                    group.querySelectorAll(".group, .field").forEach((child) => child.classList.remove("hidden"));
                }
            }
        });

        treeEl.querySelectorAll(".field-name").forEach((nameEl) => {
            const name = nameEl.textContent!.toLowerCase();
            if (name.includes(lowerQuery)) {
                nameEl.classList.add("highlight");
                const field = nameEl.closest(".field");
                if (field) showWithParents(field);
            }
        });
    }

    if (searchInput) {
        const isMac = /Macintosh|Mac OS X/.test(navigator.userAgent);
        searchInput.placeholder = isMac ? "Cmd+F or / to search" : "Ctrl+F or / to search";

        searchInput.addEventListener("input", () => filterTree(searchInput.value));
    }

    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "f") {
            e.preventDefault();
            searchInput?.focus();
            searchInput?.select();
        }
        if (e.key === "/" && !(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement || document.activeElement instanceof HTMLSelectElement)) {
            e.preventDefault();
            searchInput?.focus();
            searchInput?.select();
        }
        if (e.key === "Escape" && document.activeElement === searchInput) {
            searchInput!.value = "";
            filterTree("");
            searchInput!.blur();
        }
    });

    // -- Utility -------------------------------------------------------------

    function escapeHtml(str: string): string {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }
})();
