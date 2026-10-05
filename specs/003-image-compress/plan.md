# Implementation Plan: Image Compressor

**Branch**: `003-image-compress` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-image-compress/spec.md`

## Summary

New tool `src/tools/image-compress/`, run as
`npm run img:compress -- <folder> [--force] [--max <size>] [--max-width <px>]`. For each
`.jpg/.jpeg/.webp/.png` directly in `<folder>`: if it's already ≤ the limit (and no max-width
applies) copy it byte-for-byte into `<folder>/compressed/`; otherwise re-encode in the same
format with a fixed ladder — quality steps for JPEG/WebP, lossless-then-palette for PNG — and
only if still too big, shrink dimensions down to a 1000 px floor. Uses `sharp` (already a
dependency). The folder-scanning code shared with `img:png` moves to `src/shared/` — its first
real use ([research.md](research.md) §6).

## Technical Context

**Language/Version**: TypeScript (erasable syntax) run directly on Node 24+ (local: v26.9.0)

**Primary Dependencies**: `sharp` ^0.35.5 (already installed for img:png — no new dependency);
Node built-ins `node:fs/promises`, `node:path`, `node:util`

**Storage**: Reads `<folder>/*.{jpg,jpeg,webp,png}`, writes `<folder>/compressed/*`

**Testing**: No automated suite (project convention). `npm run typecheck` + fixture scenarios in
[quickstart.md](quickstart.md)

**Target Platform**: Windows/macOS developer machine

**Project Type**: CLI tool inside the icc-toolbox package

**Performance Goals**: 50 typical web images (≤ 10 MB each) in < 60 s (SC-002)

**Constraints**: Every output ≤ limit (default 1,000,000 bytes); quality ≥ 60; longest side ≥
1000 px when resizing; originals untouched; no over-limit output ever written

**Scale/Scope**: Tens to low hundreds of images per run; 2 tool files + 1 shared file

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Tool Isolation | New `src/tools/image-compress/`; imports only `node:*`, `sharp` and `src/shared/`. Folder scanning needed by both image tools moves to `src/shared/image-files.ts` instead of being cross-imported from image-convert | ✅ Pass |
| II. CLI-First via npm Scripts | New namespaced `img:compress`; existing scripts (incl. `img:png`) keep behavior — re-verified after the shared extraction | ✅ Pass |
| III. Page-Level CDP Only | No CDP code | ✅ N/A |
| IV. Erasable TS, No Build Step | Plain `node src/tools/image-compress/index.ts`; `.ts` imports, `import type`, no enums | ✅ Pass |
| V. Simplicity / Minimal Deps | No new dependency; fixed quality ladder instead of a binary search; `util.parseArgs` | ✅ Pass |
| Workflow | Feature branch, typecheck + smoke tests, AGENTS.md + README updated in the same change | ✅ Pass |

**Post-design re-check**: ✅ unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/003-image-compress/
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
src/
├── shared/
│   └── image-files.ts        # listImageFiles(folder, extensions) — used by both image tools
└── tools/
    ├── image-convert/
    │   └── convert.ts        # listSources() now delegates to shared listImageFiles (no behavior change)
    └── image-compress/
        ├── index.ts          # CLI: parseArgs, folder check, per-file lines, summary, exit code
        └── compress.ts       # planCompressions(), compressOne() — strategy ladder, no console output
```

Files edited: `package.json` (`img:compress` script), `src/tools/image-convert/convert.ts`
(use shared helper), `AGENTS.md` (Commands, tools table, Toolbox Layout, Architecture, new
"Image Compressor" section, note that `src/shared/` now has content), `README.md` (tools table +
usage section). `src/shared/.gitkeep` is removed now that the folder has a real file.

**Structure Decision**: Same shape as image-convert (thin CLI + logic file). Only genuinely
common code (listing eligible files) is shared; compression logic stays in its own tool.

## Complexity Tracking

No violations.
