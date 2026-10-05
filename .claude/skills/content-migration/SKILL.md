---
name: content-migration
description: Migrate a page from a dealer's old website to the new ICC site. Use when the user gives an old-site page URL (or a list of them) and asks to create the page, "do the same for <url>", or migrate content. Produces one HTML file per page in snippets/pages/, built on snippets/pages/base.html with plain Bootstrap 3, keeping the old page's content and overall look while fitting the new site's layout. Covers fetching and cleaning the old content, mapping images to the CDN, rewriting links, minimal page CSS, CMS-safe markup and previewing.
---

# Content Migration

Rebuild one old-site page as a new-site page body that the user pastes into the CMS. The goal is **the same content and roughly the same look, in the new site's layout** — not a pixel copy of the old template.

**Use simple Bootstrap 3 as the base.** The new site already loads Bootstrap 3.3 (`row`, `col-*`, `img-responsive`, `center-block`, `text-center`, `carousel`). Build every page out of those. Only add CSS when Bootstrap genuinely can't get close to the old look, and keep it to minor tweaks (see **CSS** below). No custom grid systems, no inline styles beyond the hero background, no JavaScript.

This tool never edits the CMS. Write the file, preview it live, then hand it to the user.

## Output

- **One file per page:** `snippets/pages/<new-path>.html`, named after the page's new URL (`/rv-service` → `rv-service.html`). The user maps old URLs to new paths, usually through the nav (`snippets/nav.html`). Ask if the new path isn't clear.
- **Forms go in their own file:** `snippets/forms/<name>.html`, built with the `custom-forms` skill. The page keeps only the heading and intro paragraph that sit above the form. If the user says they already have a form, leave it out entirely.

## Page skeleton

Copy `snippets/pages/base.html`:

```html
<div class="subpage-hero" style="background: url('https://assets-cdn.interactcp.com/DEALER/images/internal/PAGE-1.png');">
    <div class="container">
        <h1></h1>
    </div>
</div>
<div class="container">
    <div class="row">
        <div class="col-xs-12 col-xl-10 col-xl-offset-1"></div>
    </div>
</div>
```

- `DEALER`: the dealer's CDN folder (e.g. `suncityrv`). `PAGE-1.png`: the page's hero image (see **Images**).
- Hero `<h1>`: a short page name ("Service", "Charities", "Our Team").
- Body: the old page's `<h1>` as the first heading inside the column, then its content in order.
- Indent 4 spaces per level, one tag per line, and put long paragraph text on its own line inside `<p>`.

## Workflow

### 1. Fetch the old page and pull out the content

Fetch with `curl` — **never navigate the debug Chrome tab to the old site.** A cross-origin navigation drops the injector's document-start script and every later CSS sync fails (`removeScriptToEvaluateOnNewDocument: Script not found`) until `npm run dev` is restarted.

```bash
curl -sL -A "Mozilla/5.0" "<old-url>" -o "$TEMP/page.html"
```

Then, with a small Node script, take the HTML from the first `<h1>` to `<footer>` (or the first `<form>` when the form is excluded), drop `<script>`, `<style>` and comments, keep only content tags (`h1`–`h5`, `p`, `ul`/`ol`/`li`, `a`, `img`, `b`/`strong`, `em`, `br`) and strip `class`/`style`/`data-*` attributes. Read the result before writing anything:

- **Ignore template junk:** header contact info, slideshow captions and controls ("Previous / Pause / Next"), empty modal headings (`×`), hidden duplicate text (e.g. "NameJohn Smith / TitleSales" on staff pages), `&nbsp;` spacers.
- **Content loaded by script** shows up as an empty `<div id="loadpage">` or similar. Find what it loads (often another old page) and include that content where it belongs.
- **Slideshows** (`s_show="..."`, `background-image:url(/images/slideshow/...)`) list their image filenames; count them.

### 2. Images

Images are uploaded to `https://assets-cdn.interactcp.com/<dealer>/images/internal/<page>-<n>.png`, where `<page>` is the page's short name and `<n>` counts from 1 in page order. The first one (`<page>-1.png`) is the hero, taken from the old page's header image. Some pages use two-digit numbers (`staff-01`), so match whatever the user uploaded.

