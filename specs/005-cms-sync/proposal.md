# Proposal: `cms` tool — read and publish CMS content from the command line

Status: **draft, decisions below agreed**, not yet a Spec Kit spec. Next step: `/speckit-specify` from this file.

## Why

Starting a build (the `start-build` skill) currently means driving the Umbraco editor through the Chrome extension:

- One screenshot or round-trip per step. The extension filters out any output that contains URLs or base64, so exporting needs a Blob-download detour and an extra permission prompt.
- Publishing one snippet means navigating the editor, waiting for TinyMCE, `setContent`, and clicking **Save and publish**. That takes roughly 30–45 s per node, and several nodes in one call hit the 45-second tool limit.
- Impersonation is session-wide and easy to get wrong. On Kehoe RV the session had silently switched to another dealer mid-task.
- On Kehoe RV, exporting and publishing about 14 nodes took well over an hour of agent time. Most of that was screenshots, waiting and retries.

A small CLI with the same page-level CDP design as `css`/`dbg` would turn each of those into a single command whose output is plain text.

## Goals

1. `npm run cms -- pull` exports every snippet, the homepage body and footer scripts into `snippets/` in one command, with a `snippets/.cms-map.json` that maps each file to its node ID.
2. `npm run cms -- push <file…>` publishes local files to their nodes, checks the result, and keeps a backup of what it replaced.
3. Safety checks are built in: the impersonated account, the domain node and the node name must match before anything is written.
4. No screenshots, no output filters, no hand-written browser JavaScript for the routine path.

5. `npm run cms -- css pull|push` and `cms -- head pull|push` cover the dealer CSS and the site head HTML on the domain node, so a build never needs the editor UI.

Non-goals (for v1): creating or deleting nodes, media-library uploads, multi-site bulk runs.

## How it works

**Authentication: reuse the user's own CMS session, never handle credentials.** The debug Chrome (the injector's dedicated profile) gets one `https://www.interactcp.com/manage/Site` tab. The user signs in there once, and the profile keeps the cookie. The tool connects to **that tab's own page websocket** (constitution III: page level only, no `Target.*`) and runs `fetch` inside the Umbraco iframe, so requests carry the session cookie and the XSRF header exactly as the editor does. No cookies or passwords ever reach Node.

Endpoints already confirmed on Kehoe RV:

| Purpose | Request | Notes |
|---|---|---|
| Child nodes | `GET /rebraco/ContentTree/GetNodes?id=<id>&application=content` | JSON prefixed with `)]}',` |
| Node content | `GET /rebraco/Content/GetById?id=<id>` | `tabs[].properties[]`: `content`, `pageFooterScripts`, `bodyContent`, `conditions` |
| Current account | `#ddlAsAccount` on `/manage` | the selected option's text is the impersonated dealer |

**To research (first task of the plan):**

- **The save endpoint.** Capture one manual **Save and publish** with the CDP `Network` domain on the CMS tab: the URL (likely `/rebraco/Content/PostSave`), multipart vs JSON, the `action` value for publish, and the XSRF header and cookie names. Calling Angular's `contentResource` from outside failed with `status 0`, so the tool should replay the raw request.
- **Fallback if the raw save can't be replayed:** drive the editor the way the skill does today (hash navigation → TinyMCE `setContent` → click Save and publish), but inside one `cdp.evaluate` per node with proper waiting, rather than through agent round-trips.
- **Domain-node property aliases.** The dealer CSS and the site head HTML live on the **domain node** (e.g. `kehoerv.builds.interactrv.com`, id 529126), on its **CSS** and **Developer** tabs. Read that node with `GetById` once to get the exact property aliases (expected: the default and client CSS on the CSS tab, the head HTML on the Developer tab), and confirm that publishing them regenerates `assets.interactcp.com/<dealer>/css/<id>_default.css`.

## Commands (v1)

| Command | What it does |
|---|---|
| `cms -- whoami` | Impersonated account, its domain nodes, and whether one matches `.cssinjector.json`'s URL |
| `cms -- tree [--depth n]` | The domain's snippet and page tree with node IDs |
| `cms -- pull [--domain <host>] [--force]` | Export snippets, the home body and footer scripts to `snippets/`, and write `.cms-map.json`. Refuses to overwrite modified local files without `--force`. |
| `cms -- diff [file…]` | Local file vs. stored CMS value (normalized for TinyMCE whitespace) |
| `cms -- push <file…> [--dry-run]` | Publish. Before writing, checks that the account, domain and node name match the map. Backs up the old value to `debug/cms-backup/<id>-<timestamp>.html`. After writing, re-reads the node, compares the `UMBRACO_MACRO` count, curls the page and fails on `error occurred while rendering the macro`. |
| `cms -- css pull` / `cms -- css push [--dry-run]` | Copy the domain node's default CSS (CSS tab) to and from `styles/home.css`. `push` checks that the published `<id>_default.css` serves the new content. |
| `cms -- head pull` / `cms -- head push [--dry-run]` | Copy the domain node's head HTML (Developer tab) to and from `snippets/site/head.html`, e.g. for Google Fonts links |
| `cms -- restore <id> [backup]` | Push a backup back |

Exit code `1` on any mismatch or failed check. Output is one line per node, like `img:compress`.

## Safety rules

- Never switch impersonation automatically. Print the mismatch and stop. (`cms -- account <name>` could come later, behind a confirmation flag.)
- `push` without `--dry-run` is the only write. It names every node before writing and verifies each one after.
- Validate known macro pitfalls before pushing: `ImageRotator` items with a non-numeric `assetId`, and `<a>` wrapping block elements (TinyMCE rewrites those).
- Backups are always written first. They're gitignored, under `debug/`.

## Layout

```
src/tools/cms/
├── index.ts      # commander CLI: whoami / tree / pull / diff / push / restore
├── session.ts    # find or open the CMS tab in the debug Chrome; page-level Cdp; iframe fetch helper
├── api.ts        # GetNodes / GetById / save, )]}' parsing, property access
├── map.ts        # .cms-map.json read/write; path <-> node id
└── verify.ts     # macro-count check, render check via curl, rotator/asset checks
```

- `Cdp.connectToSite()` would need a sibling that targets a page by URL prefix (`interactcp.com/manage`) instead of the dealer site. Move that into `src/shared/` if the injector needs it too (constitution I).
- New npm script: **one** `cms` script with subcommands (`npm run cms -- pull`), matching `css`/`dbg`: one name to remember for people, and one entry point for agents to run `--help` on.
- No new dependencies expected (Node `fetch`, `WebSocket`, `fs`).
- AGENTS.md gets a **CMS Sync** section, and the `start-build` skill's steps 1 and 6 shrink to `cms -- pull` / `cms -- push`.

## Effort guess

- Research spike on the save request: half a day.
- `whoami`/`tree`/`pull`/`diff`: one day.
- `push` with backups and verification: one day.
- Docs and skill update: a couple of hours.

## Decisions (maintainer, 2026-11-24)

1. Signing into the CMS once in the debug Chrome profile is fine. The tool relies on that session.
2. One `cms` script with subcommands.
3. v1 includes the dealer CSS (domain node, **CSS** tab) and the site head HTML (domain node, **Developer** tab).
