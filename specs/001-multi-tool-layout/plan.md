# Implementation Plan: Multi-Tool Layout

**Branch**: `001-multi-tool-layout` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-multi-tool-layout/spec.md`

## Summary

Move the CSS injector + its CLIs into `src/tools/css-injector/` and the px converters into
`src/tools/units/` with `git mv`, add `src/shared/` (kept with a `.gitkeep`), and repoint the
npm scripts, the Vite entry and the docs. No source file changes beyond paths: every intra-tool
import is a sibling `./x.ts` import that moves with its file, and every runtime path is resolved
from the working directory, not the file location (see [research.md](research.md)).

## Technical Context

**Language/Version**: TypeScript (erasable syntax) run directly on Node 24+ (local: v26.9.0)

**Primary Dependencies**: commander, chokidar, fast-glob (unchanged); Vite for `npm run build`

**Storage**: Files in the working directory (`.cssinjector.json`, `.cssinjector.state.json`,
`styles/`, `scripts/`, `debug/`) — unchanged

**Testing**: No automated test suite; validation = `npm run typecheck`, `npm run build`, and
smoke runs of every npm script ([quickstart.md](quickstart.md))

**Target Platform**: Windows/macOS developer machine with Google Chrome

**Project Type**: CLI toolbox (single npm package, multiple tools)

**Performance Goals**: N/A (no runtime change)

**Constraints**: Zero behavior change; existing script names fixed; history preserved via
`git mv`; dealer-owned files don't move

**Scale/Scope**: 16 source files moved, ~4 config/doc files edited

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Tool Isolation | Creates `src/tools/<name>/` + `src/shared/`; css-injector and units share no imports | ✅ Pass |
| II. CLI-First via npm Scripts | All 9 script names kept; only their paths change ([contracts/commands.md](contracts/commands.md)) | ✅ Pass |
| III. Page-Level CDP Only | No CDP code changes | ✅ Pass |
| IV. Erasable TS, No Build Step | Imports keep explicit `.ts`; no syntax changes | ✅ Pass |
| V. Simplicity | No new dependencies; no dispatcher; `shared/` starts empty | ✅ Pass |
| Workflow | On a branch; `git mv`; typecheck + smoke tests; AGENTS.md updated in same change | ✅ Pass |

**Post-design re-check**: ✅ unchanged — the design adds no dependencies, abstractions or
cross-tool imports.

## Project Structure

### Documentation (this feature)

```text
specs/001-multi-tool-layout/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── commands.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── shared/
│   └── .gitkeep
└── tools/
    ├── css-injector/
    │   ├── index.ts          # npm run dev / npm start (via dist/)
    │   ├── css-cli.ts        # npm run css
    │   ├── dbg.ts            # npm run dbg
    │   ├── cdp.ts
    │   ├── chrome.ts
    │   ├── config.ts
    │   ├── console-log.ts
    │   ├── css-lint.ts
    │   ├── injector.ts
    │   ├── page-runtime.ts
    │   ├── sources.ts
    │   ├── state.ts
    │   └── watcher.ts
    └── units/
        ├── clamp.ts          # npm run clamp
        ├── vw.ts             # npm run vw
        └── vh.ts             # npm run vh

# unchanged at root: styles/ scripts/ snippets/ debug/ .cssinjector*.json
```

Files edited (not moved): `package.json` (script paths), `vite.config.ts` (lib entry),
`AGENTS.md` (Architecture + new "Toolbox layout" section, Rules wording), `README.md`
(intro + `src/cdp.ts` reference). `tsconfig.json` already includes `src/**/*` — no change.
`dist/index.js` keeps its name (Vite `fileName: "index"`), so `bin` and `npm start` are unchanged.

**Structure Decision**: Single package, one folder per tool under `src/tools/`, shared code in
`src/shared/` — the layout from the spec's Assumptions.

## Complexity Tracking

No violations.
