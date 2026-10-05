# Research: Multi-Tool Layout

No NEEDS CLARIFICATION items remained in Technical Context; these are the decisions verified
against the code.

## 1. Do runtime paths depend on file location?

- **Decision**: No changes needed.
- **Rationale**: Every runtime path uses `resolve("<relative>")` against `process.cwd()`
  (`config.ts` → `.cssinjector.json`, `state.ts` → `.cssinjector.state.json`, `chrome.ts` →
  `.chrome-profile`, `console-log.ts`/`dbg.ts` → `debug/`). No `import.meta.url`, `__dirname`
  or `fileURLToPath` usage exists. npm scripts always run from the package root, so cwd is
  unchanged.
- **Alternatives considered**: Anchoring paths to the repo root via `import.meta` — rejected,
  would be a behavior change and is unnecessary.

## 2. Do imports need rewriting?

- **Decision**: No import edits.
- **Rationale**: All imports among injector files are sibling `./x.ts` imports and the whole
  group moves together; `clamp.ts`/`vw.ts`/`vh.ts` have no imports at all. No file imports
  across the two groups.
- **Alternatives considered**: Path aliases (`#shared/*` via package `imports`) — deferred until
  `shared/` actually has content (Principle V).

## 3. Preserving history

- **Decision**: `git mv` each file and leave moved files' contents untouched, so Git's rename
  detection is 100% similarity. The `package.json`/`vite.config.ts` path updates go in the same
  commit so every commit on the branch stays runnable.
- **Rationale**: `git log --follow` then shows pre-move history (SC-003).
- **Alternatives considered**: Move + edit in one commit — rejected; lowers similarity and risks
  rename detection failing.

## 4. Empty `src/shared/`

- **Decision**: Add `src/shared/.gitkeep`.
- **Rationale**: Git doesn't track empty directories; the repo already uses this pattern
  (`scripts/.gitkeep`).

## 5. Build entry

- **Decision**: Change `vite.config.ts` `lib.entry` to `src/tools/css-injector/index.ts`; keep
  `fileName: "index"`.
- **Rationale**: Output stays `dist/index.js`, so `bin` and `npm start` don't change.
