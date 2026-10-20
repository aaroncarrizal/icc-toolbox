# AI Search widget

How to add the AI Search widget to a dealer's homepage hero, make the header **Search** button work on mobile once it's in, and fix the problems that come up most.

The markup lives in [`snippets/ai-search-assistant/`](../snippets/ai-search-assistant/). The toolbox never edits the CMS: you build and preview here, then paste into the CMS yourself.

---

## What the widget is

On the homepage hero, visitors get two ways to search:

| Part | Where it comes from | What it does |
|---|---|---|
| **Filters / AI Search tabs** | CMS snippet **527811** | Switch between the classic filter form and the AI prompt |
| **Filter form** | The dealer's **existing** hero RV search snippet | Year / Type / Length / … selects and the Search button |
| **AI widget** | CMS snippet **527812** | "Describe your ideal RV…" prompt and suggestion chips |
| **Mobile AI button** | CMS snippet **531601** | Phone/tablet entry point to `/search-assistant` |

The tabs work by putting a class on `<html>`: `search-mode-ai` or `search-mode-filters`. The site's own AI search CSS shows or hides the filter form and the AI widget from that class.

---

## Adding it to a dealer

### 1. Keep a copy of the current search

Before changing anything, copy the dealer's current hero search markup from the CMS into `snippets/ai-search-assistant/original-search.html` on the dealer's branch. It's your rollback if something goes wrong. (The file is empty on `master` on purpose.)

### 2. Build the hero markup

Start from [`ai-widget.html`](../snippets/ai-search-assistant/ai-widget.html):

```html
<div class="search-toggle-wrapper">
    <!-- macro: Snippet 527811 (tabs) -->
    <div class="collapse home-hero-search">
        <span class="h2 heading">RV Search</span>

        {{PLACE EXISTING SITE HERO RV SEARCH SNIPPET HERE}}
    </div>
    <!-- macro: Snippet 527812 (AI widget) -->
</div>
```

Replace `{{PLACE EXISTING SITE HERO RV SEARCH SNIPPET HERE}}` with the dealer's existing hero search snippet (what you saved in step 1). Leave the two `umb-macro-holder` blocks exactly as they are: they're how the CMS inserts snippets 527811 and 527812.

### 3. Add the mobile AI button

[`mobile-ai-button.html`](../snippets/ai-search-assistant/mobile-ai-button.html) only shows on phones and tablets (`visible-xs visible-sm`). Put it in the homepage content where the mobile AI entry point should appear.

### 4. Paste into the CMS

Paste the markup in the editor's **source/HTML view**, so the macro holders arrive intact. Then check the live homepage with the injector running:

```bash
npm run dbg -- select "#topSearchForm"     # should be exactly 1
npm run dbg -- crop ".search-toggle-wrapper" --at 375,768,1200
npm run dbg -- errors
```

Click both tabs in the injector's Chrome window and make sure each mode shows the right thing.

---

## Fix: header Search button doesn't open the mobile panel

Once a dealer has the AI widget, the header **Search** button on mobile opens a separate panel, `.top-search-mobile`. It needs two CSS fixes to work everywhere, including on `/rv-search` and `/search-assistant`. Full background in [`mobile-search-fixes.md`](../snippets/ai-search-assistant/mobile-search-fixes.md).

**Markup it expects** (header): the button targets `#top-search-container .top-search-mobile`, and the panel **must** have the `collapse` class, or it's never hidden in the first place.

```html
<button type="button" class="btn btn-primary pull-right" data-toggle="collapse"
    data-target="#top-search-container .top-search-mobile">
    <span class="sr-only">RV Search</span><i class="fa fa-search" role="presentation"></i> Search
</button>

<div id="top-search-container" class="subpage-search" role="search">
    <div class="container">
        <div class="collapse top-search-mobile">
            <span class="h2 heading">RV Search</span>
            <div role="form" id="topSearchFormMobile" class="SearchPanel form-inline">…</div>
        </div>
    </div>
</div>
```

### Fix 1: the mobile form lost its styling

The dealer's theme styles the mobile form through `.top-search`. Now that the panel is `.top-search-mobile`, those rules no longer match.

1. Find the dealer's own `.top-search` rules that apply below 992px:
   ```bash
   npm run dbg -- rules ".top-search select"    # on a page that still has the old .top-search markup
   ```
   The `origin` of each rule shows the file it comes from.
2. Copy those rules to the end of `styles/home.css` with the selector changed from `.top-search` to `.top-search-mobile`. Keep the declarations exactly as the dealer has them, not another dealer's values.
3. Leave the original `.top-search` rules alone. Desktop still uses them.

### Fix 2: the panel doesn't open on `/search-assistant`

That page ships its own CSS that hides `#top-search-container`, so the button opens the panel inside a hidden box. Show the container while the panel is open, on mobile/tablet only:

```css
/*
=====
Mobile Search Panel
=====
*/
@media (max-width: 991px) {
    #top-search-container:has(.top-search-mobile.in, .top-search-mobile.collapsing) {
        display: block;
    }
}
```

- **Keep `.collapsing`.** During the open/close animation Bootstrap uses `.collapsing`, not `.in`. Without it the panel measures 0px, then pops open with no animation.
- **No `!important` needed.** The ID plus `:has()` already beats the page's rule.
- **Different background on `/search-assistant`?** The theme may set the container's background only under `.homepage`. Compare `npm run dbg -- rules "#top-search-container"` on both pages and copy the dealer's value into this rule.

### Check it

On `/`, `/rv-search` and `/search-assistant`, at phone width (`npm run dbg -- bp xs`, then `bp sm`): tap the header Search button in the injector's window. The panel should slide open smoothly on all three pages. Run `npm run dbg -- bp reset` when you're done.

---

## Other problems that come up

| Symptom | Cause | Fix |
|---|---|---|
| The visible Search button in the hero does nothing | The hero macro renders **two** `id="topSearchForm"` elements. The site's script binds to the first one, a hidden leftover button, so the visible button gets no handler. | `npm run dbg -- select "#topSearchForm"`. If the count is 2, fix the markup so only the real filter form has that id. |
| AI mode shows nothing at all | The wrapper around the widget has `id="topSearchForm"`, and the site hides `#topSearchForm` in AI mode, taking the widget with it | Don't give the outer wrapper that id. Until the markup is fixed: `html.search-mode-ai #topSearchForm:has(> .search-toggle-wrapper){display:block!important}` |
| The filter form never shows | The dealer's theme hides `.home-hero-search` | `.search-toggle-wrapper .home-hero-search{display:block!important}` (confirm with `npm run dbg -- why ".search-toggle-wrapper .home-hero-search" display`) |
| The last filter + Search button wrap onto a second line on desktop | Bundled CSS makes the form and rows `inline-block` | Force one line, `!important` required: form `display:flex !important; flex-wrap:nowrap`, each row `flex:1 1 0 !important` |
| The AI button, input border and sparkles icon are dark gray | They use `--ai-search-bg-color`, which falls back to `#333` | Set it once in `:root` in `home.css`, e.g. `--ai-search-bg-color: var(--primary-bg-color);` |
| "The header Search button doesn't switch to AI mode" | That's expected: it only opens/closes the panel. It isn't a Filters/AI tab. | Nothing to fix |

Whatever you add goes at the end of `styles/home.css` under a section comment, following the [CSS style rules](../AGENTS.md#css-style-rules).
