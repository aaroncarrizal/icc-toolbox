# icc-toolbox

A collection of small CLI tools that speed up ICC dealer-site development. Each tool lives in its own folder under `src/tools/`:

| Tool | Folder | Commands |
|---|---|---|
| CSS injector + debug CLI | `src/tools/css-injector/` | `npm run dev`, `npm run css`, `npm run dbg` |
| px unit converters | `src/tools/units/` | `npm run clamp`, `npm run vw`, `npm run vh` |
| Image format converter | `src/tools/image-convert/` | `npm run img:png` |

Code shared by more than one tool goes in `src/shared/`; a tool never imports from another tool's folder.

**Branches:** `master` is the toolbox itself. Each dealer gets an independent branch cut from `master` (via `/set-up`) that is never merged back or updated from `master` — it keeps the toolbox version it was created with.

## Image converter

```bash
npm run img:png -- ./path/to/images           # .jpg/.jpeg/.webp → ./path/to/images/png/*.png
npm run img:png -- ./path/to/images --force   # overwrite PNGs that already exist
```

Originals are kept; only files directly in the folder are converted.

## CSS injector

A CLI tool that injects local CSS files into any published website with instant hot reload, and lets you switch individual CSS sources — your own files or the site's own stylesheets — on and off while the page stays open. It launches Chrome directly (no browser-automation framework) and talks to it only through one page's own Chrome DevTools Protocol (CDP) connection, so opening DevTools alongside it never causes trouble.

## Requirements

- [Node.js](https://nodejs.org/) 24 or newer (it runs the TypeScript in `src/` directly, no build step needed for day-to-day use)
- Google Chrome installed

## Quick Start

```bash
npm install
cp .cssinjector.example.json .cssinjector.json
# edit .cssinjector.json and set "url" to your target site
npm run dev
```

## Config

Config is loaded from `.cssinjector.json` in the project root. CLI flags on `npm run dev` (`--url`, `--dir`, `--include`, `--exclude`, `--headless`, `--strip-patterns`, `--username`, `--password`) override it.

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

| Key | Meaning |
|---|---|
| `url` | Target site to open |
| `dir` / `include` / `exclude` | Where your CSS files live and which ones to load |
| `headless` | Run Chrome headless |
| `stripPatterns` | Remote stylesheet href patterns disabled by default (`*` wildcard), e.g. `"//cdn.example.com/*.default.css"` |
| `username` / `password` | HTTP Basic Auth, sent only to the site's own origin |
| `chromePath` | Override Chrome's install location (auto-detected otherwise) |
| `scripts` / `jsDir` / `jsInclude` | Opt-in JS injection (off by default) — see "How it works" |

## Commands

### `npm run dev`

Launches (or reuses) Chrome with a dedicated debugging profile, opens the target site, and injects your CSS. Watches `styles/` (and `scripts/`, if `scripts` is enabled) for changes and hot-reloads them with no page reload.

### `npm run css -- <command>`

Toggle sources on and off live, without touching a file:

```bash
npm run css -- list              # show every local file and remote stylesheet, on/off
npm run css -- off home.css      # disable one local file
npm run css -- on home.css       # re-enable it
npm run css -- solo header.css   # disable every other local file
npm run css -- remote-off-all    # see the page with none of the site's own CSS
npm run css -- reset             # back to config defaults
```

### `npm run dbg -- <command>`

A debugging toolkit for the live page — screenshots, computed styles, CSS cascade inspection, viewport emulation, and HTML previews:

```bash
npm run dbg -- screenshot                    # save a viewport screenshot to ./debug/
npm run dbg -- why ".header" color           # which rule wins, and where it's defined
npm run dbg -- bp md                         # emulate a Bootstrap "md" viewport
npm run dbg -- replace ".hero" "<div>...</div>"  # preview an HTML change (undo with `restore`)
```

Run `npm run dbg -- help` for the full command list.

## How It Works

- CSS injection happens at **document start**, before the page's own content paints — via `Page.addScriptToEvaluateOnNewDocument`, re-applied on every navigation — so there's no flash of unstyled content and no reload needed on save.
- Each local CSS file gets its **own `<style>` tag**; the site's own `<link>` stylesheets are toggled with `link.disabled` rather than removed, so nothing is destroyed and everything can be switched back on. `npm run css` and the injector share one small state file (`.cssinjector.state.json`) to keep this in sync live.
- Every tool in this repo — the injector and both CLIs — connects to Chrome only through **one page's own CDP websocket**, never the browser-level websocket. That's what lets you open Chrome DevTools on the same tab at any time without interference.

## Development

```bash
npm run typecheck   # type check
npm run build        # bundle the injector with Vite
npm start             # run the built version
```

## Dependencies

- [Chokidar](https://github.com/paulmillr/chokidar) — file watching
- [Fast Glob](https://github.com/mrmlnc/fast-glob) — file matching
- [Commander](https://github.com/tj/commander.js) — CLI parsing
- Chrome DevTools Protocol, via a minimal client in `src/tools/css-injector/cdp.ts` built on Node's built-in `WebSocket` and `fetch` — no browser-automation dependency
