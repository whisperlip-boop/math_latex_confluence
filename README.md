# Math LaTeX for Confluence

A Confluence Data Center P2 app that renders LaTeX math with [KaTeX](https://katex.org/).

- **Target**: Confluence DC 7.8.1 (developed against), 7.12.3 (deployment target)
- **Rendering**: client side, KaTeX 0.16.11 bundled with the app — no CDN, no server-side JS engine
- **Extensions**: mhchem, so `\ce{2H2 + O2 -> 2H2O}` works

## Macros

| Macro | Storage | Parameters |
|---|---|---|
| `mathblock` | LaTeX in the macro **body** | `alignment` (left/center/right, default left), `anchor`, `numbered` (default true), `size` |
| `mathinline` | LaTeX in the `body` **parameter** | `body`, `size` |

`size` is `normal` or `h1`..`h6`, mapped to a CSS class that sets `font-size` on the container;
KaTeX lays out in em, so the whole formula scales. Equation numbers stay pinned at 14px so a page
of mixed sizes keeps an even column of numbers.

The dialog remembers the last `alignment`, `size` and `numbered` in `localStorage` and applies them
to the *next inserted* macro. Re-opening an existing macro always shows what it was saved with.

`mathinline` keeps its LaTeX in a parameter because Confluence breaks an inline macro with a body
onto its own line. Parameters are serialised into a `name=value|name=value` string in the editor,
so the editor JS percent-encodes `% ^ { } | =` behind a `--uriencoded--` marker and
`LatexUtil.decodeLatex` reverses it on the server. Change one side and you must change the other.

`mathblock` is numbered `(1)`, `(2)`, … in document order by `mathlatex-render.js`, restarting per
content body (page, comment, preview). Turning `numbered` off makes the macro emit no
`.mathlatex-eqno` element, and the renderer both skips it and does not spend a number on it - so
switching one equation off renumbers the rest contiguously rather than leaving a gap.

## Checking the rendering without Confluence

Open `dev/render-fixture.html` in a browser. It contains exactly the HTML the macros emit and loads
the same CSS/JS, so alignment, equation numbering and the parse-error fallback can be checked in a
second rather than through a deploy cycle.

## Build

```bash
mvn -q dependency:copy-dependencies -DoutputDirectory=dev/lib \
    -f dev/rasterizer-pom.xml            # or drop Batik 1.17 jars into dev/lib yourself
javac -cp "dev/lib/*" -d dev dev/Rasterize.java
java -cp "dev/lib/*:dev" Rasterize img/math_block_ico.svg /tmp/out 32
```

`dev/Rasterize.java` needs Apache Batik on the classpath (`org.apache.xmlgraphics:batik-transcoder`
and `batik-codec`, 1.17).bash
./build.sh
```bash
mvn -q dependency:copy-dependencies -DoutputDirectory=dev/lib \
    -f dev/rasterizer-pom.xml            # or drop Batik 1.17 jars into dev/lib yourself
javac -cp "dev/lib/*" -d dev dev/Rasterize.java
java -cp "dev/lib/*:dev" Rasterize img/math_block_ico.svg /tmp/out 32
```

`dev/Rasterize.java` needs Apache Batik on the classpath (`org.apache.xmlgraphics:batik-transcoder`
and `batik-codec`, 1.17).

Output: `target/mathlatex-plugin-1.0.0.jar`. On WSL the script also copies it to the Windows
Downloads folder set as `DROP` in `build.sh`, so the browser can pick it up from the upload dialog.

## Install

Upload the JAR by hand to your Confluence instance:

1. **⚙ → Manage apps → Upload app**
2. Pick `target/mathlatex-plugin-1.0.0.jar`

Re-uploading over an existing install is fine; Confluence hot-swaps the bundle.

> If the older `com.bskim.conf.latexmath` app is still installed, disable it first — it defines
> macros with the same `mathblock` / `mathinline` names and whichever loads last wins.

## Gotchas that cost time

**`Spring-Context: *` is mandatory**, even though this app declares no Spring components. The pom
sets it under the confluence-maven-plugin `<instructions>`. Without it the OSGi transformer builds
no application context and Confluence cannot instantiate the macro classes:

```bash
mvn -q dependency:copy-dependencies -DoutputDirectory=dev/lib \
    -f dev/rasterizer-pom.xml            # or drop Batik 1.17 jars into dev/lib yourself
javac -cp "dev/lib/*" -d dev dev/Rasterize.java
java -cp "dev/lib/*:dev" Rasterize img/math_block_ico.svg /tmp/out 32
```

`dev/Rasterize.java` needs Apache Batik on the classpath (`org.apache.xmlgraphics:batik-transcoder`
and `batik-codec`, 1.17).
Unsupported plugin type for plugin: com.bskim.conf.mathlatex
Can't create a bean because ApplicationContext is not found in OSGi bundle
```bash
mvn -q dependency:copy-dependencies -DoutputDirectory=dev/lib \
    -f dev/rasterizer-pom.xml            # or drop Batik 1.17 jars into dev/lib yourself
javac -cp "dev/lib/*" -d dev dev/Rasterize.java
java -cp "dev/lib/*:dev" Rasterize img/math_block_ico.svg /tmp/out 32
```

`dev/Rasterize.java` needs Apache Batik on the classpath (`org.apache.xmlgraphics:batik-transcoder`
and `batik-codec`, 1.17).

In the editor that surfaces as a **"No macro metadata"** dialog instead of the macro editor. Note
that the app still installs, enables, and shows its web-items, so the "+" menu looks correct while
every macro is broken. Check `docker exec confluence grep mathlatex .../atlassian-confluence.log`.

**`pluginsVersion="2"`, not `plugins-version="2"`** on the `<atlassian-plugin>` root element.

**A macro's `icon` attribute must be a raster image.** Confluence composites the editor placeholder
for an *inline* macro server side with ImageIO, which cannot read SVG. Pointing `icon` at an SVG
makes `DefaultPlaceholderImageFactory.getIcon()` return null, `/plugins/servlet/confluence/placeholder/macro`
returns 500, and the inserted macro is simply invisible in the editor - with no error in the UI.
Block macros are unaffected because they render as a macro box rather than a placeholder image, so
this looks like "inline is broken" rather than "the icon is wrong". SVG is fine for the menu icons
in `mathlatex-editor.css`, which the browser renders itself.

**KaTeX centres display math itself.** `.katex-display` and the `.katex` inside it both carry
`text-align: center` from KaTeX's own stylesheet, and both sit below `.mathlatex-body`, so the
`alignment` parameter appeared to do nothing until those were reset to `text-align: inherit`. Their
`margin: 1em 0` is zeroed for the same reason - `.mathlatex-block` already spaces itself.

**The `+` menu, the `{macro` autocomplete and the editor placeholder ignore the macro module's
`icon` attribute.** They are styled from the macro name in `mathlatex-editor.css`
(`#insert-menu .macro-mathblock .icon` and friends). Only the macro browser uses `icon`.

## Icons

Source artwork is in `img/`. The icons ship as **SVG**, not PNG: the editor draws them at 16px, and
a 16px bitmap is resampled - and visibly blurred - on any display running above 100% scaling.

| `img/` source | Shipped as | Used for |
|---|---|---|
| `math_block_ico.svg` | `svg/insert_block.svg` | mathblock in the "+" menu, autocomplete, editor placeholder |
| `math_line_ico.svg` | `svg/insert_inline.svg` | mathinline in the same places |
| `math_profile.svg` | `images/insert_block_80.png` | mathblock `icon` attribute - macro browser tile and editor placeholder (raster only, see Gotchas) |
| `math_line.svg` | `images/insert_inline_80.png` | mathinline `icon` attribute (raster only) |
| `math_profile.svg` | `images/icon_16/72/144.png` | UPM app icon and logo (raster only) |

Two things the copies need that the sources lack:

- **`viewBox="0 0 512 512"`.** The sources declare `width`/`height` but no viewBox, which makes a
  browser treat them as fixed 512px images that will not scale predictably as a background-image.
- **`content-type=image/svg+xml`** on the `svg/` web-resource entry in `atlassian-plugin.xml`. The
  `images/` entry forces `image/png` for everything under it, and a browser will not render SVG
  served as PNG - hence the separate directory.

If SVG ever fails to render, the fallback is 2x PNGs (`background-size` already says `contain`).
`dev/Rasterize.java` turns any of the SVGs into PNGs at whatever sizes you pass it; it needs Apache
Batik on the classpath, which `dev/rasterizer-pom.xml` will fetch:

```bash
mvn -q -f dev/rasterizer-pom.xml dependency:copy-dependencies -DoutputDirectory=lib
javac -cp "dev/lib/*" -d dev dev/Rasterize.java
java  -cp "dev/lib/*:dev" Rasterize img/math_block_ico.svg /tmp/out 16 20 32 80
```

## Licence

Apache License 2.0 - see [LICENSE](LICENSE) and [NOTICE](NOTICE).

[KaTeX](https://katex.org/) 0.16.11 is vendored under `src/main/resources/katex/`, together with
its `mhchem` extension, so the app has no CDN dependency and works on an air-gapped instance. KaTeX
is MIT licensed; its notice is kept at `src/main/resources/katex/LICENSE.txt` and must stay with any
redistribution. Everything else the app compiles against (the Confluence API, servlet-api, slf4j) is
`provided` scope and is not redistributed in the JAR.

The icons come from [Flaticon](https://www.flaticon.com/free-icon/) and are covered by the Flaticon
Free License rather than by this project's Apache-2.0 - see [NOTICE](NOTICE). Replacing the artwork
in `img/` with your own removes that obligation.

## Layout

```bash
mvn -q dependency:copy-dependencies -DoutputDirectory=dev/lib \
    -f dev/rasterizer-pom.xml            # or drop Batik 1.17 jars into dev/lib yourself
javac -cp "dev/lib/*" -d dev dev/Rasterize.java
java -cp "dev/lib/*:dev" Rasterize img/math_block_ico.svg /tmp/out 32
```

`dev/Rasterize.java` needs Apache Batik on the classpath (`org.apache.xmlgraphics:batik-transcoder`
and `batik-codec`, 1.17).
src/main/java/com/bskim/conf/mathlatex/
  MathBlockMacro.java     emits <div class="mathlatex-block"> carrying the LaTeX source
  MathInlineMacro.java    emits <span class="mathlatex-inline">
  LatexUtil.java          parameter decoding, HTML escaping, anchor slugs
src/main/resources/
  atlassian-plugin.xml    macros, web-resources, editor "+" menu items
  mathlatex.properties    i18n (en); mathlatex_ko.properties for Korean
  css/mathlatex.css       rendered output on the page
  css/mathlatex-editor.css  the macro browser dialog
  js/mathlatex-render.js  KaTeX rendering + equation numbering on view
  js/mathlatex-editor.js  the custom macro browser dialog with live preview
  katex/                  KaTeX 0.16.11 dist (js, css, woff2 fonts, mhchem)
  images/                 macro and app icons, rasterized from img/math_profile.svg
```bash
mvn -q dependency:copy-dependencies -DoutputDirectory=dev/lib \
    -f dev/rasterizer-pom.xml            # or drop Batik 1.17 jars into dev/lib yourself
javac -cp "dev/lib/*" -d dev dev/Rasterize.java
java -cp "dev/lib/*:dev" Rasterize img/math_block_ico.svg /tmp/out 32
```

`dev/Rasterize.java` needs Apache Batik on the classpath (`org.apache.xmlgraphics:batik-transcoder`
and `batik-codec`, 1.17).

### Where things load

`katex` is a dependency-only web-resource, so it is never pulled in by context on its own:

- `mathlatex-view-resources` — contexts `viewcontent` + `preview` — renders math on the page
- `mathlatex-editor-resources` — context `editor` — the dialog with the live preview

`katex.min.css` is served with `batch=false` on purpose: it points at its fonts with relative URLs
(`fonts/KaTeX_Main-Regular.woff2`), which only resolve against the app's own
`/download/resources/com.bskim.conf.mathlatex:katex/` path, not against a batched `/s/…/batch.css`.

If equations fail to render on some page type, that context is probably not covered by
`viewcontent`; the fix is to inject `ConfluenceWebResourceManager` into the macros and call
`requireResource("com.bskim.conf.mathlatex:mathlatex-view-resources")` from `execute()`.
