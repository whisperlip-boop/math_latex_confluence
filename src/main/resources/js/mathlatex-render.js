/*
 * Turns the placeholders emitted by MathBlockMacro / MathInlineMacro into rendered math.
 *
 * Deliberately free of AJS/jQuery so it can run in any context the macros end up in
 * (page view, preview, comments, the macro browser preview).
 */
(function (window, document) {
    "use strict";

    var DONE_CLASS = "mathlatex-done";
    var FAILED_CLASS = "mathlatex-failed";
    var SELECTOR = ".mathlatex-block, .mathlatex-inline";

    /* Containers that each get their own equation numbering sequence. */
    var NUMBERING_ROOTS = ".wiki-content, .comment-content, .preview-content";

    function katexAvailable() {
        if (typeof window.katex === "undefined") {
            if (window.console) {
                window.console.warn("Math LaTeX: KaTeX did not load, leaving equations unrendered.");
            }
            return false;
        }
        return true;
    }

    function closestMatching(element, selector) {
        var node = element;
        while (node && node.nodeType === 1) {
            if (node.matches ? node.matches(selector) : node.msMatchesSelector(selector)) {
                return node;
            }
            node = node.parentNode;
        }
        return null;
    }

    function renderOne(element) {
        var source = element.querySelector(".mathlatex-src");
        if (!source) {
            element.className += " " + DONE_CLASS;
            return;
        }

        var latex = source.textContent || "";
        var isBlock = element.className.indexOf("mathlatex-block") !== -1;
        var target = isBlock ? element.querySelector(".mathlatex-body") : element;

        var output = document.createElement("span");
        output.className = "mathlatex-out";

        try {
            window.katex.render(latex, output, {
                displayMode: isBlock,
                throwOnError: true,
                strict: false,
                trust: false
            });
        } catch (e) {
            // Keep the source visible and say why, rather than silently dropping the equation.
            var reason = e && e.message ? e.message : String(e);
            element.className += " " + FAILED_CLASS + " " + DONE_CLASS;
            element.title = reason;

            var message = document.createElement("span");
            message.className = "mathlatex-error";
            message.textContent = reason;
            // Into the body, not the block: the block is a flex row, so appending there would put
            // the message in a column beside the equation instead of underneath it.
            target.appendChild(message);
            return;
        }

        target.insertBefore(output, source);
        element.className += " " + DONE_CLASS;
    }

    function numberBlocks(root) {
        var counters = [];
        var blocks = root.querySelectorAll(".mathlatex-block");
        for (var i = 0; i < blocks.length; i++) {
            var block = blocks[i];
            var container = closestMatching(block, NUMBERING_ROOTS) || document.body;

            var counter = null;
            for (var j = 0; j < counters.length; j++) {
                if (counters[j].container === container) {
                    counter = counters[j];
                    break;
                }
            }
            if (!counter) {
                counter = { container: container, next: 1 };
                counters.push(counter);
            }

            // No .mathlatex-eqno means the macro turned numbering off; such a block is skipped
            // entirely rather than silently burning a number.
            var label = block.querySelector(".mathlatex-eqno");
            if (label) {
                label.textContent = "(" + counter.next + ")";
                counter.next++;
            }
        }
    }

    function renderAll(root) {
        if (!katexAvailable()) {
            return;
        }
        var pending = root.querySelectorAll(SELECTOR);
        for (var i = 0; i < pending.length; i++) {
            if (pending[i].className.indexOf(DONE_CLASS) === -1) {
                renderOne(pending[i]);
            }
        }
        // Re-run over the whole document: content added later shifts the numbers of nothing
        // before it, but a comment loaded above an existing one would.
        numberBlocks(document);
    }

    function debounce(fn, wait) {
        var timer = null;
        return function () {
            if (timer) {
                window.clearTimeout(timer);
            }
            timer = window.setTimeout(fn, wait);
        };
    }

    function start() {
        renderAll(document);

        // Confluence loads comments, previews and inline-edit results over AJAX, so watch for
        // macro output that appears after the initial render.
        if (typeof window.MutationObserver === "undefined") {
            return;
        }
        var rerender = debounce(function () {
            renderAll(document);
        }, 100);
        new window.MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var added = mutations[i].addedNodes;
                for (var j = 0; j < added.length; j++) {
                    var node = added[j];
                    if (node.nodeType !== 1) {
                        continue;
                    }
                    // Only macro placeholders count. Matching "mathlatex-" loosely would also
                    // match the .mathlatex-out spans this script inserts, and loop forever.
                    var cls = node.className ? " " + String(node.className) + " " : "";
                    if (cls.indexOf(" mathlatex-block ") !== -1 ||
                        cls.indexOf(" mathlatex-inline ") !== -1 ||
                        (node.querySelector && node.querySelector(SELECTOR))) {
                        rerender();
                        return;
                    }
                }
            }
        }).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }

    // Exposed so the macro browser preview can reuse the same rendering path.
    window.MathLatex = window.MathLatex || {};
    window.MathLatex.renderAll = renderAll;
    window.MathLatex.renderOne = renderOne;
})(window, document);
