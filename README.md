# icc-toolbox

Small command-line tools that speed up building, fixing and migrating ICC dealer sites. Everything runs with `npm run <command>` from the repo root.

| Tool | What it's for | Commands |
|---|---|---|
| [CSS injector](#css-injector-npm-run-dev) | Load your local CSS into the live dealer site with instant hot reload, no CMS round-trip | `npm run dev` |
| [Source toggling](#toggle-css-sources-npm-run-css) | Switch your files or the site's own stylesheets on and off while the page is open | `npm run css` |
| [Debug CLI](#debug-cli-npm-run-dbg) | Find elements, see which CSS rule wins and why, preview CSS/HTML changes, screenshots at any width | `npm run dbg` |
| [Unit converters](#unit-converters-npm-run-clamp--vw--vh) | Turn a px size from a mockup into `clamp()` / `vw` / `vh` | `npm run clamp`, `vw`, `vh` |
| [Image converter](#image-converter-npm-run-imgpng) | Convert `.jpg`/`.webp` to `.png` for upload | `npm run img:png` |
| [Image compressor](#image-compressor-npm-run-imgcompress) | Shrink images to at most 1 MB each, keeping their format | `npm run img:compress` |

**Contents:** [Install](#install) · [Daily workflow](#daily-workflow) · [Tools](#tools) · [Working with Claude Code](#working-with-claude-code-optional) · [Troubleshooting](#troubleshooting) · [Contributing](#contributing-to-the-toolbox)

---

## Install

### Requirements

| | Version | Check |
|---|---|---|
| [Node.js](https://nodejs.org/) | **24 or newer** (runs the TypeScript in `src/` directly, no build step) | `node -v` |
| [Google Chrome](https://www.google.com/chrome/) | any current version | |
| [Git](https://git-scm.com/) | any | `git --version` |

Works on Windows, macOS and Linux. On Windows every command runs in **PowerShell** or **Git Bash**; see [Windows notes](#windows-notes) for the one difference.

### Steps

```bash
git clone https://github.com/aaroncarrizal/icc-toolbox.git
cd icc-toolbox
npm install
```

Check that it works:

```bash
npm run clamp -- 24
# clamp(21.6px, 1.25vw, 24px)
```

> With npm 11+ you may see `npm warn install-scripts ... esbuild ... blocked`. That's harmless: esbuild is only used by `npm run build`, and it works without its install script.

That's it. There's nothing global to install, and the CSS injector uses its own Chrome profile (`.chrome-profile/` in the repo), so your normal Chrome windows, bookmarks and logins are left alone.

---

## Daily workflow

Each dealer site gets its own git branch. `master` holds only the toolbox.

### 1. Create a branch for the dealer

With Claude Code, type `/set-up <Dealer Name> <build-site URL>` and it does all of this for you. By hand:

```bash
git checkout master
git pull --ff-only
git checkout -b camp-site-rv-inc        # dealer name, lowercase, dashes
```

Then edit `.cssinjector.json` in the repo root:

```json
{
  "url": "https://dealer-name.interactrv.com/",
  "stripPatterns": [],
  "username": "interactrv",
  "password": "access"
}
```

Use `username`/`password` only when the build site asks for a login (HTTP Basic Auth), otherwise leave both `""`. Keep the other keys as they are (see [Config](#config) for all of them). Commit it:

```bash
git add .cssinjector.json
git commit -m "chore: set up Camp-Site RV Inc"
```

To come back to a dealer later, `git checkout <dealer-branch>`.

### 2. Start the injector

```bash
npm run dev
```

Chrome opens on the dealer site with your CSS from `styles/` already applied. **Leave this terminal running.** Use a second terminal for the `css` and `dbg` commands. Stop it with `Ctrl+C`.

### 3. Write CSS

Edit `styles/home.css`. Every save shows up in the page within about 100 ms, with no reload and no flash of unstyled content.

Team conventions (full list in [AGENTS.md → CSS Style Rules](AGENTS.md#css-style-rules)):

- All CSS goes in `styles/home.css`, **new rules at the end of the file**, under a section comment:
  ```css
  /*
  =====
  Section Name
  =====
  */
  ```
- No other comments, no `@import`.
- Scope selectors from the section: `.home-hero h2`, `#site-header .logo img`.
- Prefer `display: flex`, use the brand color variables (`--primary-bg-color`, …) instead of hex values, and use `text-decoration: none` on link hover.

If the injector terminal prints `WARNING home.css:42 invalid declaration "widht: 100px"`, Chrome dropped that line, so fix the typo.

### 4. Debug and try things live

```bash
npm run dbg -- find "Reviews"                        # which element is this text in?
npm run dbg -- why ".reviews img" width              # which rule sets its width, and from which file:line?
npm run dbg -- preview ".reviews img{width:320px}"   # try a fix without touching a file
npm run dbg -- crop ".reviews" --at 375,768,1200     # screenshot it at three widths → ./debug/
npm run dbg -- preview --save styles/home.css        # happy? append the tested CSS to home.css
```

See [Debug CLI](#debug-cli-npm-run-dbg) for every command.

### 5. Ship it

The toolbox never touches the CMS. When the page looks right, take the finished `styles/home.css` (and any HTML from `snippets/`) to the dealer's site in the CMS as usual. Commit your work on the dealer branch:

```bash
git add -A
git commit -m "fix: center the reviews carousel on mobile"
```

**Don't merge dealer branches into `master` or into each other.**

---

## Tools

### CSS injector (`npm run dev`)

Launches Chrome (or reuses one the injector already opened), opens `url` from `.cssinjector.json`, and injects every CSS file in `styles/` into the page:

- Each file gets its own `<style>` tag, added **at document start** on every page load, so CSS is in place before the page paints.
- `styles/` is watched. Saving, adding or deleting a file updates the open page live.
- Console errors, exceptions and failed requests are captured for `npm run dbg -- errors`.
- You can browse around the site normally in that window. The CSS follows you to every page.
- Chrome DevTools can be open on the same tab at the same time.

Files are applied in alphabetical order. Normally there's only `home.css`.

#### Config

`.cssinjector.json` in the repo root (template: `.cssinjector.example.json`):

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
| `url` | The dealer site to open |
| `dir` / `include` / `exclude` | Where your CSS lives and which files to load (globs inside `dir`) |
| `headless` | Run Chrome without a window |
| `stripPatterns` | The site's own stylesheets to switch **off** by default, by href pattern with `*` as wildcard, e.g. `"//assets.interactcp.com/*.default.css"`. Can be switched back on live with `npm run css -- on <pattern>`. |
| `username` / `password` | HTTP Basic Auth for password-protected build sites. Only ever sent to the site's own domain, never to CDNs. `""` = off. |
| `chromePath` | Full path to `chrome.exe` / `Google Chrome` if it isn't installed in the default place. `""` = auto-detect. |
| `scripts` / `jsDir` / `jsInclude` | JS injection from `scripts/`, **off by default**. A last resort for when CSS and HTML can't fix it (see [AGENTS.md → Fix Priority](AGENTS.md#fix-priority)). |

Flags override the file for one run:

```bash
npm run dev -- --url https://another-dealer.interactrv.com/ --username interactrv --password access
```

Flags: `-u, --url`, `-d, --dir`, `-i, --include`, `-e, --exclude`, `--headless`, `-s, --strip-patterns <a,b>`, `--username`, `--password`.

### Toggle CSS sources (`npm run css`)

Answers "is this our CSS or the site's?" without editing any file. Changes apply instantly to the open page.

```bash
npm run css -- list              # every local file and site stylesheet, on/off
npm run css -- off home.css      # switch off one of our files
npm run css -- on home.css       # switch it back on
npm run css -- off "*theme*.css" # switch off a site stylesheet by href pattern
npm run css -- solo home.css     # only this local file on
npm run css -- remote-off-all    # see the page with NONE of the site's own CSS
npm run css -- remote-on-all     # bring it all back
npm run css -- reset             # back to the config defaults
```

The on/off state lives in `.cssinjector.state.json` (git-ignored), so it survives restarts until you `reset`.

### Debug CLI (`npm run dbg`)

Inspects and edits the page the injector has open. `npm run dev` must be running. Results are JSON (add `--pretty` to indent). `npm run dbg -- help` lists everything.

**Find and inspect**

| Command | What you get |
|---|---|
| `find <text> [limit]` | The elements that contain that text, each with a ready-to-use selector and its size/position |
| `box <selector>` | Size, margin/padding, display/flex info, and the 6 parent elements (with their widths) |
| `why <selector> <property>` | **The rule that wins** for that property, its specificity and its source (`styles/home.css:120`, a site CSS URL, or `inline <style>:40`), plus the rules it beat and invalid ones |
| `rules <selector> [--ua]` | Every rule that matches the element, strongest first (`--ua` adds browser defaults) |
| `styles <selector> [--all]` | Computed styles (common layout/font/color ones, or `--all`) |
| `select <selector>` | How many elements match, and whether each is visible |
| `check <selector> [widths...]` | Visible / size / in-viewport at each Bootstrap breakpoint (375, 576, 768, 992, 1200, 1400) or the widths you give |
| `html [selector]` | The element's HTML (or the whole page) |
| `eval <js>` | Run JavaScript in the page and print the result |
| `errors [--clear]` | Console errors, exceptions and failed/4xx requests since the last page load |

**Try changes live** (nothing is saved to a file until you `--save`)

| Command | Effect |
|---|---|
| `preview "<css>"` / `preview @file.css` | Apply test CSS to the page (replaces the previous preview) |
| `set <selector> <prop> <value>` | Add one declaration to the preview |
| `preview --save styles/home.css` | Append the current preview to the end of `home.css` and clear it, so what you tested is what gets saved. **Add the section comment above it afterwards.** |
| `preview reset` | Drop the preview |
| `replace <selector> "<html>"` / `@file.html` | Preview an HTML change (replaces the element) |
| `inner <selector> "<html>"` / `@file.html` | Same, but replaces only what's inside the element |
| `restore [selector]` | Undo `replace`/`inner` |

HTML previews only change the open tab. Once it looks right, paste the markup into the CMS yourself.

**Screens and viewports**

| Command | Effect |
|---|---|
| `screenshot [path]` | The visible viewport |
| `fullpage [path]` | The whole page |
| `crop <selector> [path]` | Just one element |
| `outline [selector\|reset]` | Red outline on matching elements (or all elements) + a screenshot |
| `bp <xs\|sm\|md\|lg\|xl\|xxl\|reset> [height]` | Emulate a Bootstrap breakpoint width (xs=375 … xxl=1400). It stays on while you browse, until `bp reset`. |
| `resize <width> [height]` | Emulate any width |

Screenshots go to `./debug/` (git-ignored) as JPEG, max 1280 px wide. Add `--png` for lossless, `--full-res` for full size, `--at 375,768,1200` for one image per width.

**Several commands at once:** `batch` runs one command per line over a single connection and prints one JSON line per command.

```bash
# Git Bash / macOS / Linux
npm run dbg -- batch <<'EOF'
find "Reviews"
box ".reviews"
why ".reviews img" width
crop ".reviews" --at 375,1200
EOF
```

```powershell
# PowerShell (the closing '@ must be at the very start of its line)
@'
find "Reviews"
box ".reviews"
why ".reviews img" width
crop ".reviews" --at 375,1200
'@ | npm run dbg -- batch
```

Or put the lines in a file and run `npm run dbg -- batch @debug/check.txt` in any shell. Lines starting with `#` are skipped.

### Unit converters (`npm run clamp` / `vw` / `vh`)

Convert a px value from a 1920×1080 mockup:

```bash
npm run clamp -- 24   # clamp(21.6px, 1.25vw, 24px)   min = 90% of px, scales with width, max = px
npm run vw -- 24      # 1.25vw                         px / 1920 × 100
npm run vh -- 54      # 5vh                            px / 1080 × 100
```

`clamp` is the go-to for font sizes: one value that scales instead of a px size per breakpoint.

### Image converter (`npm run img:png`)

Converts `.jpg`, `.jpeg` and `.webp` images to `.png`, for dealer sites that need PNG uploads.

```bash
npm run img:png -- <folder>            # convert
npm run img:png -- <folder> --force    # also overwrite PNGs that already exist
npm run img:png -- --help              # usage
```

`<folder>` is relative to the repo root, or absolute, e.g. `npm run img:png -- "C:/Users/me/Downloads/campsite-photos"`:

```text
[img:png] converted  a.jpg       -> png/a.png
[img:png] converted  banner.webp -> png/banner.png
[img:png] skipped    logo.webp   (name conflict with logo.jpg)
[img:png] failed     broken.jpg  (Input file contains unsupported image format)
[img:png] 2 converted, 1 skipped, 1 failed — output: C:\Users\me\Downloads\campsite-photos\png
```

| Rule | Detail |
|---|---|
| Which files | `.jpg`, `.jpeg`, `.webp` in any letter case, **directly** in `<folder>`. Subfolders (including `png/`) aren't scanned; every other file is ignored. |
| Output | `<folder>/png/<same name>.png`. `png/` is created only if something gets written. |
| Originals | Never modified, moved or deleted. |
| Image quality | Same size as the source, WebP transparency kept, JPEG rotation applied so phone photos aren't sideways. Camera metadata is dropped. |
| Animated WebP | First frame only, with a warning. |
| PNG already exists | Skipped; `--force` overwrites it. |
| Name conflict | `logo.jpg` + `logo.webp` both want `logo.png`: the first by name wins, the rest are skipped (even with `--force`). |
| Broken file | Reported as `failed`; the rest still convert. |
| Exit code | `1` if any file failed, the folder doesn't exist, or the arguments are wrong; otherwise `0`. |

PNG is lossless, so the PNG is often **larger** than the original. Shrink them with `npm run img:compress`.

### Image compressor (`npm run img:compress`)

Shrinks `.jpg`, `.jpeg`, `.webp` and `.png` images to at most **1 MB** each, for dealer sites with upload limits.

```bash
npm run img:compress -- <folder>                    # compress
npm run img:compress -- <folder> --force            # also overwrite existing output
npm run img:compress -- <folder> --max 500KB        # different limit (KB/MB are decimal: 1MB = 1,000,000 bytes)
npm run img:compress -- <folder> --max-width 1920   # also cap width
npm run img:compress -- --help
```

```text
[img:compress] compressed  photo.jpg     3.7 MB -> 916 KB  (resized 3707px, quality 60)
[img:compress] compressed  graphic.png  10.8 MB -> 654 KB  (palette q75)
[img:compress] copied      logo.png        3 KB
[img:compress] failed      broken.jpg   (Input file contains unsupported image format)
[img:compress] 2 compressed, 1 copied, 0 skipped, 1 failed — 14.5 MB -> 1.6 MB (saved 12.9 MB, 89%) — output: …\compressed
```

| Rule | Detail |
|---|---|
| Which files | `.jpg`, `.jpeg`, `.webp`, `.png` in any letter case, **directly** in `<folder>` (subfolders, including `compressed/`, aren't scanned). |
| Output | `<folder>/compressed/<same name>`, same format and extension. Originals are never touched. |
| Already under the limit | Copied unchanged, so `compressed/` is a complete upload set. |
| Over the limit | Highest quality that fits: JPEG/WebP quality 85 → 75 → 65 → 60; PNG lossless, then reduced colors. Only then is the image made smaller, never below 1000 px on the longest side. |
| Can't fit | Reported as `failed` with the best size reached; nothing is written for it. |
| Image quality | Transparency kept, phone photos rotated correctly, camera metadata dropped. |
| Output already exists | Skipped; `--force` overwrites it. |
| Speed | Up to 4 files at once; about 25 s for 50 camera photos. |
| Exit code | `1` if any file failed, the folder doesn't exist, or the arguments are wrong; otherwise `0`. |

**Don't commit images to this repo.** Point both image tools at a folder outside it (e.g. your Downloads).

---

## Working with Claude Code (optional)

Every tool works by hand. The repo is also set up for [Claude Code](https://claude.com/claude-code): [AGENTS.md](AGENTS.md) holds the team's rules (CSS style, fix priority, branch rules, CMS shortcodes), and Claude follows them automatically. Project skills in `.claude/skills/`:

| Skill | Use it when |
|---|---|
| `/set-up <dealer> <url>` | Starting a new dealer: creates the branch and fills in `.cssinjector.json` (detects Basic Auth for you) |
| `/custom-forms` | Building or changing a lead form (fields, `FormType`, redirect, lead email routing) |
| `/content-migration <old-page-url>` | Moving a page from the dealer's old site into `snippets/pages/` |
| `/kenect-reviews <old-page-url>` | Moving the Kenect reviews carousel from the old site |

You can also hand it a numbered list of fixes ("1. make the logo bigger on mobile, 2. …"). It works through them with `npm run dev` running and commits each one separately.

Reusable markup lives in `snippets/` (`snippets/pages/base.html` for migrated pages, `snippets/ai-search-assistant/` for the AI search widget).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Chrome is not reachable at http://127.0.0.1:9222. Is npm run dev running?` | `css` and `dbg` need `npm run dev` running in another terminal. |
| `No tab found for <url>` | The injector's Chrome window was closed or left the site. Restart `npm run dev`, or go back to the dealer site in that window. |
| `Google Chrome not found` | Set `"chromePath"` in `.cssinjector.json` to the full path of `chrome.exe`. |
| The site keeps asking for a login | Set `username`/`password` in `.cssinjector.json` (most build sites: `interactrv` / `access`). |
| `[config] .cssinjector.json is not valid JSON` | Fix the JSON in that file. A missing comma or a trailing comma is the usual cause. |
| `--url is required` | `url` is empty in `.cssinjector.json`. Set it, or pass `--url`. |
| A change doesn't apply | Check the injector terminal for `WARNING ... invalid declaration`. Then run `npm run dbg -- why "<selector>" <property>` to see which rule beats yours and from where. |
| Something unrelated on the page broke | `npm run dbg -- errors`. On jQuery 1.8 sites, one failing script can silently stop carousels/tabs elsewhere. |
| The page looks like a phone even though the window is wide | A breakpoint emulation is still on: `npm run dbg -- bp reset`. |
| Some of the site's CSS seems missing | Check `npm run css -- list` for stylesheets switched off. `npm run css -- reset` restores the config defaults. |
| `npm warn install-scripts ... esbuild` on `npm install` | Harmless (see [Install](#install)). |

The injector reuses whatever Chrome is already listening on port 9222. If that Chrome isn't the injector's own (e.g. another debugging tool), close it first.

### Windows notes

- `npm run <tool> -- <args>` works the same in PowerShell, Git Bash and cmd.
- The `<<'EOF'` heredoc in the `batch` examples (and in [AGENTS.md](AGENTS.md)) is Bash syntax. In PowerShell, pipe a here-string instead, or use `batch @file` (see [Debug CLI](#debug-cli-npm-run-dbg)).
- Quote paths with spaces: `npm run img:png -- "C:/Users/me/Downloads/new photos"`.

---

## Contributing to the toolbox

Toolbox changes (tools, docs, skills) go on a feature branch off `master` and merge back into `master`. **Never commit dealer work to `master`**, and never merge `master` into a dealer branch unless asked: a dealer branch keeps the toolbox version it was created with. To bring a dealer branch up to date on purpose: `git rebase master <dealer-branch>`.

```bash
npm run typecheck   # run before every commit
npm run build       # optional: bundle the injector into dist/ with Vite
npm start           # run that bundle
```

### Layout

```
src/
├── shared/                 # code used by 2+ tools
└── tools/
    ├── css-injector/       # npm run dev / css / dbg
    ├── units/              # npm run clamp / vw / vh
    ├── image-convert/      # npm run img:png
    └── image-compress/     # npm run img:compress
styles/  scripts/  snippets/  .cssinjector.json       # dealer working files (CSS injector)
debug/   .chrome-profile/   .cssinjector.state.json   # local only, git-ignored
specs/   .specify/                                    # design docs for past features (Spec Kit)
```

### Rules

- **One folder per tool** under `src/tools/<name>/`. A tool may import from `src/shared/`, never from another tool's folder.
- **Script names are a stable interface.** Don't rename existing ones; new tools get namespaced names (`img:png`).
- **Adding a tool** = a folder under `src/tools/`, a script in `package.json`, and a section in this README and in [AGENTS.md](AGENTS.md).
- **TypeScript runs directly on Node**, so relative imports keep the `.ts` extension, type-only imports use `import type`, and no `enum` / `namespace` / constructor parameter properties.
- **Chrome is only reached through one page's own DevTools connection** (`Cdp.connectToSite()` in `src/tools/css-injector/cdp.ts`), never the browser-level one, no Puppeteer, no `Target.*` calls. A browser-level connection made an open DevTools window render a second DevTools inside itself. See [AGENTS.md → Rules for Working on This Tool](AGENTS.md#rules-for-working-on-this-tool).
- Code style: `src/` is hand-formatted (2 spaces, semicolons, double quotes) and excluded from Prettier. HTML/CSS snippets follow `.prettierrc.json`.

### How the injector works

- CSS is registered with `Page.addScriptToEvaluateOnNewDocument`, so it runs at document start on every navigation, and is also evaluated immediately for a live update on save.
- The code that runs inside the page (`page-runtime.ts`) keeps one `<style>` per local file, toggles the site's `<link>` stylesheets with `link.disabled` (never removes them), and uses a `MutationObserver` to re-apply both when the site adds markup late.
- The injector and the `css`/`dbg` CLIs share `.cssinjector.state.json`. The CLIs write it, and the injector watches it and applies the change. That's also why `bp`/`resize` persist: emulation belongs to the long-lived injector connection, not to a short `dbg` call.

### Dependencies

- [Chokidar](https://github.com/paulmillr/chokidar): file watching
- [Fast Glob](https://github.com/mrmlnc/fast-glob): file matching
- [Commander](https://github.com/tj/commander.js): CLI parsing for `npm run dev`
- [sharp](https://sharp.pixelplumbing.com/): image conversion and compression
- Chrome DevTools Protocol, through a minimal client in `src/tools/css-injector/cdp.ts` built on Node's built-in `WebSocket` and `fetch`, with no browser-automation library
