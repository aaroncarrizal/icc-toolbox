---

description: "Task list for the multi-tool layout restructure"
---

# Tasks: Multi-Tool Layout

**Input**: Design documents from `/specs/001-multi-tool-layout/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/commands.md, quickstart.md

**Tests**: No automated tests requested. Validation is `npm run typecheck`, `npm run build` and
the smoke runs in [quickstart.md](quickstart.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

- [ ] T001 Record baseline outputs of `npm run clamp -- 24`, `npm run vw -- 24`, `npm run vh -- 24` into the session scratchpad (not the repo) for later comparison
- [ ] T002 Confirm `npm run typecheck` passes on the current tree before any move (so later failures are attributable to the move)

---

## Phase 2: Foundational

- [ ] T003 Create folders `src/tools/css-injector/`, `src/tools/units/` and `src/shared/`, and add `src/shared/.gitkeep` (Git doesn't track empty directories; same pattern as `scripts/.gitkeep`)

**Checkpoint**: target folders exist.

---

## Phase 3: User Story 1 - Existing daily workflow keeps working (Priority: P1) 🎯 MVP

**Goal**: All 9 npm scripts keep their names and behavior from the new locations.

**Independent Test**: [quickstart.md](quickstart.md) sections 2–3: typecheck + build pass, converter output matches baseline, `dev`/`css`/`dbg`/`start` work against the configured site.

- [ ] T004 [P] [US1] `git mv` the 13 injector files — `index.ts css-cli.ts dbg.ts cdp.ts chrome.ts config.ts console-log.ts css-lint.ts injector.ts page-runtime.ts sources.ts state.ts watcher.ts` — from `src/` to `src/tools/css-injector/`, without editing their contents
- [ ] T005 [P] [US1] `git mv` `src/clamp.ts`, `src/vw.ts`, `src/vh.ts` to `src/tools/units/`, without editing their contents
- [ ] T006 [US1] Update script paths in `package.json` exactly as in [contracts/commands.md](contracts/commands.md) (`dev`, `css`, `dbg`, `clamp`, `vw`, `vh`); leave `build`, `start`, `typecheck` and `bin` unchanged
- [ ] T007 [P] [US1] Change `lib.entry` in `vite.config.ts` to `src/tools/css-injector/index.ts`, keeping `fileName: "index"` so output stays `dist/index.js`
- [ ] T008 [US1] Run `npm run typecheck` and `npm run build`; both must exit 0
- [ ] T009 [US1] Run `npm run clamp/vw/vh -- 24` and diff against the T001 baseline — must be identical
- [ ] T010 [US1] Smoke-test `npm run dev` (site opens, CSS injected), then with it running `npm run css -- list` and `npm run dbg -- styles body`; stop it and smoke-test `npm start`
- [ ] T011 [US1] Commit moves + `package.json` + `vite.config.ts` together as `refactor: move css-injector and units into src/tools/` (moved files unedited → 100% rename similarity)

**Checkpoint**: MVP — every command works from the new layout.

---

## Phase 4: User Story 2 - Clear place to add a new tool (Priority: P2)

**Goal**: Docs explain the layout and the isolation rule; no stale paths remain.

**Independent Test**: A reader of AGENTS.md can say where a new tool, shared code and its npm script go; the stale-path grep in [quickstart.md](quickstart.md) prints nothing.

- [ ] T012 [US2] In `AGENTS.md`: update Project Overview to describe icc-toolbox as a multi-tool package; add a "Toolbox Layout" section stating `src/tools/<name>/` per tool, `src/shared/` for code used by ≥ 2 tools, "a tool may import from `src/shared/` but never from another tool", namespaced scripts for new tools (e.g. `img:png`), and a tools table (css-injector, units); rewrite the Architecture tree with the new paths
- [ ] T013 [P] [US2] In `README.md`: update the intro to describe the toolbox and its tools, change "the TypeScript in `src/`" wording if needed, and change the `src/cdp.ts` reference to `src/tools/css-injector/cdp.ts`
- [ ] T014 [US2] Run the stale-path grep and the cross-tool import grep from [quickstart.md](quickstart.md) section 2; both must print nothing (fix any hits in `AGENTS.md`, `README.md`, `.claude/skills/set-up/SKILL.md`, `.claude/skills/custom-forms/SKILL.md`)
- [ ] T015 [US2] Commit as `docs: describe multi-tool layout in AGENTS.md and README`

**Checkpoint**: layout documented.

---

## Phase 5: User Story 3 - History is preserved (Priority: P3)

**Goal**: Moved files show pre-move history.

**Independent Test**: `git log --follow` on a moved file lists commits older than the move.

- [ ] T016 [US3] Run `git log --follow --oneline src/tools/css-injector/cdp.ts` and `git log --follow --oneline src/tools/units/clamp.ts`; both must show commits from before T011

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T017 Remove the Sync Impact Report HTML comment from `.specify/memory/constitution.md` (it is review scratch, not governance content) and commit as `docs: drop constitution sync report`
- [ ] T018 Final check: `git status` clean, `npm run typecheck` passes

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US1 (Phase 3) → US2 (Phase 4) → US3 (Phase 5) → Polish
- US2 depends on US1 (docs describe the final paths). US3 depends on the T011 commit.
- Within US1: T004/T005/T007 are parallel; T006 after T004+T005; T008–T010 after T004–T007; T011 last.

## Parallel Opportunities

```text
US1: T004, T005, T007 together (different files)
US2: T013 alongside T012
```

## Implementation Strategy

MVP = Phase 1–3 (US1): after T011 the restructure is complete and safe to use. US2 and US3 are
documentation and verification on top.
