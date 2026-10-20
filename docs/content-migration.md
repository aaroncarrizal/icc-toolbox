# Content migration

How to move a page from a dealer's **old website** to the new ICC site: same content and roughly the same look, rebuilt with the new site's layout. It isn't a pixel copy of the old template.

You end up with one HTML file per page that you paste into the CMS. The toolbox never edits the CMS.

> **With Claude Code:** `/content-migration <old-page-url>` does everything on this page and reports what it changed. This doc is how to do it by hand, and what to check in Claude's output.

---

## The rules in one minute

- **Plain Bootstrap 3.** The new site already loads it (`row`, `col-*`, `img-responsive`, `center-block`, `text-center`, `carousel`). No custom grids, no inline styles except the hero background, no JavaScript.
- **One file per page:** `snippets/pages/<new-path>.html`, named after the new URL (`/rv-service` → `rv-service.html`).
- **Forms go in their own file** in `snippets/forms/` (see [Custom forms](custom-forms.md)). The page keeps only the heading and intro text above the form.
- **Keep the old wording.** Fix only what's clearly broken, and note every change.
- **CSS only when Bootstrap can't get close**, as small page-scoped tweaks at the end of `styles/home.css`.

---

## Step by step

### 1. Start from the base page

Copy [`snippets/pages/base.html`](../snippets/pages/base.html) to `snippets/pages/<new-path>.html`:

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

- `DEALER`: the dealer's CDN folder (e.g. `suncityrv`). `PAGE-1.png`: the page's hero image (see step 3).
- Hero `<h1>`: a short page name ("Service", "Our Team").
- Content column: the old page's own `<h1>` becomes the first heading, followed by its content in order.
- Formatting: 4-space indent, one tag per line, long paragraph text on its own line inside `<p>`.

### 2. Get the old content

Open the old page in your **normal** browser, not the injector's Chrome window. Navigating that window to another site breaks the injector until you restart `npm run dev`.

Copy over the real content: headings, paragraphs, lists, images, links. Leave out the template junk:

- header contact info, slideshow captions and controls ("Previous / Pause / Next"), empty pop-up headings, `&nbsp;` spacers
- hidden duplicate text (e.g. "NameJohn Smith / TitleSales" on staff pages)
- **content loaded by a script** shows up as an empty box: find what it loads (often another old page) and include that content where it belongs

### 3. Images

Images go on the CDN as:

```
https://assets-cdn.interactcp.com/<dealer>/images/internal/<page>-<n>.png
```

`<page>` is the page's short name, `<n>` counts from 1 **in page order**, and `<page>-1.png` is always the hero (the old page's header image). Some pages use two digits (`staff-01`), so match whatever was uploaded.

1. **Download** the old page's images into a folder **outside the repo**, e.g. `Downloads/<Dealer>/`.
2. **Convert and shrink** them for upload:
   ```bash
   npm run img:png -- "C:/Users/me/Downloads/Dealer"
   npm run img:compress -- "C:/Users/me/Downloads/Dealer/png"
   ```
