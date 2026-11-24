---
name: start-build
description: Start a dealer homepage build from a mockup. Use when the user gives a Figma link or a mockup image for a dealer site that is already set up (or types /start-build). Copies the site's CMS snippets and dealer CSS into the repo, commits them, reads the mockup, rewrites the snippets to match it, publishes the HTML to the CMS (after the user confirms), then styles and refines home.css at every breakpoint.
---

# Start a Build From a Mockup

Input: a **mockup** (Figma link or image) for a dealer whose branch already exists. If the branch doesn't exist yet, run `/set-up` first. If there's no mockup, ask for it.

The phases below run in order. Each one ends with something you can show the user, and the first two end with a commit. **Don't publish anything to the CMS without a yes from the user in this conversation.** Commit only at the points listed, or when the user asks.

Throughout: follow **Fix Priority**, **CSS Style Rules** and **CMS Shortcodes** in AGENTS.md, and the memories about clamp font sizes and asking for font specs.

## 0. Preflight

1. `git branch --show-current` is the dealer branch and `git status --porcelain` is clean.
2. Read `.cssinjector.json` → the build URL (e.g. `https://<site>.builds.interactrv.com/`) and auth.
3. **Only one injector may run.** List node processes running `css-injector`. If one is already running, reuse it and don't start another. Two injectors fight over the same tab and re-apply stale CSS. If you start `npm run dev` yourself, remember its PID: stopping the npm task can leave the node child alive, so kill the PID when you're done.
4. Ask the user for anything you can't find: the image CDN folder (e.g. `/<dealer>/images/home`) and the mockup if it isn't attached.

## 1. Copy the CMS snippets locally

Until the `cms` tool exists (see `specs/005-cms-sync/proposal.md`), use the Chrome extension on the user's CMS session.

1. Open `https://www.interactcp.com/manage` in a **new tab** and read `#ddlAsAccount`'s selected option. It must be the dealer. **Impersonation is session-wide.** If it shows another dealer, ask before switching: switching changes every CMS tab the user has open.
2. Open `/manage/Site`. The editor is Umbraco under `/rebraco`, inside an iframe. Run every request through the iframe's `fetch` (it has the session cookies):
   - Tree: `GET /rebraco/ContentTree/GetNodes?id=<id>&application=content`. Start from the account root (the iframe hash `#/content/content/edit/<rootId>` gives the id).
   - Node: `GET /rebraco/Content/GetById?id=<id>`. Strip the `)]}',` prefix, then read `tabs[].properties[]`. Snippets keep their markup in `content` and their footer scripts in `pageFooterScripts`. Pages keep theirs in `bodyContent` and `pageFooterScripts`.
3. **An account can hold several domains** (e.g. `kehoerv.builds…` and `kehoerv-2.builds…`). Use the domain node whose name matches the URL in `.cssinjector.json`, and confirm it by curling the homepage and matching the section order.
4. The extension blocks returned text that contains URLs or base64. Don't work around that filter. Instead, build one JSON bundle in the page (`{domain, snippets: {"<path>": {id, content, footerScripts}}, home: {body, pageFooterScripts}}`, walking the `snippets` folder recursively), then download it as a single `Blob` file. Chrome may ask to allow the download; tell the user to accept it, and look for `.crdownload` leftovers.
5. Split the bundle into `snippets/<path>.html` (e.g. `header/header.html`, `sections/home-hero/home-hero.html`). Add `<path>-footer-scripts.html` when footer scripts aren't empty, plus `snippets/pages/home.html` and `pages/home-footer-scripts.html`. Keep the node IDs: macros reference them as `Snippet="<id>"`.
6. Commit: `chore: export <site> build snippets from CMS`.

## 2. Copy the dealer CSS locally

`styles/home.css` **is** the dealer's `<id>_default.css`. In the CMS it lives on the **domain node** (e.g. `kehoerv.builds.interactrv.com`), **CSS** tab. The site head HTML, where Google Fonts links go, is on the same node's **Developer** tab. Find it with `grep '_default.css\|_client.css'` on the curled homepage, then `curl` both files into `styles/home.css`. They're public on `assets.interactcp.com`, so don't send auth to that host. Or use what the user pastes. Watch for a typo'd file name such as `home..css`, and rename it.

- Turn the live copies off while you work, either with `npm run css -- off "*assets.interactcp.com/<dealer>/css/*"` (state file only) or with `stripPatterns` in the config. Otherwise the old rules keep overriding yours.
- The pasted file may use CRLF line endings. Normalize before doing string replacements.
- Commit: `chore: add <site> dealer CSS`.

## 3. Read the mockup

**Figma link.** If the Figma MCP is authorized, use it. Otherwise open the link in a new tab with the Chrome extension:

- Layers panel → click a frame → `Shift+2` zooms to it. `Ctrl+click` deep-selects a text layer. `Tab` and `Shift+Tab` move between siblings. Opening `?node-id=<id>` jumps straight to a node.
- The **Design** panel shows text style names that already encode size and line height, e.g. `Text md/Bold · 16/24`. Mixed-style text: select the layer, press `Enter`, double-click a word, read the panel, then `Esc` twice. Never type while in edit mode.
- **Font families** come from **Variables → Typography**. Read the column whose name matches the mode badge on the page frame (e.g. "Serif/Sans 1"): `type/family/display`, `body`, and the size/leading scale. This view is real page text, so `get_page_text` and screenshots both work.
- Colors come from **Variables → Foundations** and from each layer's fill.
- **Never press Shift+D.** Without a Dev Mode seat it sends the team's admins an access reminder.
- Don't open a style editor and change anything. Read only.

