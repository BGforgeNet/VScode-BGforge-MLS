// Dialog tree webview script
// Wrapped in IIFE to avoid global scope conflicts with other webview scripts
(function () {
    // Simple debounce helper
    function debounce<T extends (..._args: unknown[]) => void>(fn: T, ms: number): T {
        let timeout: ReturnType<typeof setTimeout>;
        return ((...args: unknown[]) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn(...args), ms);
        }) as T;
    }

    // Update tooltips only for overflowing text
    function updateOverflowTooltips(): void {
        document.querySelectorAll(".msg-text[data-fulltext]").forEach((el) => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.scrollWidth > htmlEl.clientWidth) {
                htmlEl.title = htmlEl.dataset.fulltext || "";
            } else {
                htmlEl.removeAttribute("title");
            }
        });
    }

    // Select an element - removes previous selection and highlights new one
    function selectElement(el: Element): void {
        document.querySelectorAll(".selected").forEach((e) => e.classList.remove("selected"));
        el.classList.add("selected");
    }

    // Get required DOM elements
    const searchInput = document.getElementById("search") as HTMLInputElement;
    const searchResults = document.querySelector(".search-results") as HTMLElement;
    const tree = document.querySelector(".tree") as HTMLElement;
    const expandAllBtn = document.getElementById("expandAll");
    const collapseAllBtn = document.getElementById("collapseAll");

    if (!searchInput || !searchResults || !tree || !expandAllBtn || !collapseAllBtn) {
        throw new Error("Required DOM elements not found");
    }

    interface SearchResult {
        type: "node" | "item";
        name?: string;
        id?: string;
        text?: string;
        msgText?: string;
        parentName?: string;
        parentId?: string;
    }

    // Search functionality - shows flat results list, hides tree
    function filterTree(query: string): void {
        const lowerQuery = query.toLowerCase().trim();

        // If empty query, show tree, hide results
        if (!lowerQuery) {
            searchResults.classList.add("hidden");
            searchResults.innerHTML = "";
            tree.classList.remove("hidden");
            return;
        }

        // Hide tree, show results
        tree.classList.add("hidden");
        searchResults.classList.remove("hidden");

        const results: SearchResult[] = [];

        // Find matching node names (first occurrences have id="node-XXX")
        document.querySelectorAll('[id^="node-"]').forEach((nodeEl) => {
            const nodeName = nodeEl.id.replace("node-", "");
            if (nodeName.toLowerCase().includes(lowerQuery)) {
                results.push({ type: "node", name: nodeName, id: nodeEl.id });
            }
        });

        // Find matching replies/options by text content and attributes
        document.querySelectorAll(".item.reply, .item.option, summary.option").forEach((itemEl) => {
            const textContent = itemEl.textContent ?? "";
            // Also search in title attributes (contains type/msgId like "NLowOption(873)")
            const titles = Array.from(itemEl.querySelectorAll("[title]")).map(el => el.getAttribute("title") || "").join(" ");
            const fullText = textContent + " " + titles;
            if (fullText.toLowerCase().includes(lowerQuery)) {
                // Find parent node name
                const parentNode = itemEl.closest('[id^="node-"]');
                const parentName = parentNode ? parentNode.id.replace("node-", "") : "";
                // Store msg-text for navigation matching
                const msgText = itemEl.querySelector(".msg-text")?.textContent?.trim() ?? "";
                // Build display text including the type from title
                const typeTitle = itemEl.querySelector(".codicon[title]")?.getAttribute("title") || "";
                const displayText = typeTitle ? `${typeTitle}: ${textContent.trim()}` : textContent.trim();
                results.push({ type: "item", text: displayText, parentName: parentName, parentId: parentNode?.id, msgText });
            }
        });

        // Render flat results - store item text in data-text for finding the specific item
        searchResults.innerHTML = results
            .map((r) => {
                if (r.type === "node") {
                    return `<div class="result" data-target="${r.id}"><span class="codicon codicon-symbol-method"></span> <span class="node-name">${r.name}</span></div>`;
                } else {
                    const prefix = r.parentName ? `<span class="desc">${r.parentName}:</span> ` : "";
                    const text = r.text ?? "";
                    // Determine color class from option type prefix (G=good, B=bad, N=neutral)
                    let cls = "option";
                    if (text.startsWith("Reply")) {
                        cls = "reply";
                    } else if (text.startsWith("G")) {
                        cls = "option-good";
                    } else if (text.startsWith("B")) {
                        cls = "option-bad";
                    } else {
                        cls = "option-neutral";
                    }
                    // Escape msgText for data attribute (used for navigation matching)
                    const escapedMsgText = (r.msgText ?? "").replace(/"/g, "&quot;");
                    return `<div class="result" data-target="${r.parentId}" data-text="${escapedMsgText}">${prefix}<span class="${cls}">${text}</span></div>`;
                }
            })
            .join("");
    }

    function clearSearch(scrollTarget?: Element): void {
        if (searchInput.value) {
            searchInput.value = "";
            filterTree("");
            // Scroll to target after restoring tree
            if (scrollTarget) {
                scrollTarget.scrollIntoView({ block: "center" });
            }
        }
    }

    // Navigate to a node: expand parents, scroll, select
    // If itemText is provided, find and select the specific reply/option within the node
    function navigateToNode(targetId: string, itemText?: string): void {
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
            // Expand all parent <details> elements to make target visible
            let parent = targetEl.parentElement;
            while (parent) {
                if (parent.tagName === "DETAILS") {
                    (parent as HTMLDetailsElement).open = true;
                }
                parent = parent.parentElement;
            }
            // Also expand the target node itself
            if (targetEl.tagName === "DETAILS") {
                (targetEl as HTMLDetailsElement).open = true;
            }

            // Find the specific item within the node if itemText is provided
            let elementToSelect: Element | null = null;
            if (itemText) {
                // Search for the specific reply/option by message text content
                const items = Array.from(targetEl.querySelectorAll(".item.reply, .item.option, summary.option"));
                for (const item of items) {
                    const msgText = item.querySelector(".msg-text")?.textContent?.trim();
                    if (msgText === itemText) {
                        elementToSelect = item;
                        break;
                    }
                }
            }

            // Fall back to the node summary, or the node itself if inline
            if (!elementToSelect) {
                elementToSelect = targetEl.querySelector("summary") || targetEl;
            }

            if (elementToSelect) {
                elementToSelect.scrollIntoView({ block: "center" });
                selectElement(elementToSelect);
            }
        }
    }

    document.body.addEventListener("click", (e) => {
        const target = e.target as Element;

        // Handle clicks on "(see above)" links that reference other nodes
        const link = target.closest(".node-link") as HTMLElement | null;
        if (link) {
            e.preventDefault();
            // stopPropagation prevents VSCode webview from jumping to top on link click
            e.stopPropagation();
            clearSearch();

            const targetId = "node-" + link.dataset.target;
            navigateToNode(targetId);
            return;
        }

        // Handle clicks on search results - navigate to node/item in tree
        const result = target.closest(".search-results .result") as HTMLElement | null;
        if (result) {
            const targetId = result.dataset.target;
            const itemText = result.dataset.text; // Text of specific reply/option to select
            // Clear search first to show tree
            searchInput.value = "";
            filterTree("");
            if (targetId) {
                navigateToNode(targetId, itemText);
            }
            return;
        }

        // Handle regular clicks on tree items - select and clear search
        const item = target.closest("summary, .item");
        if (item) {
            selectElement(item);
            clearSearch(item);
        }
    });

    // Toolbar buttons
    expandAllBtn.addEventListener("click", () => {
        document.querySelectorAll("details").forEach((d) => (d.open = true));
        updateOverflowTooltips();
    });

    collapseAllBtn.addEventListener("click", () => {
        document.querySelectorAll("details").forEach((d) => (d.open = false));
    });

    // Debounced search to avoid lag on large dialogs
    const debouncedFilter = debounce(() => filterTree(searchInput.value), 150);
    searchInput.addEventListener("input", debouncedFilter);

    // Update tooltips when details are toggled
    document.addEventListener("toggle", (e) => {
        if ((e.target as HTMLElement).tagName === "DETAILS") {
            updateOverflowTooltips();
        }
    }, true);

    // Ctrl+F focuses search, Escape clears
    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "f") {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
        }
        if (e.key === "Escape" && document.activeElement === searchInput) {
            clearSearch();
            searchInput.blur();
        }
    });

    // Update overflow tooltips on load and resize
    updateOverflowTooltips();
    window.addEventListener("resize", updateOverflowTooltips);
})();