1. Check what the user already prepared: their image folder (usually `~/Downloads/<Dealer>/png/compressed/`) and the CDN (`curl -s -o /dev/null -w '%{http_code}' <url>`).
2. **Verify the order instead of guessing.** Download the old page's images and compare them byte-for-byte against the user's original files (`cmp`). Mismatched mapping (wrong photo above a staff name, wrong coupon) is the easiest mistake to make here. Image dimensions help too: a hero is wide (e.g. 1500×450), slideshow photos share one size, a different-sized odd one out is often a "no photo" placeholder.
3. **Missing images:** download them from the old site into the user's image folder with the next free name, then run `npm run img:png -- <folder>` and `npm run img:compress -- <folder>/png`. Tell the user which files still need uploading; the URLs 404 until they do.
4. **No header image on the old page:** reuse an existing hero (e.g. the About page's) and say so.
5. Never save dealer images inside the repo.

### 3. Build the page with Bootstrap

| Old-page pattern | New-page markup |
|---|---|
| Paragraphs and headings | Plain `<h2>`/`<h3>`/`<h4>` and `<p>`. Keep the old heading levels unless they skip badly; never a second `<h1>` (use `<h2>` for a form heading). Split very long paragraphs at natural breaks. |
| Several short lists side by side | `<div class="row">` with `col-sm-4` / `col-md-6` columns, one list per column. Put each pair of columns in its own `.row` so different list lengths don't stagger. |
| Image + text | `img-responsive center-block` on the `<img>`. |
| Slideshow | Bootstrap 3 `carousel slide` with `carousel-indicators`, `carousel-inner` > `item` (first one `active`), and `left`/`right carousel-control` using `glyphicon-chevron-*`. Images get `img-responsive center-block`. |
| Grid of cards / logos / staff | `<div class="row flex flex-wrap">` with `col-xs-* col-sm-* col-md-*` items so rows of uneven height line up. Match the old page's column counts per breakpoint where you can. |
| Coupons / uneven image grids | Pairs of `col-sm-6` inside separate `.row`s. |
| Call-to-action link ("Apply Now", "Contact Us") | `<div class="flex justify-center"><a href="/contact-us" class="btn btn-lead">Contact Us</a></div>` |

**CMS-safe markup:** the CMS editor (TinyMCE) moves block elements (`h1`–`h6`, `div`, `p`, `ul`) out of `<a>` tags when the page is saved, which silently breaks any card that's one big link. Never put a block element inside a link. Make the card a `<div>` and link the image and the heading separately:

```html
<div class="charity-card">
    <a href="https://example.org/" target="_blank" rel="noopener"><img src="..." alt="Example logo" /></a>
    <h3><a href="https://example.org/" target="_blank" rel="noopener">Example</a></h3>
</div>
```

Put the hover effect on the `div` (`.charity-card:hover h3 { ... }`) instead of the link.

### 4. Content edits

Keep the old wording. Fix only what's clearly broken, and list every change in the report:

- **Links:** rewrite every old-site URL to its new path (`/rv-search`, `/rv-financing`, `/consignment`, `/about-us`, `/contact-us`, `/rv-parts`, `/rv-service`, `/testimonials`, `/staff`…). Type pages use `/product/<type>` (e.g. `/product/travel-trailer`). Links to dead old-platform features (Dealer Spike staff contact forms, `/--contactstaff?...`) get dropped or pointed at `/contact-us`. No suncityrv.com-style old URLs may remain; grep for them.
- **Phone numbers** become `<a href="tel:6239798585">(623) 979-8585</a>`; extensions use `tel:6239798585,113`.
- **External links** keep `target="_blank"` and get `rel="noopener"`.
- **Typos and broken grammar** in the old copy ("Be rest assured", "to to", "S1,000" for "$1,000"): fix them.
- **Editor notes** left in live copy (e.g. "(link to google reviews?)"): remove.
- **Text pointing at things that no longer exist** ("the form below" on a page without one, "click the button below" with no button): reword, or add the button.
- **Expired content** (coupons with past expiration dates, outdated claims): keep it, but flag it in the report.
- **Factual problems** you notice (wrong geography, etc.): keep the text and flag it rather than rewrite it.

### 5. CSS — only when needed

Bootstrap covers most pages with no CSS at all. When a page needs styling to resemble the old look (card borders, a label bar, a hover):

- Follow **CSS Style Rules** in AGENTS.md: end of `styles/home.css`, a `=====` section comment named after the page, no inline comments, brand color variables, no underline on hover.
- Scope the rules to a class unique to that page's markup (`.charities-list`, `.charity-card`), never to global elements.
- Font sizes use `clamp()` from `npm run clamp -- <px>`.
- To copy the old look accurately, read the old page's own CSS rather than guessing from a screenshot: fetch its stylesheets with `curl` and search for the old class names (e.g. `list-charities`). Keep the same colors, borders and breakpoints, translated onto the new markup.

**Shared utilities.** The pages use these classes, so the dealer's `home.css` needs them once (a **Utilities** section). Add them if they're missing:

```css
.flex { display: flex; }
.justify-center { justify-content: center; }
.flex-wrap { flex-wrap: wrap; }
.btn.btn-lead { display: inline-flex; align-items: center; justify-content: center; margin: 20px 0; padding: 12px 32px; font-size: clamp(16.2px, 0.9375vw, 18px); font-weight: 700; color: var(--primary-text-color); background-color: var(--primary-bg-color); border: 2px solid var(--primary-bg-color); border-radius: 6px; transition: background-color 0.2s ease, border-color 0.2s ease; }
.btn.btn-lead:hover,
.btn.btn-lead:focus { color: var(--primary-text-color); background-color: var(--primary-hover-color); border-color: var(--primary-hover-color); text-decoration: none; }
```

Set `font-family` on `.btn-lead` to the dealer's display font if the site has one.

### 6. Preview

Preview on an existing subpage of the new site, swapping its content for the new file. Make sure `npm run dev` is running first (`npm run css -- list` must show the local files; if it says "Injector runtime not found", restart it):

```bash
npm run dbg -- eval "location.href='/contact-us'"
npm run dbg -- batch <<'EOF'
inner ".pageContent" @snippets/pages/<page>.html
eval "new Promise(r=>setTimeout(()=>r([...document.querySelectorAll('.pageContent img')].filter(i=>!i.naturalWidth).map(i=>i.src)),2500))"
fullpage
crop ".pageContent" --at 1600,992,375
restore
EOF
```

- The `eval` lists broken images (empty array = all loaded). Wait a moment before `fullpage`; screenshots taken too early show images missing and carousels collapsed.
- Check desktop, tablet and phone widths.
- For hover states, apply the hover declarations with a temporary `preview` on one element, screenshot it, then `preview reset`.
- Always `restore` and navigate back when done.

When a page the user already pasted into the CMS "looks wrong", inspect the live page's real markup with `dbg html`/`eval` before touching CSS. The CMS may have rewritten it (see CMS-safe markup above), or the user may have pasted an older version.

## Report

Tell the user, per page:

- the file path, and the hero / sections / layout in a few bullets
- images used, which ones you verified, and **which still need uploading**
- every link rewrite (a small table works) and every text change
- anything flagged but left as-is (expired coupons, factual issues, missing images reused from elsewhere)
- any CSS added, and its section name
