/*
 * Replaces Confluence's generic macro browser form for mathblock / mathinline with a dialog that
 * shows a live KaTeX preview of what you are typing.
 *
 * Confluence hands macro editing over to us via AJS.MacroBrowser.setMacroJsOverride(); we hand the
 * result back through tinymce.confluence.macrobrowser.macroBrowserComplete/Cancel.
 *
 * Every AJS.I18n.getText() call below passes a string literal on purpose: the jsI18n web-resource
 * transformer inlines the translations by scanning for exactly that shape, and a call built from a
 * variable would silently render as its own key.
 */
(function ($) {
    "use strict";

    var ENCODING_KEY = "--uriencoded--";
    var STORE_ALIGNMENT = "mathlatex.lastAlignment";
    var STORE_SIZE = "mathlatex.lastSize";
    var STORE_NUMBERED = "mathlatex.lastNumbered";

    /*
     * Confluence serialises macro parameters into a "name=value|name=value" string in the editor,
     * so LaTeX held in a *parameter* (mathinline) has to avoid the characters that would break it.
     * Kept in sync with LatexUtil.decodeLatex on the Java side.
     */
    function encodeLatex(latex) {
        var encoded = latex
            .replace(/%/g, "%25")
            .replace(/\^/g, "%5E")
            .replace(/\{/g, "%7B")
            .replace(/\}/g, "%7D")
            .replace(/\|/g, "%7C")
            .replace(/=/g, "%3D");
        return encoded !== latex ? ENCODING_KEY + encoded : latex;
    }

    function decodeLatex(latex) {
        if (latex && latex.slice(0, ENCODING_KEY.length) === ENCODING_KEY) {
            try {
                return decodeURIComponent(latex.slice(ENCODING_KEY.length));
            } catch (e) {
                return latex.slice(ENCODING_KEY.length);
            }
        }
        return latex || "";
    }

    /* Remembering the last choice is a convenience, so a browser that refuses storage just
       falls back to the defaults rather than breaking the dialog. */
    function remember(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch (e) {
            /* private mode, storage disabled - ignore */
        }
    }

    function recall(key, fallback) {
        try {
            return window.localStorage.getItem(key) || fallback;
        } catch (e) {
            return fallback;
        }
    }

    AJS.bind("init.rte", function () {

        var macroName = null;
        var dialog = null;

        function isBlock() {
            return macroName === "mathblock";
        }

        function option(value, label) {
            return '<option value="' + value + '">' + AJS.escapeHtml(label) + "</option>";
        }

        function buildDialog() {
            // Tall enough that the preview panel is visible without scrolling, but never taller
            // than the window.
            var height = Math.min(680, Math.max(480, $(window).height() - 80));
            var d = new AJS.Dialog({ width: 720, height: height, id: "mathlatex-dialog" });

            d.addPanel("Panel",
                '<form action="#" class="aui" id="mathlatex-form">' +
                '  <div id="mathlatex-desc"></div>' +
                '  <textarea class="textarea long-field" id="mathlatex-source" rows="5" spellcheck="false"' +
                '            placeholder="' +
                AJS.escapeHtml(AJS.I18n.getText("com.bskim.conf.mathlatex.source.placeholder")) + '"></textarea>' +

                '  <div class="mathlatex-field" id="mathlatex-alignment-field">' +
                '    <label for="mathlatex-alignment">' +
                AJS.escapeHtml(AJS.I18n.getText("com.bskim.conf.mathlatex.param.alignment.label")) + '</label>' +
                '    <div class="mathlatex-control">' +
                '      <select class="select" id="mathlatex-alignment">' +
                option("left", AJS.I18n.getText("com.bskim.conf.mathlatex.param.alignment.left")) +
                option("center", AJS.I18n.getText("com.bskim.conf.mathlatex.param.alignment.center")) +
                option("right", AJS.I18n.getText("com.bskim.conf.mathlatex.param.alignment.right")) +
                '      </select>' +
                '    </div>' +
                '  </div>' +

                '  <div class="mathlatex-field" id="mathlatex-size-field">' +
                '    <label for="mathlatex-size">' +
                AJS.escapeHtml(AJS.I18n.getText("com.bskim.conf.mathlatex.param.size.label")) + '</label>' +
                '    <div class="mathlatex-control">' +
                '      <select class="select" id="mathlatex-size">' +
                option("normal", AJS.I18n.getText("com.bskim.conf.mathlatex.param.size.normal")) +
                option("h1", "H1") + option("h2", "H2") + option("h3", "H3") +
                option("h4", "H4") + option("h5", "H5") + option("h6", "H6") +
                '      </select>' +
                '    </div>' +
                '  </div>' +

                '  <div class="mathlatex-field" id="mathlatex-anchor-field">' +
                '    <label for="mathlatex-anchor">' +
                AJS.escapeHtml(AJS.I18n.getText("com.bskim.conf.mathlatex.param.anchor.label")) + '</label>' +
                '    <div class="mathlatex-control">' +
                '      <input type="text" class="text" id="mathlatex-anchor" spellcheck="false">' +
                '      <div class="mathlatex-help">' +
                AJS.escapeHtml(AJS.I18n.getText("com.bskim.conf.mathlatex.param.anchor.desc")) + '</div>' +
                '    </div>' +
                '  </div>' +

                '  <div class="mathlatex-field" id="mathlatex-numbered-field">' +
                '    <span class="mathlatex-field-label">' +
                AJS.escapeHtml(AJS.I18n.getText("com.bskim.conf.mathlatex.param.numbered.label")) + '</span>' +
                '    <div class="mathlatex-control">' +
                '      <label class="mathlatex-checkbox">' +
                '        <input type="checkbox" id="mathlatex-numbered">' +
                AJS.escapeHtml(AJS.I18n.getText("com.bskim.conf.mathlatex.param.numbered.desc")) +
                '      </label>' +
                '    </div>' +
                '  </div>' +
                '</form>' +

                '<div id="mathlatex-preview-panel">' +
                '  <h4>' + AJS.escapeHtml(AJS.I18n.getText("com.bskim.conf.mathlatex.preview.label")) + '</h4>' +
                '  <div id="mathlatex-preview"></div>' +
                '  <div id="mathlatex-preview-error"></div>' +
                '</div>',
                "panel-body");

            d.addSubmit(AJS.I18n.getText("com.bskim.conf.mathlatex.save"), onSave);
            d.addLink(AJS.I18n.getText("com.bskim.conf.mathlatex.cancel"), onCancel);
            return d;
        }

        function $source() { return $("#mathlatex-source"); }
        function $alignment() { return $("#mathlatex-alignment"); }
        function $size() { return $("#mathlatex-size"); }
        function $anchor() { return $("#mathlatex-anchor"); }
        function $numbered() { return $("#mathlatex-numbered"); }

        function renderPreview() {
            var preview = document.getElementById("mathlatex-preview");
            var error = document.getElementById("mathlatex-preview-error");
            if (!preview) {
                return;
            }

            var latex = $source().val() || "";
            preview.innerHTML = "";
            error.textContent = "";
            // Same class the macro emits, so the preview scales exactly like the saved page will.
            preview.className = "mathlatex-size-" + ($size().val() || "normal");

            // Mirror the block layout, number column included, so the preview shows the indent an
            // equation number actually costs. "(1)" is a stand-in - the real number depends on how
            // many numbered blocks precede this one on the page.
            if (isBlock() && $numbered().prop("checked")) {
                var eqno = document.createElement("span");
                eqno.className = "mathlatex-preview-eqno";
                eqno.textContent = "(1)";
                preview.appendChild(eqno);
            }

            var out = document.createElement("span");
            out.className = "mathlatex-preview-out";
            out.style.textAlign = isBlock() ? ($alignment().val() || "left") : "left";
            preview.appendChild(out);

            if (!latex.trim()) {
                return;
            }
            if (typeof katex === "undefined") {
                error.textContent = "KaTeX is not available.";
                return;
            }

            try {
                katex.render(latex, out, {
                    displayMode: isBlock(),
                    throwOnError: true,
                    strict: false,
                    trust: false
                });
            } catch (e) {
                // A half-typed formula throws on nearly every keystroke, so this is an ordinary
                // state rather than a failure: report it quietly and leave the preview empty.
                error.textContent = (e && e.message) ? e.message : String(e);
            }
        }

        function getParams() {
            var params = {};
            var size = $size().val();
            if (size && size !== "normal") {
                params.size = size;
            }

            if (isBlock()) {
                var alignment = $alignment().val();
                if (alignment) {
                    params.alignment = alignment;
                }
                var anchor = $.trim($anchor().val() || "");
                if (anchor) {
                    params.anchor = anchor;
                }
                // Omitted when on, so the common case leaves no clutter in the editor placeholder.
                if (!$numbered().prop("checked")) {
                    params.numbered = "false";
                }
            } else {
                params.body = encodeLatex($source().val() || "");
            }
            return params;
        }

        function onSave() {
            var macro = {
                name: macroName,
                // A block macro carries its LaTeX as the macro body; an inline one as a parameter.
                bodyHtml: isBlock() ? ($source().val() || "") : "",
                params: getParams(),
                defaultParameterValue: null
            };

            // Carry these choices over to the next macro inserted in this browser.
            if (isBlock()) {
                remember(STORE_ALIGNMENT, $alignment().val() || "left");
                remember(STORE_NUMBERED, $numbered().prop("checked") ? "true" : "false");
            }
            remember(STORE_SIZE, $size().val() || "normal");

            dialog.hide();
            tinymce.confluence.macrobrowser.macroBrowserComplete(macro);
        }

        function onCancel() {
            dialog.hide();
            tinymce.confluence.macrobrowser.macroBrowserCancel();
        }

        function setHeaderAndDescription(editing) {
            var label = isBlock()
                ? AJS.I18n.getText("com.bskim.conf.mathlatex.mathblock.label")
                : AJS.I18n.getText("com.bskim.conf.mathlatex.mathinline.label");

            if (editing) {
                dialog.addHeader(AJS.I18n.getText("com.bskim.conf.mathlatex.dialog.edit", label));
                dialog.page[0].button[0].html(AJS.I18n.getText("com.bskim.conf.mathlatex.save"));
            } else {
                dialog.addHeader(AJS.I18n.getText("com.bskim.conf.mathlatex.dialog.insert", label));
                dialog.page[0].button[0].html(AJS.I18n.getText("com.bskim.conf.mathlatex.insert"));
            }

            $("#mathlatex-desc").text(isBlock()
                ? AJS.I18n.getText("com.bskim.conf.mathlatex.mathblock.desc")
                : AJS.I18n.getText("com.bskim.conf.mathlatex.mathinline.desc"));
        }

        function openDialog(macro) {
            macroName = macro.name;
            var params = macro.params || {};
            // Confluence only passes a params object when re-opening an existing macro.
            var editing = !!macro.params;

            if (!dialog) {
                dialog = buildDialog();
                bindLivePreview();
            }

            setHeaderAndDescription(editing);
            $("#mathlatex-alignment-field, #mathlatex-anchor-field, #mathlatex-numbered-field")
                .toggle(isBlock());

            $source().val(isBlock() ? (macro.body || "") : decodeLatex(params.body));
            // An existing macro keeps what it was saved with; a new one picks up where the last
            // insert left off.
            $alignment().val(params.alignment || (editing ? "left" : recall(STORE_ALIGNMENT, "left")));
            $size().val(params.size || (editing ? "normal" : recall(STORE_SIZE, "normal")));
            $anchor().val(params.anchor || "");
            $numbered().prop("checked", editing
                ? params.numbered !== "false"
                : recall(STORE_NUMBERED, "true") !== "false");

            dialog.show();
            renderPreview();
            $source().focus();
        }

        function bindLivePreview() {
            var last = null;
            $source().on("input keyup change paste", function () {
                var current = $(this).val();
                if (current === last) {
                    return;
                }
                last = current;
                renderPreview();
            });
            $alignment().on("change", renderPreview);
            $size().on("change", renderPreview);
            $numbered().on("change", renderPreview);

            // Ctrl+Enter saves, matching the rest of the Confluence editor.
            $source().on("keydown", function (e) {
                if ((e.keyCode === 10 || e.keyCode === 13) && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    onSave();
                }
            });
        }

        AJS.MacroBrowser.setMacroJsOverride("mathblock", { opener: openDialog });
        AJS.MacroBrowser.setMacroJsOverride("mathinline", { opener: openDialog });
    });
})(AJS.$);
