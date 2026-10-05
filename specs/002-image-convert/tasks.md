---

description: "Task list for the image format converter"
---

# Tasks: Image Format Converter

**Input**: Design documents from `/specs/002-image-convert/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli.md, quickstart.md

**Tests**: No automated tests requested. Validation is `npm run typecheck` plus the fixture
scenarios in [quickstart.md](quickstart.md), run against a fixture folder in the session
scratchpad (never in the repo).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 1: Setup

- [X] T001 Add `sharp` (`^0.35.5`) to `dependencies` in `package.json` via `npm install sharp@^0.35.5` (updates `package-lock.json`)
- [X] T002 Add script `"img:png": "node src/tools/image-convert/index.ts"` to `package.json`, after the `vh` script
- [X] T003 Create folder `src/tools/image-convert/`

---

## Phase 2: Foundational

- [X] T004 In `src/tools/image-convert/convert.ts` define and export types per [data-model.md](data-model.md): `SourceImage { name: string; path: string; ext: "jpg" | "jpeg" | "webp" }`, `ConversionResult { source; outPath: string; status: "converted" | "skipped" | "failed"; reason?: string; warning?: string }` (string-literal unions, no `enum` — Principle IV)
- [X] T005 In `src/tools/image-convert/convert.ts` implement `listSources(folder)`: `readdir(folder, { withFileTypes: true })`, keep only regular files (no subfolders — FR-004b) whose lower-cased extension is `jpg`, `jpeg` or `webp` (FR-002), sorted by name; never open other files (FR-005)

**Checkpoint**: sources can be listed.

---

## Phase 3: User Story 1 - Convert a folder of images to PNG (Priority: P1) 🎯 MVP

**Goal**: `npm run img:png -- <folder>` writes a PNG for each JPEG/WebP into `<folder>/png/`, originals untouched, with per-file lines and a summary.

**Independent Test**: [quickstart.md](quickstart.md) scenarios 1–2 (minus conflict/broken rows), 5, 6, 7, 8.

- [X] T006 [US1] In `src/tools/image-convert/convert.ts` implement `convertOne(source, outPath)`: `sharp(source.path).rotate()` (auto-orient, research §2), read `metadata().pages` and set `warning: "animated WebP — first frame only"` when `(pages ?? 1) > 1` (research §3), `.png().toBuffer()`, then `writeFile(outPath, buffer)` — buffer first so no partial PNG is ever written (research §5); return a `ConversionResult` with `status: "converted"`
- [X] T007 [US1] In `src/tools/image-convert/index.ts` implement the CLI with `node:util` `parseArgs` (`allowPositionals`, options `force`/`f` boolean, `help`/`h` boolean): print usage and exit 0 on `--help`; usage on stderr and exit 1 if the folder is missing or an option is unknown; resolve the folder against cwd and exit 1 with `[img:png] Not a folder: <path>` on stderr if it doesn't exist or isn't a directory ([contracts/cli.md](contracts/cli.md))
- [X] T008 [US1] In `src/tools/image-convert/index.ts`: call `listSources`; if empty print `[img:png] No .jpg, .jpeg or .webp files in <abs folder>` and exit 0 without creating `png/`; otherwise `mkdir <folder>/png` (recursive), convert each source sequentially to `png/<base>.png`, print one aligned line per result exactly as in [contracts/cli.md](contracts/cli.md), then the summary line `[img:png] N converted, N skipped, N failed — output: <abs png dir>`
- [X] T009 [US1] Run `npm run typecheck` (must exit 0) and the cross-tool import grep from [quickstart.md](quickstart.md) §1 (must print nothing)
- [X] T010 [US1] Build the fixture folder from [quickstart.md](quickstart.md) §2 in the session scratchpad with a throwaway sharp script; run scenarios 5–8 and the happy-path parts of 1–2 (a, b, c, rot converted; `c.png` has alpha; `rot.png` is 10×30; originals and `keep.png`/`notes.txt`/`sub/` untouched)
- [X] T011 [US1] Commit as `feat: add img:png image converter (jpg/jpeg/webp → png)`

**Checkpoint**: MVP — a folder of images converts in one command.

---

## Phase 4: User Story 2 - Safe re-runs and clear failures (Priority: P2)

**Goal**: Re-runs never clobber, `--force` overwrites, name conflicts are skipped, one bad file doesn't stop the batch, exit 1 on any failure.

**Independent Test**: [quickstart.md](quickstart.md) scenarios 1, 3, 4 in full.

- [X] T012 [US2] In `src/tools/image-convert/convert.ts` implement `planConversions(sources, outDir, force)`: map each source to `<outDir>/<base>.png`; track claimed targets by **lower-cased** path — a later source with an already-claimed target → `skipped`, `reason: "name conflict with <first name>"` even with `force`; else if the target exists and `!force` → `skipped`, `reason: "already exists: png/<file> — use --force to overwrite"`; else → to convert (research §6)
- [X] T013 [US2] In `src/tools/image-convert/index.ts` use `planConversions` before converting; wrap each `convertOne` in try/catch → `failed` with `reason: error.message` and keep going (FR-007); only `mkdir png/` if at least one file will be converted; set `process.exitCode = 1` when any result failed (research §7)
- [X] T014 [US2] Run `npm run typecheck`, then [quickstart.md](quickstart.md) scenarios 1, 3 and 4 in full against the fixture folder and confirm the exact counts listed there
- [X] T015 [US2] Commit as `feat(img:png): skip existing/conflicting files, --force, isolate failures`

**Checkpoint**: tool is safe to re-run.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T016 Performance check per [quickstart.md](quickstart.md) §4: 50 generated 1920×1080 JPEGs in the scratchpad convert in < 30 s (SC-001)
- [X] T017 [P] In `AGENTS.md`: add `npm run img:png -- <folder> [--force]` to the Commands table; add an `image-convert` row to the Project Overview tools table; add `image-convert/` to the Toolbox Layout tree and the Architecture tree (`index.ts` CLI, `convert.ts` logic); add an "Image Converter (`npm run img:png`)" section summarizing behavior (png/ subfolder, originals kept, top-level only, skip/--force/conflict rules, exit codes)
- [X] T018 [P] In `README.md`: add an image-convert row to the tools table and a short usage example
- [X] T019 Run `npm run typecheck` and smoke-test `npm run clamp -- 24` (existing tools unaffected); commit as `docs: document img:png in AGENTS.md and README`
- [X] T020 Delete the scratchpad fixtures/spike folders; confirm `git status` is clean and no images were added to the repo

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US1 → US2 → Polish
- US2 extends the same two files as US1, so it runs after US1.
- T017 and T018 are parallel (different files).

## Parallel Opportunities

```text
Polish: T017 (AGENTS.md) alongside T018 (README.md)
```

## Implementation Strategy

MVP = Phases 1–3 (US1): after T011 the converter works on a fresh folder. US2 makes it safe for
re-runs and messy folders; Polish documents it.
