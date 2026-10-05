# Data Model: Multi-Tool Layout

No persisted data changes. The "entities" are structural conventions.

## Tool

| Field | Description |
|---|---|
| name | kebab-case folder name under `src/tools/` (`css-injector`, `units`) |
| entry points | one or more `.ts` files each run by an npm script |
| config | optional config file in the project root (css-injector: `.cssinjector.json`) |
| docs | one section in AGENTS.md |

**Validation rules**
- Imports from a tool may target only its own folder, `src/shared/`, `node:*` or npm packages.
- Never `../<other-tool>/…`.

## Shared module area (`src/shared/`)

- Holds code used by ≥ 2 tools. Starts empty.
- May not import from any `src/tools/*` folder.

## Current mapping

| Tool | Entry points → script |
|---|---|
| css-injector | `index.ts` → `dev` (and `build`/`start` via `dist/`), `css-cli.ts` → `css`, `dbg.ts` → `dbg` |
| units | `clamp.ts` → `clamp`, `vw.ts` → `vw`, `vh.ts` → `vh` |
