// Binary editor webview script (.pro files).
// Wrapped in IIFE to avoid global scope conflicts with other webview scripts.
// Shares patterns with ../dialog-tree/dialogTree-webview.ts:
//   - Platform-aware search placeholder (isMac detection)
//   - Keyboard shortcuts (Ctrl+F / Escape)
//   - Expand/collapse all button handlers
(function () {
    // Toggle group expansion
    document.querySelectorAll(".group-header").forEach((header) => {
        header.addEventListener("click", () => {
            header.parentElement?.classList.toggle("expanded");
        });
    });

    // Get required DOM elements
    const searchInput = document.getElementById("search");
    const treeEl = document.querySelector(".tree");
    const expandAllBtn = document.getElementById("expand-all");
    const collapseAllBtn = document.getElementById("collapse-all");

    if (!searchInput || !treeEl || !expandAllBtn || !collapseAllBtn) {
        console.error("Required DOM elements not found");
        throw new Error("Required DOM elements not found");
    }
    const tree = treeEl; // Narrowed to non-null

    // Expand/collapse all
    expandAllBtn.addEventListener("click", () => {
        tree.querySelectorAll(".group").forEach((group) => {
            group.classList.add("expanded");
        });
    });

    collapseAllBtn.addEventListener("click", () => {
        tree.querySelectorAll(".group").forEach((group) => {
            group.classList.remove("expanded");
        });
    });

    function filterTree(query: string): void {
        const lowerQuery = query.toLowerCase().trim();

        // Remove previous highlights
        tree.querySelectorAll(".highlight").forEach((el) => {
            el.classList.remove("highlight");
        });

        // If empty query, show everything
        if (!lowerQuery) {
            tree.querySelectorAll(".hidden").forEach((el) => {
                el.classList.remove("hidden");
            });
            return;
        }

        // Process all groups and fields
        tree.querySelectorAll(".group, .field").forEach((el) => {
            el.classList.add("hidden");
        });

        // Find matches and show them with their parents
        const showWithParents = (el: Element): void => {
            el.classList.remove("hidden");
            // Expand and show parent groups
            let parent = el.parentElement;
            while (parent && parent !== tree) {
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

        // Check group names
        tree.querySelectorAll(".group-name").forEach((nameEl) => {
            // Element.textContent is always string at runtime (never null for elements)
            const name = nameEl.textContent!.toLowerCase();
            if (name.includes(lowerQuery)) {
                nameEl.classList.add("highlight");
                const group = nameEl.closest(".group");
                if (group) {
                    showWithParents(group);
                    // Show all children of matching group
                    group.querySelectorAll(".group, .field").forEach((child) => {
                        child.classList.remove("hidden");
                    });
                }
            }
        });

        // Check field names
        tree.querySelectorAll(".field-name").forEach((nameEl) => {
            // Element.textContent is always string at runtime (never null for elements)
            const name = nameEl.textContent!.toLowerCase();
            if (name.includes(lowerQuery)) {
                nameEl.classList.add("highlight");
                const field = nameEl.closest(".field");
                if (field) {
                    showWithParents(field);
                }
            }
        });
    }

    const input = searchInput as HTMLInputElement;

    // Set platform-appropriate placeholder
    const isMac = /Macintosh|Mac OS X/.test(navigator.userAgent);
    input.placeholder = isMac ? "Cmd+F or / to search" : "Ctrl+F or / to search";

    input.addEventListener("input", () => {
        filterTree(input.value);
    });

    // Focus search on Ctrl+F / Cmd+F / "/"
    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "f") {
            e.preventDefault();
            input.focus();
            input.select();
        }
        // "/" focuses search (vim-style) when not already typing in an input/textarea
        if (e.key === "/" && !(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement)) {
            e.preventDefault();
            input.focus();
            input.select();
        }
        // Escape clears search
        if (e.key === "Escape" && document.activeElement === input) {
            input.value = "";
            filterTree("");
            input.blur();
        }
    });
})();
