# Implementation Plan: Image Format Converter

**Branch**: `002-image-convert` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-image-convert/spec.md`

## Summary

New tool `src/tools/image-convert/`, run as `npm run img:png -- <folder> [--force]`. It lists the
`.jpg/.jpeg/.webp` files directly in `<folder>`, plans each one (convert / skip-exists /
skip-conflict), converts sequentially with `sharp` (auto-orient → PNG, alpha kept) into
`<folder>/png/`, prints one line per file plus a summary, and exits 1 if anything failed. CLI
parsing uses Node's built-in `util.parseArgs`; `sharp` is the only new dependency
([research.md](research.md)).

## Technical Context

**Language/Version**: TypeScript (erasable syntax) run directly on Node 24+ (local: v26.9.0)

**Primary Dependencies**: `sharp` ^0.35.5 (new — libvips bindings, prebuilt for win32-x64);
Node built-ins `node:fs/promises`, `node:path`, `node:util`

**Storage**: Local files only — reads `<folder>/*.{jpg,jpeg,webp}`, writes `<folder>/png/*.png`

**Testing**: No automated suite (project convention). Validation via `npm run typecheck` and the
fixture scenarios in [quickstart.md](quickstart.md)

**Target Platform**: Windows/macOS developer machine

**Project Type**: CLI tool inside the icc-toolbox package

**Performance Goals**: 50 typical web images (≤ 5 MB each) in < 30 s (SC-001)

**Constraints**: Never modify originals; never overwrite without `--force`; never write partial
PNGs; one bad file doesn't stop the batch

**Scale/Scope**: Tens to low hundreds of images per run; 2 source files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Tool Isolation | New folder `src/tools/image-convert/`; imports only `node:*` and `sharp`; nothing from css-injector/units; nothing added to `src/shared/` (no second consumer yet) | ✅ Pass |
| II. CLI-First via npm Scripts | New namespaced script `img:png`; args in, results on stdout, errors on stderr, exit codes; existing scripts untouched | ✅ Pass |
| III. Page-Level CDP Only | No Chrome/CDP code | ✅ N/A |
| IV. Erasable TS, No Build Step | Runs via `node src/tools/image-convert/index.ts`; explicit `.ts` imports, `import type`; no enums | ✅ Pass |
| V. Simplicity / Minimal Deps | One new dependency, `sharp` — justified: Node has no image decoder/encoder; arg parsing via built-in `util.parseArgs` instead of commander | ✅ Pass (dependency justified in research.md §1) |
| Workflow | Feature branch; typecheck + smoke tests; AGENTS.md section added in same change | ✅ Pass |

**Post-design re-check**: ✅ unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/002-image-convert/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── cli.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/tools/image-convert/
├── index.ts      # CLI entry: parseArgs, validate folder, run, print per-file lines + summary, exit code
└── convert.ts    # listSources(), planConversions(), convertOne() — no console output, returns results
```

Files edited: `package.json` (add `"img:png"` script, add `sharp` dependency),
`AGENTS.md` (Commands table, Project Overview tools table, Toolbox Layout tree, Architecture tree,
new "Image Converter" section), `README.md` (tools table).
Not touched: `vite.config.ts` (build bundles only the css-injector), `tsconfig.json`
(`src/**/*` already included).

**Structure Decision**: One tool folder with a thin CLI file and a logic file, so the logic can
later move to `src/shared/` if the image-compress tool needs the same folder scanning.

## Complexity Tracking

No violations.
