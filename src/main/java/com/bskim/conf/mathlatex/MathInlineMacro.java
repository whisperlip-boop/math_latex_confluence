package com.bskim.conf.mathlatex;

import com.atlassian.confluence.content.render.xhtml.ConversionContext;
import com.atlassian.confluence.macro.Macro;

import java.util.Map;

/**
 * Renders an equation inside a line of text.
 *
 * <p>The LaTeX lives in the {@code body} parameter rather than in a macro body: an inline macro
 * with a body would be broken out onto its own line by the editor.</p>
 */
public class MathInlineMacro implements Macro {

    @Override
    public String execute(Map<String, String> parameters, String body, ConversionContext context) {
        String latex = LatexUtil.readBodyParam(parameters);
        String sizeClass = LatexUtil.sizeClass(parameters.get("size"));
        return "<span class=\"mathlatex-inline " + sizeClass + "\">"
                + "<span class=\"mathlatex-src\">" + LatexUtil.escapeHtml(latex) + "</span>"
                + "</span>";
    }

    @Override
    public BodyType getBodyType() {
        return BodyType.NONE;
    }

    @Override
    public OutputType getOutputType() {
        return OutputType.INLINE;
    }
}