**Image mockup.** Measure layout and colors from the image, but ask the user for every font's family, weight, size and line height (memory: ask for font specs).

Write down the section order, each text element's style, and the colors before touching any file.

## 4. Images

When the user gives an image folder: `npm run img:png -- <folder>` (only if JPG/WebP must become PNG), then `npm run img:compress -- <folder>/png` (or the folder itself). Check for files without an extension first. Ask the user for the upload path, save it as a project memory, and `curl` a few files to confirm they're uploaded before you use the URLs.

## 5. Rewrite the snippets to match the mockup

- Edit the local files. Keep the macro holders exactly as they are (`<div class="umb-macro-holder mceNonEditable"><!-- <?UMBRACO_MACRO … /> --><ins>…</ins></div>`).
- Nest snippets instead of duplicating them (e.g. the hero includes the types bar and tow guide with `Snippet="<id>"`), and update `pages/home.html` to the mockup's section order.
- CMS-safe markup: no block elements inside `<a>` (use `span`); full CDN image URLs; shortcodes for dealer data; `title` attributes on logos, phone links and directions links.
- **Types bar:** follow the `types-bar-product-links` memory: `/product/<slug>`, `/product/<slug>/new`, `/product/<slug>/used`. Check each slug's page `<title>`.
- A section that has no snippet needs a new node. Ask the user to create it in the CMS, or give them the markup.
- Show the user the changes and the open questions (missing IDs, hardcoded values like a fax number). Don't commit yet unless they ask.

## 6. Publish the HTML to the CMS (needs a yes)

List the nodes you'll overwrite and ask. Once the user agrees:

1. Check the impersonated account again (step 1.1).
2. For each node, in the CMS tab: set the iframe hash to `#/content/content/edit/<id>`, then wait until `input[name="headerName"]` equals the node name, the page shows the right domain, and exactly one *initialized, attached* TinyMCE editor exists whose id starts with `<alias>_` (`content` or `bodyContent`). Stale editors linger after navigation, so filter by `document.body.contains(editor.getContainer())`. Then call `editor.setContent(html)`, fire `change`, call `save()`, and click the visible **Save and publish** button.
3. **Small edits:** read the stored value with `GetById` and string-replace in the page instead of retyping long markup. This avoids typos in SVG paths and macro parameters.
4. Run one node per tool call. Several in one call can hit the 45-second limit.
5. Verify each one: `GetById` shows the new value with the same `UMBRACO_MACRO` count, then `curl` the homepage (add `?nocache=$RANDOM`) and check the text renders and **there's no `An error occurred while rendering the macro`**.
   - `ImageRotator` items need a numeric `assetId` (`0` works). `null` breaks the whole rotator.
   - `curl` every rotator `imgUrl`. Old slides often 404.
6. Close the CMS tab when you're done.

The direct `contentResource` and `$http` calls fail from outside Angular. Use the editor flow above.

## 7. CSS

1. **Clean up first.** Delete homepage sections whose markup is gone (old hero, cards, welcome, types bar, the old footer, earlier "build" override blocks). Keep internal-page CSS (tow guides, testimonials, parts, compare, gallery, forms, utility classes) and base header/nav rules you still override. Keep a backup in the scratchpad.
2. **Add new sections at the end of `home.css`**, one section comment each, scoped selectors, flex, brand variables, and `clamp()` from `npm run clamp -- <px>` for every font size, with unitless line heights.
3. **Fonts:** the site loads only Roboto, and `home.css` can't `@import`. Declare the mockup families with fallbacks (`"Poppins", "Roboto", sans-serif`), then give the user the Google Fonts `<link>` HTML (only the weights used) to paste into the site head (domain node → **Developer** tab). Confirm the fonts loaded with `document.fonts` once it's live.
4. **Content width:** measure it from the mockup (the frame is usually 1600 px wide). Override the site's 1570 px `.container` per section with `width: 100%; max-width: <content + 30px>`.
5. **Check:** `npm run dbg -- batch` with `crop "<section>" --at 1600`, `why` for anything that doesn't take, `errors`. Cross-origin iframes such as YouTube show blank in screenshots, so check them with `box` instead.

## 8. Refine

- **Text audit:** read the computed `font-family`, `font-weight` and `font-size/line-height` of every text element at 1920 px (where `clamp` hits its max) with one `dbg eval`, and compare against the Figma specs. Fix the mismatches.
- **Responsive:** `crop` every section `--at 375,768,992,1200,1600`. Typical fixes:
  - header text wrapping (`white-space: nowrap`, smaller logo, hide secondary logos below 1200)
  - flex children that won't shrink (`min-width: 0`, and give the list `width: 100%` when its parent centers it)
  - videos that get too tall when stacked
  - nav wrapping at 992 once the real fonts load
- **Internal pages:** screenshot one internal page (e.g. `/rv-service`) to check that the header, nav and footer still work there.
- Report to the user:
  - what changed in which layer (Fix Priority)
  - the estimated values (anything you couldn't read from the mockup)
  - CMS work still open for them (font link, new nodes, media-picker items)
- Commit when the user asks: `feat: style <site> homepage from mockup`.