3. **Name them in page order** and upload the `compressed/` files to the dealer's `images/internal/` folder.
4. **Double-check the mapping.** A wrong photo above a staff name or a wrong coupon is the easiest mistake to make. Compare each image on the new page against the old page. Dimensions help: heroes are wide (e.g. 1500×450), slideshow photos share one size.
5. **No header image on the old page?** Reuse an existing hero (e.g. the About page's) and mention it.

### 4. Rebuild the layout with Bootstrap

| Old page has… | Build it as |
|---|---|
| Paragraphs and headings | `<h2>`/`<h3>`/`<h4>` and `<p>`. Keep the old heading levels, but never a second `<h1>` (use `<h2>`). Split very long paragraphs at natural breaks. |
| Several short lists side by side | A `<div class="row">` with `col-sm-4` / `col-md-6` columns, one list each. Each pair of columns gets its own `.row`, so different lengths don't stagger. |
| Image with text | `class="img-responsive center-block"` on the `<img>` |
| Slideshow | Bootstrap 3 carousel: `carousel slide`, `carousel-indicators`, `carousel-inner` > `item` (first one `active`), `left`/`right carousel-control` with `glyphicon-chevron-*` |
| Grid of cards / logos / staff | `<div class="row flex flex-wrap">` with `col-xs-* col-sm-* col-md-*` items, matching the old column counts per screen size |
| Coupons / uneven image grids | Pairs of `col-sm-6` in separate `.row`s |
| A button ("Apply Now", "Contact Us") | `<div class="flex justify-center"><a href="/contact-us" class="btn btn-lead">Contact Us</a></div>` |

#### Never put a block inside a link

The CMS editor moves `h1`–`h6`, `div`, `p` and `ul` **out of** `<a>` tags when the page is saved, which silently breaks any card that's one big link. Link the image and the heading separately instead:

```html
<div class="charity-card">
    <a href="https://example.org/" target="_blank" rel="noopener"><img src="..." alt="Example logo" /></a>
    <h3><a href="https://example.org/" target="_blank" rel="noopener">Example</a></h3>
</div>
```

Put hover effects on the `div` (`.charity-card:hover h3 {…}`), not on the link.

### 5. Clean up the content

| What | Do |
|---|---|
| Links to the old site | Rewrite to the new paths: `/rv-search`, `/rv-financing`, `/consignment`, `/about-us`, `/contact-us`, `/rv-parts`, `/rv-service`, `/testimonials`, `/staff`…; RV types use `/product/<type>` (e.g. `/product/travel-trailer`). **No old-domain URLs may remain.** Search the file for the old domain before you finish. |
| Links to dead old-platform features (e.g. staff contact forms) | Remove, or point to `/contact-us` |
| Dealer name, main phone, address, credit app | CMS shortcodes, never typed out: `[#DealerName]`, `<a href="tel:[#DealerPhoneNoFormat]">[#DealerPhone]</a>`, `[#DealerAddress]`, `[#DealerCity]`, `[#DealerState]`, `[#CreditAppUrl]`. Multi-location dealers: see [CMS shortcodes](cms-shortcodes.md). |
| Department phone numbers / extensions | Hardcode them: `<a href="tel:6239798585">(623) 979-8585</a>`, extension `tel:6239798585,113` |
| External links | Keep `target="_blank"`, add `rel="noopener"` |
| Typos ("to to", "S1,000" for "$1,000") | Fix |
| Editor notes left in the copy ("(link to google reviews?)") | Remove |
| Text about things that no longer exist ("the form below" with no form) | Reword, or add the missing button |
| Expired coupons, outdated claims, factual errors | **Keep them** and flag them to whoever requested the page |

### 6. CSS, only if needed

Most pages need none. When one does (card borders, a label bar, a hover):

- Add it at the **end** of `styles/home.css` under a section comment named after the page, following the [CSS style rules](../AGENTS.md#css-style-rules).
- Scope it to a class unique to that page (`.charity-card`), never to global elements.
- Font sizes: `npm run clamp -- <px>`.
- To match the old look, read the **old site's CSS** for the old class names instead of guessing from a screenshot.

**Shared utilities.** Migrated pages use these classes. Add them once per dealer, in a **Utilities** section of `home.css`, if they're missing:

```css
.flex { display: flex; }
.justify-center { justify-content: center; }
.flex-wrap { flex-wrap: wrap; }
.btn.btn-lead { display: inline-flex; align-items: center; justify-content: center; margin: 20px 0; padding: 12px 32px; font-size: clamp(16.2px, 0.9375vw, 18px); font-weight: 700; color: var(--primary-text-color); background-color: var(--primary-bg-color); border: 2px solid var(--primary-bg-color); border-radius: 6px; transition: background-color 0.2s ease, border-color 0.2s ease; }
.btn.btn-lead:hover,
.btn.btn-lead:focus { color: var(--primary-text-color); background-color: var(--primary-hover-color); border-color: var(--primary-hover-color); text-decoration: none; }
```

Set `font-family` on `.btn-lead` to the dealer's display font if the site has one.

### 7. Preview before pasting

With `npm run dev` running, open any existing subpage of the **new** site in the injector's window (e.g. `/contact-us`), then swap its content for your file:

```bash
npm run dbg -- inner ".pageContent" @snippets/pages/rv-service.html
npm run dbg -- fullpage
npm run dbg -- crop ".pageContent" --at 1600,992,375
npm run dbg -- restore
```

- Wait a couple of seconds after `inner` before screenshotting. Too early and images or carousels look broken.
- Look at desktop, tablet and phone widths.
- Broken images: any image that didn't load means a wrong URL or a file that isn't uploaded yet.
- Always `restore` when you're done.

### 8. Paste into the CMS

Paste the file's contents into the page's content in the CMS. If the live page later "looks wrong", check its real markup first (`npm run dbg -- html ".pageContent"`). The CMS may have rewritten it (see "Never put a block inside a link"), or an older version was pasted.

---

## Checklist

- [ ] File is `snippets/pages/<new-path>.html`, based on `base.html`
- [ ] Hero image URL and `<h1>` set; only one `<h1>` on the page
- [ ] Images in the right order, all uploaded (no broken images in the preview)
- [ ] No links to the old domain; external links have `rel="noopener"`
- [ ] Dealer info uses shortcodes; any hardcoded numbers are department lines
- [ ] No block elements inside `<a>`
- [ ] Forms left out of the page (built separately)
- [ ] Any CSS is at the end of `home.css`, under a section comment, scoped to the page
- [ ] Checked at desktop, tablet and phone widths
- [ ] Noted for the requester: text changes, link rewrites, images still to upload, anything flagged (expired coupons, factual issues)
