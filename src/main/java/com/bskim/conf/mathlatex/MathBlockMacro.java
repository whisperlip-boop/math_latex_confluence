package com.bskim.conf.mathlatex;

import com.atlassian.confluence.content.render.xhtml.ConversionContext;
import com.atlassian.confluence.macro.Macro;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Renders a displayed (block level) equation.
 *
 * <p>The macro emits a container carrying the LaTeX source; {@code mathlatex-render.js} turns it
 * into markup with KaTeX once the page loads. Nothing is rendered server side, so there is no
 * cache to invalidate and no JS engine on the server.</p>
 */
public class MathBlockMacro implements Macro {

    private static final List<String> ALIGNMENTS = Arrays.asList("left", "center", "right");
    private static final String DEFAULT_ALIGNMENT = "left";

    @Override
    public String execute(Map<String, String> parameters, String body, ConversionContext context) {
        String latex = body == null ? "" : body;
        String alignment = normaliseAlignment(parameters.get("alignment"));
        String anchor = LatexUtil.trimToNull(parameters.get("anchor"));
        String sizeClass = LatexUtil.sizeClass(parameters.get("size"));
        boolean numbered = isNumbered(parameters.get("numbered"));

        StringBuilder html = new StringBuilder(latex.length() + 256);
        html.append("<div class=\"mathlatex-block ").append(sizeClass).append('"');
        html.append(" data-mathlatex-align=\"").append(alignment).append('"');
        if (anchor != null) {
            html.append(" data-mathlatex-anchor=\"").append(LatexUtil.escapeHtml(anchor)).append('"');
            html.append(" id=\"mathlatex-").append(LatexUtil.escapeHtml(LatexUtil.slugify(anchor))).append('"');
        }
        html.append('>');
        // The presence of this element is what marks a block as numbered: mathlatex-render.js
        // numbers the ones that have it and skips the rest, so an unnumbered block does not
        // consume a number.
        if (numbered) {
            html.append("<span class=\"mathlatex-eqno\"></span>");
        }
        html.append("<span class=\"mathlatex-body\">");
        html.append("<span class=\"mathlatex-src\">").append(LatexUtil.escapeHtml(latex)).append("</span>");
        html.append("</span>");
        html.append("</div>");
        return html.toString();
    }

    /** Numbering is on unless explicitly switched off. */
    private static boolean isNumbered(String value) {
        String numbered = LatexUtil.trimToNull(value);
        return numbered == null || !"false".equalsIgnoreCase(numbered);
    }

    private static String normaliseAlignment(String value) {
        String alignment = LatexUtil.trimToNull(value);
        if (alignment == null) {
            return DEFAULT_ALIGNMENT;
        }
        alignment = alignment.toLowerCase();
        return ALIGNMENTS.contains(alignment) ? alignment : DEFAULT_ALIGNMENT;
    }

    @Override
    public BodyType getBodyType() {
        return BodyType.PLAIN_TEXT;
    }

    @Override
    public OutputType getOutputType() {
        return OutputType.BLOCK;
    }
}
