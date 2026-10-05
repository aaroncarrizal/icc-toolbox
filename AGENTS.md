# AGENTS.md

This file provides context for AI agents working on icc-toolbox (formerly CSS Injector).

## Project Overview

icc-toolbox is a single npm package holding several small CLI tools that speed up the ICC dealer-site dev cycle. Each tool lives in its own folder under `src/tools/` (see **Toolbox Layout** below). Current tools:

| Tool | Folder | Commands |
|---|---|---|
| CSS injector + debug CLI | `src/tools/css-injector/` | `dev`, `css`, `dbg`, `build`, `start` |
| px unit converters | `src/tools/units/` | `clamp`, `vw`, `vh` |

The main tool, the CSS injector, launches the system's Google Chrome with a dedicated debugging profile, injects local CSS files into a target site's page at document start (before the page's own content paints, so there's no flash of unstyled content), and hot-reloads whenever a CSS file changes on disk. Each local file gets its own `<style>` tag, and both local files and the site's own `<link>` stylesheets can be switched on and off live while the page is open. All of this — the injector, the source toggling and the debug CLI — talks to Chrome only through the **page-level** Chrome DevTools Protocol (CDP): every connection is opened directly to one page's own websocket, never to the browser-level websocket. That's deliberate — see **Rules for working on this tool** below.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Run the injector (launches/reuses Chrome, navigates to the URL, injects CSS, watches for changes) |
| `npm run css -- <command>` | Toggle local files and remote stylesheets on/off while the page is open |
| `npm run dbg -- <command>` | Debug CLI: screenshots, computed styles, CSS cascade inspection, viewport emulation, HTML preview |
| `npm run clamp -- <px>` / `npm run vw -- <px>` / `npm run vh -- <px>` | Convert a pixel size to a `clamp()`/`vw`/`vh` value against a 1920×1080 base |
| `npm run build` | Build with Vite |
| `npm run typecheck` | TypeScript type checking |
| `npm start` | Run the built version |

## Toolbox Layout

```
src/
├── shared/            # code used by 2+ tools (empty until a second tool needs something)
└── tools/
    ├── css-injector/   # injector, `css` and `dbg` CLIs
    └── units/          # clamp / vw / vh converters
```

- **One folder per tool**, `src/tools/<name>/` (kebab-case), with its own entry point(s), its own config file if it needs one, and its own section in this file.
- **A tool may import from `src/shared/` but never from another tool's folder.** If two tools need the same code, move it into `src/shared/` instead of cross-importing.
- **Existing npm script names are a stable interface** — don't rename them. New tools get namespaced scripts, e.g. `img:png`, `img:compress`.
- Dealer working files (`styles/`, `scripts/`, `snippets/`, `debug/`, `.cssinjector*.json`) stay at the repo root and belong to the CSS injector.
- Adding a tool = a new folder under `src/tools/`, a new script in `package.json`, a new section here.

## Branches: Toolbox vs. Dealers

This repo is a toolbox for building, fixing and migrating many **independent** dealer sites.

- **`master` is the toolbox**: tools, skills, docs. Toolbox changes are made on a feature branch and merged into `master` only.
- **Each dealer gets its own branch**, cut from `master` by `/set-up`, holding only that dealer's site work (`styles/`, `scripts/`, `.cssinjector.json`).
- **Dealer branches are never merged** — not into `master`, not into each other, and they don't pull later `master` changes. An existing dealer branch keeps the toolbox version it was cut with; new toolbox features reach a dealer the next time a branch is cut from `master`.
- Never commit dealer-specific work to `master`, and never suggest merging `master` into a dealer branch.

## Fix Priority

