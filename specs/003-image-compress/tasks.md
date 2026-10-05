---

description: "Task list for the image compressor"
---

# Tasks: Image Compressor

**Input**: Design documents from `/specs/003-image-compress/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli.md, quickstart.md

**Tests**: No automated tests requested. Validation is `npm run typecheck` plus the fixture
scenarios in [quickstart.md](quickstart.md), run in the session scratchpad (never in the repo).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 1: Setup

- [ ] T001 Add script `"img:compress": "node src/tools/image-compress/index.ts"` to `package.json`, right after `img:png`
- [ ] T002 Create folder `src/tools/image-compress/`

---

## Phase 2: Foundational (shared code)

- [ ] T003 Create `src/shared/image-files.ts` exporting `interface ImageFile { name: string; path: string; ext: string }` and `listImageFiles(folder, extensions: readonly string[])`: regular files directly in `folder` (no subfolders), lower-cased extension in `extensions`, sorted by name — logic moved from `src/tools/image-convert/convert.ts` `listSources` ([research.md](research.md) §6); delete `src/shared/.gitkeep`
- [ ] T004 Refactor `src/tools/image-convert/convert.ts` `listSources` to call `listImageFiles(folder, ["jpg","jpeg","webp"])` from `../../shared/image-files.ts`, keeping its `SourceImage` type and behavior identical
- [ ] T005 Run `npm run typecheck`, then img:png quickstart scenarios 1–2 from `specs/002-image-convert/quickstart.md` on a scratchpad fixture — counts must match (5 converted, 1 skipped, 1 failed)
- [ ] T006 Commit as `refactor: move image file listing to src/shared for reuse by image tools`

**Checkpoint**: shared helper in place, img:png unchanged.

---

## Phase 3: User Story 1 - Shrink a folder of images under 1 MB (Priority: P1) 🎯 MVP

**Goal**: `npm run img:compress -- <folder>` writes every eligible image into `<folder>/compressed/` at ≤ 1,000,000 bytes, same format, originals untouched.

**Independent Test**: [quickstart.md](quickstart.md) scenarios 1–2 for photo/easy/graphic/pic/small/rot, plus 4, 5, 6, 7, 8.

- [ ] T007 [US1] In `src/tools/image-compress/compress.ts` export `CompressionResult` per [data-model.md](data-model.md) (`status: "compressed" | "copied" | "skipped" | "failed"`, `outSize?`, `steps?`, `reason?`, `warning?` — string-literal union, no enum) and `parseSize(text)`: accepts `1MB`, `800KB`, `1.5MB` or plain bytes, decimal units (1KB = 1,000, 1MB = 1,000,000), returns `undefined` if invalid
- [ ] T008 [US1] In `src/tools/image-compress/compress.ts` implement the encoder ladder per [research.md](research.md) §2: JPEG `jpeg({quality, mozjpeg:true})` for 85/75/65/60; WebP `webp({quality})` for 85/75/65/60; PNG `png({compressionLevel:9, adaptiveFiltering:true})` then `png({palette:true, quality, effort:7})` for 90/75/60; every encode starts from `sharp(path).rotate()` (auto-orient) and returns a buffer; keep the first buffer ≤ limit and a `steps` label (`quality 75`, `lossless`, `palette q75`)
- [ ] T009 [US1] In `src/tools/image-compress/compress.ts` implement the resize fallback: from the floor setting, `width = floor(width × √(limit / size) × 0.95)`, up to 4 tries, never letting the longest side go below **1000 px** (if the image's longest side is already ≤ 1000 px, no resize); still over → throw/return failed with `reason: "can't reach <limit> at quality 60 / 1000px (best: <size>)"`; steps label `resized <w>px, quality 60` / `resized <w>px, palette q60`
- [ ] T010 [US1] In `src/tools/image-compress/compress.ts` implement `compressOne(file, outPath, { limit, maxWidth })`: if `size ≤ limit` and not (`maxWidth` && width > `maxWidth`) → `copyFile` → `copied`; else (optionally `resize({ width: maxWidth, withoutEnlargement: true })` first) run the ladder → `writeFile` only after a buffer ≤ limit is in hand → `compressed`; set `warning: "animated WebP — first frame only"` when `metadata().pages > 1`
- [ ] T011 [US1] In `src/tools/image-compress/index.ts` implement the CLI with `node:util` `parseArgs` (`force`/`f`, `max` string, `max-width` string, `help`/`h`) per [contracts/cli.md](contracts/cli.md): usage/exit rules, `Not a folder`, `--max` via `parseSize` (default 1,000,000), `--max-width` positive integer; list files with shared `listImageFiles(folder, ["jpg","jpeg","webp","png"])`; empty → `No .jpg, .jpeg, .webp or .png files in <folder>`, exit 0
- [ ] T012 [US1] In `src/tools/image-compress/index.ts`: create `<folder>/compressed/` (recursive), process files sequentially, print per-file lines and the summary line exactly as in [contracts/cli.md](contracts/cli.md) with decimal human sizes (`912 KB`, `4.2 MB`) and total saved with %
- [ ] T013 [US1] Run `npm run typecheck` and the import check from [quickstart.md](quickstart.md) §1
- [ ] T014 [US1] Generate the [quickstart.md](quickstart.md) §2 fixtures in the scratchpad; run scenarios 1–2 (minus broken/IMPOSSIBLE) and 4–8; verify every output ≤ limit, PNG alpha kept, copied files byte-identical, originals unchanged
- [ ] T015 [US1] Commit as `feat: add img:compress image compressor (≤ 1 MB, same format)`

**Checkpoint**: MVP — a folder compresses under 1 MB in one command.

---

## Phase 4: User Story 2 - Safe re-runs and clear failures (Priority: P2)

**Goal**: Existing output skipped unless `--force`; corrupt and impossible files fail individually; exit 1 on any failure; nothing written for failures.

**Independent Test**: [quickstart.md](quickstart.md) scenarios 1 and 3 in full.

- [ ] T016 [US2] In `src/tools/image-compress/index.ts` before processing: `compressed/<name>` exists and `!force` → `skipped` with `reason: "already exists — use --force to overwrite"`; only create `compressed/` if at least one file will be processed
- [ ] T017 [US2] In `src/tools/image-compress/index.ts` wrap each `compressOne` in try/catch → `failed` with the error message (FR-008), keep going; `process.exitCode = 1` if any failed
- [ ] T018 [US2] Run `npm run typecheck`, then [quickstart.md](quickstart.md) scenarios 1 and 3 in full (broken.jpg and the impossible file fail, nothing written for them; re-run skips everything else with no mtime changes)
- [ ] T019 [US2] Commit as `feat(img:compress): skip existing output, --force, isolate failures`

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T020 Performance check per [quickstart.md](quickstart.md) §4: 50 camera-like 4000×3000 JPEGs in < 60 s (SC-002); record the time
- [ ] T021 [P] In `AGENTS.md`: add `npm run img:compress -- <folder> [--force] [--max <size>] [--max-width <px>]` to Commands; add an image-compress row to the Project Overview tools table; add `image-compress/` and `shared/image-files.ts` to the Toolbox Layout and Architecture trees (and drop "empty" from the `shared/` description); add an "Image Compressor (`npm run img:compress`)" section (strategy ladder, floors, copied small files, `--max`, `--max-width`, skip/`--force`, exit codes)
- [ ] T022 [P] In `README.md`: add an image-compress row to the tools table and an "Image compressor" usage section like the converter's; replace "shrinking files is a separate tool (planned)" in the converter section with a pointer to `img:compress`
- [ ] T023 Run `npm run typecheck` and smoke-test `npm run clamp -- 24` and `npm run img:png -- --help`; commit as `docs: document img:compress in AGENTS.md and README`
- [ ] T024 Delete scratchpad fixtures/spike folders; confirm `git status` clean and no image files tracked

---

## Dependencies & Execution Order

- Setup → Foundational (shared refactor, verified) → US1 → US2 → Polish
- US2 extends `index.ts` from US1, so it runs after US1.
- T021 and T022 are parallel.

## Parallel Opportunities

```text
Polish: T021 (AGENTS.md) alongside T022 (README.md)
```

## Implementation Strategy

MVP = Phases 1–3: after T015 a folder compresses in one command. US2 adds re-run safety and
failure isolation; Polish adds the performance check and docs.
