package com.bskim.conf.mathlatex;

import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Small helpers shared by the math macros.
 */
public final class LatexUtil {

    /**
     * Marker used by the editor JS when a macro parameter had to be percent-encoded.
     * Confluence serialises macro parameters into a {@code name=value|name=value} string in the
     * editor, so a raw LaTeX snippet containing {@code | { } ^ %} would corrupt the macro.
     */
    static final String ENCODING_KEY = "--uriencoded--";

    /** Accepted values of the {@code size} macro parameter. */
    private static final List<String> SIZES =
            Arrays.asList("normal", "h1", "h2", "h3", "h4", "h5", "h6");

    private LatexUtil() {
    }

    /**
     * Reverses the encoding applied by {@code mathlatex-editor.js}.
     */
    public static String decodeLatex(String value) {
        if (value == null) {
            return "";
        }
        if (!value.startsWith(ENCODING_KEY)) {
            return value;
        }
        String encoded = value.substring(ENCODING_KEY.length());
        try {
            return URLDecoder.decode(encoded, "UTF-8");
        } catch (UnsupportedEncodingException e) {
            // UTF-8 is always available; fall back to the raw text rather than failing the render.
            return encoded;
        } catch (IllegalArgumentException e) {
            // Malformed escape sequence - show what the user actually typed.
            return encoded;
        }
    }

    /**
     * Reads the LaTeX source out of a parameter map. The macro browser sends it as {@code body},
     * while a hand-written {@code {mathinline:...}} sends it as the default (unnamed) parameter.
     */
    public static String readBodyParam(Map<String, String> parameters) {
        String value = parameters.get("body");
        if (isBlank(value)) {
            value = parameters.get("");
        }
        return decodeLatex(value);
    }

    public static String escapeHtml(String text) {
        if (text == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder(text.length() + 16);
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            switch (c) {
                case '&': sb.append("&amp;"); break;
                case '<': sb.append("&lt;"); break;
                case '>': sb.append("&gt;"); break;
                case '"': sb.append("&quot;"); break;
                case '\'': sb.append("&#39;"); break;
                default: sb.append(c);
            }
        }
        return sb.toString();
    }

    /**
     * Maps the {@code size} parameter onto the CSS class that scales the rendered math.
     * KaTeX sizes everything in em, so setting font-size on the container is enough.
     */
    public static String sizeClass(String value) {
        String size = trimToNull(value);
        if (size == null) {
            return "mathlatex-size-normal";
        }
        size = size.toLowerCase();
        return SIZES.contains(size) ? "mathlatex-size-" + size : "mathlatex-size-normal";
    }

    /**
     * Turns an anchor name into something usable as an HTML id.
     */
    public static String slugify(String anchor) {
        String slug = anchor.trim().replaceAll("[^A-Za-z0-9_.-]+", "-").replaceAll("^-+|-+$", "");
        return slug.isEmpty() ? "anchor" : slug;
    }

    public static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