Try fixes in this order, and say in the final report which layer a fix landed in (and why, if it wasn't CSS):

1. **CSS** in `styles/home.css` — the default. Follow **CSS Style Rules** below.
2. **HTML** — when markup itself has to change (an element is missing, nested wrong, or needs a new attribute). Preview the change live with `dbg replace` / `dbg inner` (see below), confirm it looks right, then hand the user the final markup to paste into the CMS — this tool never edits the CMS itself.
3. **JS** — last resort, only when CSS and HTML genuinely can't do it (e.g. a broken third-party script, a site bug that needs a workaround). Requires `"scripts": true` in `.cssinjector.json` (default `false`); files go in `scripts/`. Must be a guarded IIFE, idempotent (it runs at document-start **and** may re-run on hot reload), and must not assume jQuery or the DOM exist yet — `window.jQuery` is undefined at document-start even on jQuery-using sites.

## CSS Style Rules

1. **Always use `styles/home.css`.** Every CSS change goes in this one file — don't create new CSS files.
2. **Add all new changes at the end of `home.css`.** Don't insert new rules into existing sections higher up, even if a related section exists.
3. **Never import anything in `home.css`** — no `@import` of stylesheets, fonts or anything else. Use fonts and assets the site already loads.
4. **Start each new section with a section comment:**
   ```css
   /*
   =====
   Section Name
   =====
   */
   ```
5. **Never add inline comments.** The section comment above is the only comment allowed.
6. **Keep selectors simple and scoped to their section.** Always start the selector from the section the element lives in — a homepage section class (`.home-hero`, `.home-search`, `.home-welcome`) or a parent element's id (`#site-header`, `#site-footer`) — then go straight to the target: `.home-hero h2`, `#site-header .logo img`. No long descendant chains or stacked classes added "just in case". Write it the way a person would by hand. If `dbg why` shows the scoped selector loses, add one level of specificity, not five.
7. **Prefer `display: flex`** for layout — over floats, `inline-block`, `table` or grid — unless a different layout is clearly better.
8. **Use the existing brand color variables** instead of hardcoded hex values: `--primary-bg-color`, `--secondary-bg-color`, `--tertiary-bg-color`, `--accent-bg-color` and their matching `-text-color` / `-hover-color` variables, defined in `:root` at the top of `home.css`. Hardcode a color only when no variable matches.
9. **No `text-decoration: underline` on link hover** unless the user asks for it. Every `a:hover` (and `a:focus`) rule uses `text-decoration: none`.

## Fast Fix Loop

The default workflow for a style request — resolve the element, understand *why* the current CSS looks the way it does, try a fix live, then commit it to a file:

```
npm run dbg -- batch <<'EOF'
find "Reviews"
box ".reviews"
why ".reviews img" width
preview ".reviews img{width:320px}"
crop ".reviews" --at 375,1200
preview --save styles/home.css
EOF
```

`preview --save` appends to the end of the file, which satisfies the "new changes at the end" rule — but it does not add a section comment, so add one before the saved block when it starts a new section.

- **Run `why` before writing an override.** `dbg why <selector> <property>` names the winning rule, its specificity, and where it comes from (`styles/<file>:<line>` for our own CSS, a URL for the site's remote CSS, `inline <style>:<line>` for the page's own embedded `<style>` blocks). That tells you whether the new rule needs `!important`, a more specific selector, or nothing at all — instead of guessing and re-checking.
- After saving, check the injector's own terminal output for `WARNING <file>:<line> invalid declaration` (a typo like `widht:` that Chrome silently drops), and run `npm run dbg -- errors` if the page itself looks broken — it surfaces console errors/exceptions and failed network requests.
- A screenshot URL in a request (e.g. a prnt.sc link) is only a visual hint — always resolve the real element with `find`/`box` before styling anything.
- `dbg batch` runs several commands over one connection and prints one JSON line per command as it completes, so a whole investigation is one tool call instead of many.

## Toggling CSS Sources

`npm run css -- <command>` edits `.cssinjector.state.json` (gitignored); the running injector watches that file and applies changes live, with no reload:

| Command | Effect |
|---|---|
| `list` | Show every local file and remote stylesheet, on or off |
| `off <file\|pattern>` / `on <file\|pattern>` | Disable/enable one local file (by id, e.g. `home.css`) or one remote href pattern (`*` wildcards allowed) |
| `solo <file>` | Disable every local file except this one |
| `remote-off-all` / `remote-on-all` | Disable/enable every remote stylesheet — see the page with none of the site's own CSS |
| `reset` | Back to the config defaults (`stripPatterns`) |

Use this to answer "is this bug caused by our CSS or the site's?": `css solo <file>` (or `css off <file>`) to isolate our own styles, then `css remote-off-all` to rule the site's CSS in or out entirely. `.cssinjector.state.json` can also be edited directly — it holds `disabledLocal`, `disabledRemote` and `viewport`.

## Debug CLI Reference (`npm run dbg`)

Connects directly to the site tab's own page websocket — see **Rules for working on this tool**. Every command takes `--pretty` for indented JSON.

| Command | Output |
|---|---|
| `find <text> [limit]` | Deepest elements containing the text, each with a suggested selector + box + text preview |
| `box <selector>` | Box model, layout (display/flex/max-width/text-align) and the 6-level ancestor chain |
| `why <selector> <property>` | Which rule wins for that property, its specificity and origin (`file:line`), the overridden/invalid rules, and an inherited-from fallback |
| `rules <selector> [--ua]` | Every matched rule for the element, strongest first, with origin and declarations (`--ua` includes user-agent default rules) |
| `styles <selector> [--all]` | Curated computed-style properties by default (layout/box/font/color); `--all` for the full computed style dump |
| `select <selector>` | Per-element info: tag, classes, visibility, opacity, bounding box |
| `outline [selector\|reset]` | Red outline overlay on matches (or every element) + screenshot |
| `check <selector> [widths...]` | Per-width (default: all Bootstrap breakpoints) display/visibility/box/inViewport |
| `screenshot [path]` / `fullpage [path]` | Screenshot the viewport / whole page |
| `crop <selector> [path]` | Screenshot just one element |
| `html [selector]` | outerHTML of an element, or the whole page |
| `eval <expression>` | Evaluate JS in the page and return the JSON result |
| `preview <css\|@file\|reset>` | Apply/replace/clear a persistent `<style id="debug-preview">` on the page |
| `preview ... --save <path>` | Append the current preview CSS to a file inside `styles/`, then clear the preview — what was tested is exactly what gets saved |
| `set <selector> <prop> <value>` | Append one declaration to the preview stylesheet |
| `replace <selector> <html\|@file>` | Preview an HTML change (replaces outerHTML; backs up the original) |
| `inner <selector> <html\|@file>` | Same, but replaces only innerHTML |
| `restore [selector]` | Undo `replace`/`inner` (all of them, or just one selector) |
| `bp <xs\|sm\|md\|lg\|xl\|xxl\|reset> [height]` / `resize <width> [height]` | Set (or clear) the emulated viewport — persists across navigations until `bp reset`, because it's stored in the state file and applied by the injector's own session |
| `errors [--clear]` | Console errors/warnings, uncaught exceptions and failed/4xx+ network requests since the last navigation |
| `batch [@file]` | Run several of the above over one connection (or pipe them via stdin), one JSON line per command |

Screenshots (`screenshot`/`fullpage`/`crop`/`outline`) save to `./debug/` as JPEG, quality 70, downscaled to at most 1280px wide by default — pass `--png` for lossless or `--full-res` to skip the downscale, and `--at 375,768,1200` to capture one image per width in a single call.

## Auto-Debug Workflow

When the user says "help me debug X" (where X is a CSS selector), run one batch call covering `styles`, `select`, `why` (for whichever property is actually in question), and `outline`:

```
npm run dbg -- batch <<EOF
styles "X"
select "X"
why "X" <property>
outline "X"
EOF
```

Explain the findings (computed styles, bounding box, visibility, which rule wins and from where), then **ask for permission** before applying any fix.

## Architecture

```
src/
├── shared/                    # code used by 2+ tools (currently empty)
└── tools/
    ├── css-injector/
    │   ├── index.ts        # CLI entry point (commander). Launches/reuses Chrome, connects Cdp to the
    │   │                    # site tab, sets up basic auth + console/network capture, syncs CSS/JS at
    │   │                    # document-start, watches styles/, scripts/ (opt-in) and the state file.
    │   ├── config.ts        # Config type, defaults, and .cssinjector.json loading.
    │   ├── chrome.ts         # Finds and spawns the system Chrome with a dedicated --user-data-dir
    │   │                    # (required: Chrome 136+ ignores the debug port on the default profile),
    │   │                    # or reuses one already listening on the port.
    │   ├── cdp.ts            # Cdp: a minimal CDP client bound to ONE page's own websocket (never the
    │   │                    # browser-level websocket) — see Rules below.
    │   ├── injector.ts       # syncCss/syncJs (register + live-apply via Page.addScriptToEvaluateOnNewDocument
    │   │                    # and Runtime.evaluate), applyViewport, enableBasicAuth (Fetch-based).
    │   ├── page-runtime.ts   # The code that actually runs INSIDE the page: one <style> per local file,
    │   │                    # link.disabled toggling for remote sheets, a MutationObserver to reassert
    │   │                    # both against late-inserted site markup.
    │   ├── state.ts          # .cssinjector.state.json (disabledLocal/disabledRemote/viewport) — the
    │   │                    # single source of truth for live toggling, shared by the injector and CLIs.
    │   ├── sources.ts        # Reads local CSS/JS files as separate {id, content} entries.
    │   ├── watcher.ts         # Generic debounced chokidar watcher.
    │   ├── console-log.ts     # Captures console errors/exceptions/failed requests to debug/console.jsonl.
    │   ├── css-lint.ts        # CSS.supports()-based check for invalid declarations, logged as warnings.
    │   ├── css-cli.ts         # npm run css -- <command>
    │   └── dbg.ts             # npm run dbg -- <command>
    └── units/
        └── clamp.ts / vw.ts / vh.ts   # Standalone px → clamp()/vw/vh converters.
```

## Config

Config is loaded from `.cssinjector.json` in the project root (copy `.cssinjector.example.json` to start). CLI flags on `npm run dev` override config file values.

```json
{
  "url": "https://example.com",
  "dir": "./styles",
  "include": "**/*.css",
  "exclude": "",
  "headless": false,
  "stripPatterns": [],
  "username": "",
  "password": "",
  "chromePath": "",
  "scripts": false,
  "jsDir": "./scripts",
  "jsInclude": "**/*.js"
}
```

- `stripPatterns` — remote stylesheet href patterns disabled by default (before any `npm run css` toggling), `*` as a wildcard, e.g. `"//assets.example.com/*.default.css"`. This is a *default*, not a permanent strip — `npm run css -- on <pattern>` re-enables it live.
- `username` / `password` — HTTP Basic Auth credentials, answered only for the site's own origin (via a `Fetch.authRequired` handler) so they're never sent to a CDN or third-party request. Leave both `""` to disable auth.
- `chromePath` — override Chrome's install location; leave `""` to auto-detect.
- `scripts` — enables JS injection (see **Fix Priority**). Default `false`.
- `jsDir` / `jsInclude` — where JS files are read from when `scripts` is `true`.

## Rules for Working on This Tool

- **Connect only through `Cdp.connectToSite()` (or an already-open `Cdp` session) — a single page's own websocket, never the browser-level websocket, and never `Target.*` calls.** This is the fix for a real bug: the old Puppeteer-based version connected at the browser level and auto-attached to every target, including an open DevTools window's own frontend (itself a CDP target) — and attaching to it made it render a second, nested DevTools inside itself. A page-level connection cannot see or touch the DevTools frontend at all, so that failure mode is structurally impossible here. Don't reintroduce a browser-level connection (Puppeteer or otherwise) to "fix" something — there's almost certainly a page-level way to do it.
- Any function passed to `cdp.evaluate(fn, ...args)` runs **inside the page**, serialized to a string. It must be entirely self-contained — no references to anything outside the function, only its own parameters.
- CDP emulation (`Emulation.setDeviceMetricsOverride`, etc.) belongs to the connection that set it and disappears when that connection closes. A short-lived `dbg` command can't make a viewport change persist — that's why `bp`/`resize` write to the state file instead, and the injector's long-lived session applies it.
- The TypeScript in `src/` runs directly on Node (no build step for `npm run dev`/`dbg`/`css`): relative imports use an explicit `.ts` extension, type-only imports use `import type`, and the syntax stays "erasable" (no `enum`, no `namespace`, no constructor parameter properties).

## New Dealer Setup (`/set-up`)

When the user gives a dealer name and a build-site link (or types `/set-up`), follow the skill in [.claude/skills/set-up/SKILL.md](.claude/skills/set-up/SKILL.md). In short: slug the dealer name into a branch, create it from an up-to-date `master` and check it out, fill in `.cssinjector.json` (`url`, basic auth detected with `curl`, `stripPatterns` reset to `[]`), commit, and report back.

## Custom Forms (`/custom-forms`)

When the user asks to create a new lead form or update an existing one (fields, `FormType`, redirect, lead email routing), follow the skill in [.claude/skills/custom-forms/SKILL.md](.claude/skills/custom-forms/SKILL.md). In short: forms are configured by case-sensitive hidden inputs at the bottom of the form markup — `FormType` (ICC inbox label) and `AjaxTarget` (`/Forms/Ajax`, never edited) on every form, the default `RedirectUrl`/`SuccessMessage`/email-template fields, and optional `AccountOverRideEmail`. Custom questions use `jem[Group]_Field` names. Build new forms from a working form on the same site, preview with `dbg replace`, and hand the user the markup to paste into the CMS.

## List of Fixes Workflow

When the user provides a numbered list of CSS fixes/features to apply to the target site:

1. **Read the existing styles** – Read all CSS files in `./styles/` to understand current state.
2. **Process each item sequentially** – Start from item 1 and work through the list in order. For each item, follow **Fix Priority** and the **Fast Fix Loop** above; the resulting CSS goes at the end of `styles/home.css` (see **CSS Style Rules**).
3. **Commit each task separately** – After completing each item, commit with a message describing the fix (e.g., "fix: add hover to dealer logo on header"). Use `git add -A` and `git commit -m "..."`.
4. **Unresolvable issues** – If an issue cannot be resolved (missing element, unclear requirement, technical limitation), note it in the final report and move to the next item.
5. **Report** – After processing all items, report back with a summary of what was completed and any TODOs left behind.

## AI Search Assistant Snippets

`snippets/ai-search-assistant/` holds the reusable markup for embedding the AI-powered search widget into a dealer's homepage hero:

| File | Purpose |
|------|---------|
| `ai-widget.html` | The hero shell template: two Umbraco macro-snippet placeholders sandwiching a `.collapse.home-hero-search` div with a `{{PLACE EXISTING SITE HERO RV SEARCH SNIPPET HERE}}` marker — paste the dealer's existing search form snippet into that marker when building the widget into a new hero. |
| `mobile-ai-button.html` | A mobile-only (`visible-xs visible-sm`) macro-snippet holder for the AI widget's mobile entry point. |
| `original-search.html` | Placeholder for the dealer's original (pre-AI-widget) search form snippet, for reference/rollback. Currently empty — fill it in per-dealer when doing this migration. |
| `mobile-search-fixes.md` | CSS to make the header Search button open the mobile search panel (`.top-search-mobile`) on `/rv-search` and `/search-assistant`, and why each rule is needed. |

Gotchas for this widget:
- **Markup contract on new builds:** the AI widget's shell must **not** reuse `id="topSearchForm"` (use `.ai-search-shell` / `#topSearchFormDesktop` / `#topSearchFormMobile` instead), and its filter container must be **`.ai-search-filters`**, not `.home-hero-search`. Otherwise the site's own `html.search-mode-ai #topSearchForm { display:none }` rule hides the widget's own ancestor in AI mode, and any theme that hides `.home-hero-search` hides the whole filter form. A legacy build still nesting the widget inside a `#topSearchForm` shell needs `html.search-mode-ai #topSearchForm:has(> .search-toggle-wrapper){display:block!important}` plus `.search-toggle-wrapper .home-hero-search{display:block!important}` until migrated.
- **Duplicate `#topSearchForm`:** some hero macros render two elements with `id="topSearchForm"` — an outer shell (holding a hidden orphan Search button) and an inner one with the real filter selects and the visible Search button. The site's own script binds `$('#topSearchForm').find('.SearchButton')` to the *first* match, so only the hidden orphan gets a click handler and the visible button does nothing. Check with `dbg select "#topSearchForm"` (count should be 1) before assuming the button itself is broken.
- **AI accent color:** the AI submit button, input border and sparkles icon all read `var(--ai-search-bg-color, var(--primary-bg-color, #333))`. Set `--ai-search-bg-color` once to brand them; most builds leave it undefined and fall back to `#333`.
- The header **Search button** (`data-toggle="collapse" data-target=".top-search"`) only toggles panel visibility — it is not an AI-mode tab and doesn't switch between Filters/AI.
- Search-form rows: bundled CSS can make the form and its rows `display: inline-block`, letting the last row + button wrap to a second line. Force `display: flex !important; flex-wrap: nowrap` on the form and `flex: 1 1 0 !important` on each row (`!important` is required — the bundled rule already targets the same properties).

## Site Gotchas Worth Knowing

- **jQuery 1.8.3 aborts the rest of a ready-batch when one handler throws.** One unrelated bug (e.g. calling `.attr("name")` on an unnamed `:input`) can silently kill carousel/tab init elsewhere on the page with no visible error — check `npm run dbg -- errors` when something *else* on the page looks broken after a change that shouldn't have touched it.
- Bundled site CSS may ship `top: 7vh !important` on the hero at 992–1200px — an override needs `!important` too (confirm the actual winner with `dbg why`, don't assume).
- `--header-height` (site-defined) and any `--nav-height`-style variable this project defines are **not** the same value — check both before writing a formula that mixes them.
- Mobile dropdown double-tap: a bundled inline jQuery `hover` handler on `li.dropdown` adds `.open` on tap (via `mouseenter`), and Bootstrap's own click toggle then removes it in the same tap — net effect, it takes two taps to open. Fix via a sticky-touch `:hover` display rule instead of re-adding `.open` handling on mobile.
