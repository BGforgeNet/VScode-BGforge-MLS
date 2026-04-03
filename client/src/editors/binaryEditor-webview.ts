import {
    formatEditableNumberValue,
    parseEditableNumberValue,
    type NumericFormat,
    sanitizeEditableNumberValue,
} from "./binaryEditor-formatting";
import { getLoadableGroupIds, shouldRecursivelyLoadTree } from "./binaryEditor-lazyActions";
import { formatEnumDisplayValue } from "./binaryEditor-lookups";

/**
 * Binary editor webview script.
 * Receives a lazy tree model from the extension host, renders loaded nodes,
 * and requests children on demand when groups expand.
 */
(function () {
    // @ts-expect-error -- acquireVsCodeApi is injected by VSCode webview runtime
    const vscode = acquireVsCodeApi();

    interface BinaryEditorNode {
        id: string;
        parentId: string;
        kind: "group" | "field";
        name: string;
        description?: string;
        expandable: boolean;
        expanded?: boolean;
        fieldPath?: string;
        editable?: boolean;
        value?: string;
        rawValue?: number | string;
        offset?: number;
        size?: number;
        valueType?: string;
        numericFormat?: NumericFormat;
        enumOptions?: Record<number, string>;
        flagOptions?: Record<number, string>;
    }

    interface InitMessage {
        type: "init";
        format: string;
        formatName: string;
        rootChildren: BinaryEditorNode[];
        warnings?: string[];
        errors?: string[];
        enums: Record<string, Record<number, string>>;
        flags: Record<string, Record<number, string>>;
    }

    interface ChildrenMessage {
        type: "children";
        nodeId: string;
        children: BinaryEditorNode[];
    }

    interface UpdateFieldMessage {
        type: "updateField";
        fieldPath: string;
        displayValue: string;
        rawValue: number;
    }

    interface ValidationErrorMessage {
        type: "validationError";
        fieldPath: string;
        message: string;
    }

    type ExtensionToWebview = InitMessage | ChildrenMessage | UpdateFieldMessage | ValidationErrorMessage;

    let currentEnums: Record<string, Record<number, string>> = {};
    let currentFlags: Record<string, Record<number, string>> = {};

    const nodeById = new Map<string, BinaryEditorNode>();
    const confirmedRawValues = new Map<string, number | string>();
    const childrenLoaded = new Set<string>();
    const loadingChildren = new Set<string>();
    let expandAllActive = false;

    const treeEl = document.querySelector(".tree")!;
    const errorsEl = document.querySelector(".errors-container");
    const warningsEl = document.querySelector(".warnings-container");
    const sidebarEl = document.querySelector<HTMLElement>(".sidebar");
    const searchInput = document.getElementById("search") as HTMLInputElement | null;
    const expandAllBtn = document.getElementById("expand-all");
    const collapseAllBtn = document.getElementById("collapse-all");

    window.addEventListener("message", (event) => {
        const msg = event.data as ExtensionToWebview;
        switch (msg.type) {
            case "init":
                currentEnums = msg.enums ?? {};
                currentFlags = msg.flags ?? {};
                renderRoot(msg);
                break;
            case "children":
                renderChildren(msg.nodeId, msg.children);
                break;
            case "updateField":
                updateField(msg.fieldPath, msg.displayValue, msg.rawValue);
                break;
            case "validationError":
                showFieldError(msg.fieldPath, msg.message);
                break;
        }
    });

    vscode.postMessage({ type: "ready" });

    function renderRoot(message: InitMessage): void {
        nodeById.clear();
        confirmedRawValues.clear();
        childrenLoaded.clear();
        loadingChildren.clear();
        expandAllActive = false;
        renderMessages(errorsEl, "errors", message.errors);
        renderMessages(warningsEl, "warnings", message.warnings);
        treeEl.replaceChildren();
        sidebarEl?.classList.toggle("hidden", message.rootChildren.length === 0);

        const fragment = document.createDocumentFragment();
        for (const node of message.rootChildren) {
            registerNode(node);
            fragment.appendChild(createNodeElement(node));
        }
        treeEl.appendChild(fragment);

        for (const node of message.rootChildren) {
            if (node.kind === "group" && node.expanded) {
                ensureChildrenLoaded(node.id);
            }
        }

        if (searchInput?.value) {
            filterTree(searchInput.value);
        }
    }

    function renderMessages(container: Element | null, className: string, messages?: string[]): void {
        if (!container) {
            return;
        }

        container.replaceChildren();
        if (!messages || messages.length === 0) {
            return;
        }

        const wrapper = document.createElement("div");
        wrapper.className = className;
        for (const message of messages) {
            const line = document.createElement("div");
            line.textContent = message;
            wrapper.appendChild(line);
        }
        container.appendChild(wrapper);
    }

    function registerNode(node: BinaryEditorNode): void {
        nodeById.set(node.id, node);
        if (node.kind === "field" && node.fieldPath && node.rawValue !== undefined) {
            confirmedRawValues.set(node.fieldPath, node.rawValue);
        }
    }

    function createNodeElement(node: BinaryEditorNode): HTMLElement {
        return node.kind === "group" ? createGroupElement(node) : createFieldElement(node);
    }

    function createGroupElement(node: BinaryEditorNode): HTMLElement {
        const groupEl = document.createElement("div");
        groupEl.className = "group";
        if (node.expanded) {
            groupEl.classList.add("expanded");
        }
        groupEl.dataset.nodeId = node.id;

        const headerEl = document.createElement("div");
        headerEl.className = "group-header";
        headerEl.dataset.nodeId = node.id;

        const nameEl = document.createElement("span");
        nameEl.className = "group-name";
        nameEl.textContent = node.name;
        headerEl.appendChild(nameEl);

        const contentEl = document.createElement("div");
        contentEl.className = "group-content";
        contentEl.dataset.parentNodeId = node.id;

        groupEl.append(headerEl, contentEl);
        return groupEl;
    }

    function createFieldElement(node: BinaryEditorNode): HTMLElement {
        const fieldEl = document.createElement("div");
        fieldEl.className = "field";
        if (node.fieldPath) {
            fieldEl.dataset.path = node.fieldPath;
        }

        const nameEl = document.createElement("span");
        nameEl.className = "field-name";
        nameEl.textContent = `${node.name}:`;
        fieldEl.appendChild(nameEl);

        fieldEl.appendChild(createFieldValueElement(node));

        const metaEl = document.createElement("span");
        metaEl.className = "field-meta";

        const offsetEl = document.createElement("span");
        offsetEl.className = "field-offset";
        offsetEl.textContent = `[${formatOffset(node.offset)}]`;
        metaEl.appendChild(offsetEl);

        const typeEl = document.createElement("span");
        typeEl.className = "field-type";
        typeEl.textContent = node.valueType ?? "";
        metaEl.appendChild(typeEl);

        fieldEl.appendChild(metaEl);

        const errorEl = document.createElement("span");
        errorEl.className = "field-error";
        if (node.fieldPath) {
            errorEl.dataset.errorFor = node.fieldPath;
        }
        fieldEl.appendChild(errorEl);

        return fieldEl;
    }

    function createFieldValueElement(node: BinaryEditorNode): HTMLElement {
        const fieldPath = node.fieldPath ?? "";
        const enumTable = node.enumOptions ?? currentEnums[node.name];
        const flagTable = node.flagOptions ?? currentFlags[node.name];

        if (node.editable && enumTable && node.valueType === "enum") {
            return createEnumSelect(fieldPath, node, enumTable);
        }

        if (node.editable && flagTable && node.valueType === "flags") {
            return createFlagsInput(fieldPath, node, flagTable);
        }

        if (node.editable && isNumericType(node.valueType ?? "")) {
            return createNumberInput(fieldPath, node);
        }

        const valueEl = document.createElement("span");
        valueEl.className = `field-value ${getValueClass(node.valueType ?? "")}`.trim();
        valueEl.textContent = node.value ?? "";
        return valueEl;
    }

    function createNumberInput(fieldPath: string, node: BinaryEditorNode): HTMLElement {
        const raw = typeof node.rawValue === "number" ? node.rawValue : Number(node.value ?? 0);
        const numericFormat = node.numericFormat ?? "decimal";
        const container = document.createElement("span");
        container.className = `field-number-group ${numericFormat === "hex32" ? "hex" : "decimal"}`.trim();

        const decrement = document.createElement("button");
        decrement.type = "button";
        decrement.className = "field-step";
        decrement.dataset.field = fieldPath;
        decrement.dataset.delta = "-1";
        decrement.textContent = "−";

        const input = document.createElement("input");
        input.type = "text";
        input.className = `field-input number ${numericFormat === "hex32" ? "hex" : "decimal"}`.trim();
        input.dataset.field = fieldPath;
        input.dataset.numericFormat = numericFormat;
        input.value = formatEditableNumberValue(Number.isNaN(raw) ? 0 : raw, numericFormat);

        const increment = document.createElement("button");
        increment.type = "button";
        increment.className = "field-step";
        increment.dataset.field = fieldPath;
        increment.dataset.delta = "1";
        increment.textContent = "+";

        if (numericFormat === "hex32") {
            const editor = document.createElement("span");
            editor.className = "field-number-editor";

            const prefix = document.createElement("span");
            prefix.className = "field-input-prefix";
            prefix.textContent = "0x";

            editor.append(prefix, input);
            container.append(editor, decrement, increment);
            return container;
        }

        container.append(input, decrement, increment);
        return container;
    }

    function createEnumSelect(
        fieldPath: string,
        node: BinaryEditorNode,
        lookup: Record<number, string>,
    ): HTMLSelectElement {
        const raw = typeof node.rawValue === "number" ? node.rawValue : 0;
        const select = document.createElement("select");
        select.className = "field-input enum";
        select.dataset.field = fieldPath;

        for (const [key, value] of Object.entries(lookup)) {
            const numericKey = Number(key);
            const option = document.createElement("option");
            option.value = String(numericKey);
            option.textContent = formatEnumDisplayValue(value, numericKey);
            option.selected = numericKey === raw;
            select.appendChild(option);
        }

        return select;
    }

    function createFlagsInput(
        fieldPath: string,
        node: BinaryEditorNode,
        flagDefs: Record<number, string>,
    ): HTMLElement {
        const raw = typeof node.rawValue === "number" ? node.rawValue : 0;
        const container = document.createElement("span");
        container.className = "field-flags";

        for (const [bit, name] of Object.entries(flagDefs)) {
            const bitValue = Number(bit);
            if (bitValue === 0) {
                continue;
            }

            const label = document.createElement("label");
            label.className = "flag-label";

            const checkbox = document.createElement("span");
            checkbox.className = "flag-checkbox";
            if ((raw & bitValue) !== 0) {
                checkbox.classList.add("checked");
            }
            checkbox.setAttribute("role", "checkbox");
            checkbox.setAttribute("tabindex", "0");
            checkbox.setAttribute("aria-checked", checkbox.classList.contains("checked") ? "true" : "false");
            checkbox.dataset.field = fieldPath;
            checkbox.dataset.bit = String(bitValue);

            label.append(checkbox, document.createTextNode(name));
            container.appendChild(label);
        }

        return container;
    }

    function renderChildren(nodeId: string, children: BinaryEditorNode[]): void {
        const contentEl = treeEl.querySelector<HTMLElement>(`.group-content[data-parent-node-id="${CSS.escape(nodeId)}"]`);
        if (!contentEl) {
            loadingChildren.delete(nodeId);
            return;
        }

        contentEl.replaceChildren();
        const fragment = document.createDocumentFragment();
        for (const child of children) {
            registerNode(child);
            fragment.appendChild(createNodeElement(child));
        }
        contentEl.appendChild(fragment);
        childrenLoaded.add(nodeId);
        loadingChildren.delete(nodeId);

        if (searchInput?.value) {
            filterTree(searchInput.value);
        }

        if (shouldRecursivelyLoadTree(expandAllActive, searchInput?.value ?? "")) {
            expandLoadedGroupsAndQueueChildren(children);
            return;
        }

        for (const child of children) {
            if (child.kind === "group" && child.expanded) {
                ensureChildrenLoaded(child.id);
            }
        }
    }

    function ensureChildrenLoaded(nodeId: string): void {
        if (childrenLoaded.has(nodeId) || loadingChildren.has(nodeId)) {
            return;
        }
        loadingChildren.add(nodeId);
        vscode.postMessage({ type: "getChildren", nodeId });
    }

    function expandLoadedGroupsAndQueueChildren(nodes?: readonly BinaryEditorNode[]): void {
        const groups = (nodes ?? Array.from(nodeById.values()))
            .filter((node) => node.kind === "group" && node.expandable);

        for (const group of groups) {
            const groupEl = treeEl.querySelector<HTMLElement>(`.group[data-node-id="${CSS.escape(group.id)}"]`);
            groupEl?.classList.add("expanded");
        }

        for (const nodeId of getLoadableGroupIds(groups, childrenLoaded, loadingChildren)) {
            ensureChildrenLoaded(nodeId);
        }
    }

    function updateField(fieldPath: string, displayValue: string, rawValue: number): void {
        const fieldEl = treeEl.querySelector<HTMLElement>(`.field[data-path="${CSS.escape(fieldPath)}"]`);
        if (!fieldEl) {
            return;
        }

        confirmedRawValues.set(fieldPath, rawValue);
        applyFieldValue(fieldEl, rawValue, displayValue);
    }

    function applyFieldValue(fieldEl: HTMLElement, rawValue: number | string, displayValue: string): void {
        const input = fieldEl.querySelector<HTMLInputElement>('input.field-input');
        if (input) {
            input.value = formatEditableNumberValue(Number(rawValue), input.dataset.numericFormat === "hex32" ? "hex32" : "decimal");
            return;
        }

        const select = fieldEl.querySelector<HTMLSelectElement>("select");
        if (select) {
            select.value = String(rawValue);
            return;
        }

        const checkboxes = fieldEl.querySelectorAll<HTMLElement>(".flag-checkbox");
        if (checkboxes.length > 0) {
            const numericRaw = typeof rawValue === "number" ? rawValue : Number.parseInt(String(rawValue), 10) || 0;
            checkboxes.forEach((checkbox) => {
                const bit = Number.parseInt(checkbox.dataset.bit ?? "0", 10);
                const checked = (numericRaw & bit) !== 0;
                checkbox.classList.toggle("checked", checked);
                checkbox.setAttribute("aria-checked", checked ? "true" : "false");
            });
            return;
        }

        const valueEl = fieldEl.querySelector<HTMLElement>(".field-value");
        if (valueEl) {
            valueEl.textContent = displayValue;
        }
    }

    function showFieldError(fieldPath: string, message: string): void {
        const errorEl = treeEl.querySelector<HTMLElement>(`.field-error[data-error-for="${CSS.escape(fieldPath)}"]`);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add("visible");
        }

        const fieldEl = treeEl.querySelector<HTMLElement>(`.field[data-path="${CSS.escape(fieldPath)}"]`);
        const confirmedRawValue = confirmedRawValues.get(fieldPath);
        if (fieldEl && confirmedRawValue !== undefined) {
            applyFieldValue(fieldEl, confirmedRawValue, String(confirmedRawValue));
        }
    }

    function clearFieldError(fieldPath: string): void {
        const errorEl = treeEl.querySelector<HTMLElement>(`.field-error[data-error-for="${CSS.escape(fieldPath)}"]`);
        if (!errorEl) {
            return;
        }
        errorEl.textContent = "";
        errorEl.classList.remove("visible");
    }

    treeEl.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        const stepButton = target.closest<HTMLButtonElement>(".field-step");
        if (stepButton) {
            event.preventDefault();
            const fieldPath = stepButton.dataset.field;
            const delta = Number.parseInt(stepButton.dataset.delta ?? "0", 10);
            if (!fieldPath || Number.isNaN(delta)) {
                return;
            }
            const input = treeEl.querySelector<HTMLInputElement>(`.field[data-path="${CSS.escape(fieldPath)}"] input.field-input`);
            if (!input) {
                return;
            }
            const numericFormat = input.dataset.numericFormat === "hex32" ? "hex32" : "decimal";
            const currentValue = parseEditableNumberValue(input.value, numericFormat);
            if (Number.isNaN(currentValue)) {
                return;
            }
            const nextValue = (currentValue + delta) | 0;
            input.value = formatEditableNumberValue(nextValue, numericFormat);
            clearFieldError(fieldPath);
            vscode.postMessage({ type: "edit", fieldPath, value: nextValue });
            return;
        }

        const groupHeader = target.closest<HTMLElement>(".group-header");
        if (groupHeader) {
            const nodeId = groupHeader.dataset.nodeId;
            if (!nodeId) {
                return;
            }
            const groupEl = groupHeader.parentElement;
            const willExpand = !groupEl?.classList.contains("expanded");
            groupEl?.classList.toggle("expanded");
            if (willExpand) {
                ensureChildrenLoaded(nodeId);
            }
            return;
        }

        const flagLabel = target.closest<HTMLElement>(".flag-label");
        if (flagLabel) {
            const checkbox = flagLabel.querySelector<HTMLElement>(".flag-checkbox");
            if (checkbox) {
                event.preventDefault();
                toggleFlagCheckbox(checkbox);
            }
            return;
        }

        const checkbox = target.closest<HTMLElement>(".flag-checkbox");
        if (checkbox) {
            event.preventDefault();
            toggleFlagCheckbox(checkbox);
        }
    });

    treeEl.addEventListener("input", (event) => {
        const target = event.target as HTMLElement;
        if (!(target instanceof HTMLInputElement) || !target.matches("input.field-input")) {
            return;
        }

        const numericFormat = target.dataset.numericFormat === "hex32" ? "hex32" : "decimal";
        const sanitized = sanitizeEditableNumberValue(target.value, numericFormat);
        if (sanitized !== target.value) {
            target.value = sanitized;
        }
    });

    treeEl.addEventListener("change", (event) => {
        const target = event.target as HTMLElement;
        if (target instanceof HTMLInputElement && target.matches("input.field-input")) {
            const fieldPath = target.dataset.field;
            if (!fieldPath) {
                return;
            }
            const value = parseEditableNumberValue(target.value, target.dataset.numericFormat === "hex32" ? "hex32" : "decimal");
            if (Number.isNaN(value)) {
                return;
            }
            clearFieldError(fieldPath);
            vscode.postMessage({ type: "edit", fieldPath, value });
            return;
        }

        if (target instanceof HTMLSelectElement && target.matches("select.field-input")) {
            const fieldPath = target.dataset.field;
            if (!fieldPath) {
                return;
            }
            const value = Number.parseInt(target.value, 10);
            clearFieldError(fieldPath);
            vscode.postMessage({ type: "edit", fieldPath, value });
        }
    });

    treeEl.addEventListener("keydown", (event) => {
        const keyboardEvent = event as KeyboardEvent;
        const target = keyboardEvent.target as HTMLElement;
        if (target.classList.contains("flag-checkbox") && (keyboardEvent.key === " " || keyboardEvent.key === "Enter")) {
            keyboardEvent.preventDefault();
            toggleFlagCheckbox(target);
            return;
        }

        if (target instanceof HTMLInputElement && target.matches("input.field-input")) {
            if (keyboardEvent.key !== "ArrowUp" && keyboardEvent.key !== "ArrowDown") {
                return;
            }
            keyboardEvent.preventDefault();
            const fieldPath = target.dataset.field;
            if (!fieldPath) {
                return;
            }
            const numericFormat = target.dataset.numericFormat === "hex32" ? "hex32" : "decimal";
            const currentValue = parseEditableNumberValue(target.value, numericFormat);
            if (Number.isNaN(currentValue)) {
                return;
            }
            const delta = keyboardEvent.key === "ArrowUp" ? 1 : -1;
            const nextValue = (currentValue + delta) | 0;
            target.value = formatEditableNumberValue(nextValue, numericFormat);
            clearFieldError(fieldPath);
            vscode.postMessage({ type: "edit", fieldPath, value: nextValue });
        }
    });

    function toggleFlagCheckbox(checkbox: HTMLElement): void {
        const fieldPath = checkbox.dataset.field;
        if (!fieldPath) {
            return;
        }

        checkbox.classList.toggle("checked");
        checkbox.setAttribute("aria-checked", checkbox.classList.contains("checked") ? "true" : "false");

        const container = checkbox.closest(".field-flags");
        if (!container) {
            return;
        }

        let value = 0;
        container.querySelectorAll<HTMLElement>(".flag-checkbox").forEach((entry) => {
            if (entry.classList.contains("checked")) {
                value |= Number.parseInt(entry.dataset.bit ?? "0", 10);
            }
        });

        clearFieldError(fieldPath);
        vscode.postMessage({ type: "edit", fieldPath, value });
    }

    expandAllBtn?.addEventListener("click", () => {
        expandAllActive = true;
        expandLoadedGroupsAndQueueChildren();
    });

    collapseAllBtn?.addEventListener("click", () => {
        expandAllActive = false;
        treeEl.querySelectorAll<HTMLElement>(".group").forEach((groupEl) => groupEl.classList.remove("expanded"));
    });

    function filterTree(query: string): void {
        const lowerQuery = query.toLowerCase().trim();

        treeEl.querySelectorAll(".highlight").forEach((el) => el.classList.remove("highlight"));

        if (!lowerQuery) {
            treeEl.querySelectorAll(".hidden").forEach((el) => el.classList.remove("hidden"));
            return;
        }

        expandLoadedGroupsAndQueueChildren();

        treeEl.querySelectorAll(".group, .field").forEach((el) => el.classList.add("hidden"));

        const showWithParents = (el: Element): void => {
            el.classList.remove("hidden");
            let parent = el.parentElement;
            while (parent && parent !== treeEl) {
                if (parent.classList.contains("group")) {
                    parent.classList.remove("hidden");
                    parent.classList.add("expanded");
                    const nodeId = (parent as HTMLElement).dataset.nodeId;
                    if (nodeId) {
                        ensureChildrenLoaded(nodeId);
                    }
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
            const name = nameEl.textContent?.toLowerCase() ?? "";
            if (name.includes(lowerQuery)) {
                nameEl.classList.add("highlight");
                const group = nameEl.closest(".group");
                if (group) {
                    showWithParents(group);
                }
            }
        });

        treeEl.querySelectorAll(".field-name").forEach((nameEl) => {
            const name = nameEl.textContent?.toLowerCase() ?? "";
            if (name.includes(lowerQuery)) {
                nameEl.classList.add("highlight");
                const field = nameEl.closest(".field");
                if (field) {
                    showWithParents(field);
                }
            }
        });
    }

    if (searchInput) {
        const isMac = /Macintosh|Mac OS X/.test(navigator.userAgent);
        searchInput.placeholder = isMac ? "Cmd+F or / to search" : "Ctrl+F or / to search";
        searchInput.addEventListener("input", () => filterTree(searchInput.value));
    }

    document.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "f") {
            event.preventDefault();
            searchInput?.focus();
            searchInput?.select();
        }
        if (
            event.key === "/"
            && !(document.activeElement instanceof HTMLInputElement
                || document.activeElement instanceof HTMLTextAreaElement
                || document.activeElement instanceof HTMLSelectElement)
        ) {
            event.preventDefault();
            searchInput?.focus();
            searchInput?.select();
        }
        if (event.key === "Escape" && document.activeElement === searchInput && searchInput) {
            searchInput.value = "";
            filterTree("");
            searchInput.blur();
        }
    });

    function isNumericType(type: string): boolean {
        return type.includes("int") || type.includes("uint");
    }

    function getValueClass(type: string): string {
        if (type.includes("int") || type.includes("uint")) {
            return "number";
        }
        if (type === "enum") {
            return "enum";
        }
        return "";
    }

    function formatOffset(offset?: number): string {
        const numericOffset = typeof offset === "number" ? offset : 0;
        return `0x${numericOffset.toString(16).toUpperCase().padStart(4, "0")}`;
    }
})();
