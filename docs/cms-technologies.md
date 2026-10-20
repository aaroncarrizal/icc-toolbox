# CMS & site technologies

What a dealer site is built on, in which order its CSS loads, and how the **blog** differs from the rest of the site. Knowing this tells you which classes and plugins you can rely on, and why a rule that works on the homepage might not work on `/blog`.

> Everything here was checked against live dealer sites' HTML (Oct 2026). Versions can change. To check a site yourself, run `npm run css -- list` (every stylesheet on the open page) or view the page source.

---

## The platform

| Layer | What it is | Where you meet it |
|---|---|---|
| **CMS** | **Umbraco** (a .NET CMS) | Pages, snippets and macros. Snippets appear in page source as `<?UMBRACO_MACRO ... Snippet="527811" />` holders. |
| **Editor** | **TinyMCE** | The page editor. It rewrites markup on save: it moves block elements out of `<a>` tags, and `mceNonEditable` blocks are protected macros. See [Content migration](content-migration.md#never-put-a-block-inside-a-link). |
| **Shortcodes** | `[#DealerName]`, `[#DealerPhone]`, … | Filled in server-side when the page renders. See [CMS shortcodes](cms-shortcodes.md). |
| **Forms** | Posted with AJAX to `/Forms/Ajax`, configured by hidden inputs, emails rendered from Handlebars templates (`lead_generic.hbs`, …) | See [Custom forms](custom-forms.md) |
| **Lead inbox** | ICC | Leads arrive labeled with the form's `FormType` |
| **Assets** | `assets.interactcp.com` / `assets-cdn.interactcp.com` (CloudFront) | Dealer CSS, JS and images, e.g. `assets-cdn.interactcp.com/<dealer>/images/internal/...` |
| **Blog** | **WordPress** (5.9), served under `/blog/` on the same domain | See [The blog is different](#the-blog-is-different) |

---

## Front-end stack (main site)

| Library | Version | Notes |
|---|---|---|
| **Bootstrap** CSS | **3.3.6** | Grid (`row`, `col-*`), `img-responsive`, `visible-xs`, `collapse`, `carousel`, `btn`… Bootstrap **3**, so no Bootstrap 4/5 utilities (`d-flex`, `mt-3`, …). |
| Bootstrap JS | 3.0.0 | Collapse, carousel, modal, tabs (`data-toggle`, `data-target`) |
| **jQuery** | **1.8.3** | Old. When one ready handler throws, it aborts the rest, so one broken script can kill carousels or tabs elsewhere (check `npm run dbg -- errors`). Not loaded yet at document start. |
| Font Awesome | Kit (`fa fa-*` and newer classes) + `compat.css` | Icons: `<i class="fa fa-search"></i>` |
| jQuery Validate + Unobtrusive | — | Form validation driven by the `data-val-*` attributes on form fields |
| jQuery Typeahead | — | Inventory search suggestions |
| Colorbox | 1.4.3 | Lightboxes / pop-ups |
| Cycle2, Unveil, lazyload | — | Slideshows and lazy-loaded images |
| Bootstrap Datepicker, tabcollapse, cookie, hoverIntent | — | Date fields, tabs that collapse on mobile, cookies, delayed hover menus |
| Tealium | — | Analytics and consent. The `<body>` carries dealer data attributes (`data-dealer-name`, `data-dealer-city`, …). |
| Dealer `site.js` | — | Per-dealer scripts, e.g. `assets.interactcp.com/<dealer>/js/<site>/site.js` |
| Google Fonts, Owl Carousel | — | Added per dealer when the design needs them |

**Page identity:** the main site's `<body>` has `id="page-<contentId>"`, and the homepage adds the class `homepage`. Use `.homepage` (or the section classes, e.g. `.home-hero`) to scope home-only rules.

---

## How CSS loads on the main site

In this order (later files win at equal specificity):

```text
1. bootstrap.min.css                         Bootstrap 3.3.6 (bootstrapcdn)
2. fontawesome-kit/all.min.css + compat.css  icons
3. jquery.typeahead.css                      search suggestions
4. ds-global.css                             platform-wide styles, shared by every dealer
5. /styles/global.css                        platform styles served from the site itself
6. //assets.interactcp.com/<dealer>/css/<id>_default.css   ← the dealer's theme = our styles/home.css
7. //assets.interactcp.com/<dealer>/css/<id>_client.css    ← "custom site styles", usually almost empty
8. dealer extras (Google Fonts, Owl Carousel, …)
```

- **`styles/home.css` is the dealer's `<id>_default.css`.** That's the file your work replaces when it's deployed. It loads after the platform CSS, so a rule with the same specificity as a platform rule wins without `!important`.
- `<id>` is the dealer's stylesheet number (e.g. `443359_default.css`). It differs per dealer.
- While you work, the injector switches the live dealer files off (`stripPatterns`, usually `"//assets.interactcp.com"`) and puts your local `home.css` in their place, so you see your version, not the deployed one.
- Inline `<style>` blocks inside page content (e.g. on `/search-assistant`) apply too. `npm run dbg -- why` reports them as `inline <style>:<line>`.

---

## The blog is different

The blog at `/blog/` is a **separate WordPress install** with its own theme, not an Umbraco page. It **loads the same dealer stylesheets**, but everything around them is different.

### The header, nav and footer are borrowed from `/contact-us`

The blog page itself contains no site header or footer, only empty placeholders. After the page loads, a jQuery script fetches them from the **`/contact-us`** page and drops them in:

```js
jQuery("#headerPlaceholder").load('/contact-us header');
jQuery("#navPlaceholder").load('/contact-us #main-nav');
jQuery("#rvTypesPlaceholder").load('/contact-us #rv-types');
jQuery("#sidebarPlaceholder").load('/contact-us #sideBar', ...);   // then the WordPress sidebar is moved in
jQuery("#footerPlaceholder").load('/contact-us footer');
```

So on the blog:

- `#site-header`, `#main-nav`, `#rv-types` and `#site-footer` **exist only after a moment**, inside `#headerPlaceholder` / `#navPlaceholder` / `#rvTypesPlaceholder` / `#footerPlaceholder`. Wait for them to appear before inspecting them with `dbg`, and expect a brief flash before they show up.
- They come from **`/contact-us`**, so a header/footer change in the CMS reaches the blog when it's on that page's layout. If the blog's header looks out of date, check `/contact-us` first.
- Your `#site-header …` / `#site-footer …` rules **do** apply once the markup is in, because the injector re-applies CSS when late markup arrives. But the site scripts that run on page ready (e.g. dropdown hover handlers) **won't have run on the borrowed header**, so header behavior can differ from the main site.
- `/contact-us` must keep its `header`, `#main-nav`, `#rv-types`, `#sideBar` and `footer` elements. Removing or renaming them there breaks the blog.

### Side by side

| | Main site | Blog |
|---|---|---|
| Platform | Umbraco | **WordPress 5.9** (`/blog/wp-content/…`) |
| `<body>` | `id="page-<contentId>"`, `.homepage` on home | **`id="blog"`**, WordPress classes (`home blog`, `single`, …) |
| Base CSS before the dealer's | Bootstrap, Font Awesome kit, typeahead, `ds-global.css`, `/styles/global.css` | WordPress `block-library/style.min.css`, a share-buttons plugin, **Bootstrap 3.3.6 (twice)**, **Font Awesome 3.2.1** + `font-awesome.all.min.css`, the theme's **`interactrv-bootstrap3/assets/css/app.css`**, `ds-global.css`. **No `/styles/global.css`.** |
| Dealer CSS | `//assets.interactcp.com/<dealer>/css/<id>_default.css` + `_client.css` | **The same two files, but from `//assets-cdn.interactcp.com/…`** |
| jQuery | 1.8.3 | 1.9.1 (theme) **and** 1.8.3 (site header) |
| Content markup | Our snippets / CMS pages | WordPress markup: `article.type-post`, `.wp-post-image`, `.wp-sidebar`, `.widget_recent_entries`, `#searchform`, `.page-header` |
| Content wrapper | `.pageContent` (a class) | **`#pageContent`** (an id) |
| Header / nav / footer | In the page | **Loaded afterwards from `/contact-us`** (see above) |

### What that means for you

1. **One stylesheet for both.** Blog styles go in the same `styles/home.css`, at the end, like everything else. There's no separate blog stylesheet.
2. **Scope blog rules with `#blog`.** It's the blog's `<body>` id: `#blog article`, `#blog .wp-sidebar h3`. It keeps blog fixes off the main site, and main-site rules that rely on `.homepage` or `/styles/global.css` won't reach the blog anyway.
3. **Expect different defaults.** With no `/styles/global.css` and the theme's own `app.css` in play, spacing, headings and forms can look different on the blog even with the same `home.css`. Rules written for `.pageContent` don't match the blog's `#pageContent`. Check with `npm run dbg -- why "#blog <selector>" <property>`.
4. **Icons:** both Font Awesome 3 (`icon-*` classes) and the newer `fa fa-*` classes are loaded on the blog, so blog markup may use either.
5. **Turn off the live dealer CSS when you work on the blog.** The usual strip pattern `//assets.interactcp.com` doesn't match the blog's `//assets-cdn.interactcp.com` URLs, so on blog pages the **deployed** `home.css` stays on underneath your local one, and an old rule can seem to "win" for no reason. Switch it off while you're there:
   ```bash
   npm run css -- off "//assets-cdn.interactcp.com/<dealer>/css/*"
   npm run css -- list        # the dealer's _default.css / _client.css should now show "off"
   ```
   Use the dealer's folder name from `npm run css -- list`, so the shared `interactrv/` platform files stay on. `npm run css -- reset` puts things back.
6. **Check blog pages separately** after any global change (header, footer, typography): at least the blog index (`/blog/`) and one post, at phone and desktop widths:
   ```bash
   npm run dbg -- eval "location.href='/blog/'"
   npm run dbg -- crop "#pageContent" --at 375,1200
   ```

---

## Quick reference: what you can rely on

| Need | Use |
|---|---|
| Layout | Bootstrap 3 grid, or `display: flex` in `home.css` (house rule) |
| Show/hide by screen size | `visible-xs`, `hidden-sm`, … or media queries at 768 / 992 / 1200 |
| Toggle a panel | `data-toggle="collapse" data-target="…"` + a `.collapse` element |
| Slideshow in content | Bootstrap 3 `carousel` |
| Icons | `<i class="fa fa-…"></i>` |
| Dealer info in markup | [Shortcodes](cms-shortcodes.md) |
| Brand colors | `--primary-bg-color`, `--secondary-bg-color`, … in `:root` at the top of `home.css` |
| Scope to the homepage / blog | `.homepage …` / `#blog …` |
| JavaScript | Last resort only (see [AGENTS.md → Fix Priority](../AGENTS.md#fix-priority)). Remember jQuery 1.8.3. |
