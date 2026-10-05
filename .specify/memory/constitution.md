# icc-toolbox Constitution

## Core Principles

### I. Tool Isolation

icc-toolbox is a single package holding several independent dev-cycle tools (CSS injector +
debug CLI, unit converters, and future image tools).

- Each tool MUST live in its own folder, `src/tools/<name>/`, with its own entry point, its own
  config file (if any) and its own section in AGENTS.md.
- A tool MAY import from `src/shared/`; a tool MUST NOT import from another tool's folder.
- Code needed by two or more tools MUST be moved into `src/shared/` rather than cross-imported.

Rationale: any tool can be added, changed, extracted or deleted without breaking the others.

### II. CLI-First via npm Scripts

- Every tool MUST be runnable as `npm run <script> -- <args>`, taking input from arguments/stdin
  and writing results to stdout and errors to stderr.
- Existing script names (`dev`, `css`, `dbg`, `clamp`, `vw`, `vh`, `build`, `start`, `typecheck`)
  are a stable interface: they MUST NOT be renamed, removed or change behavior without explicit
  approval from the maintainer.
- New tools SHOULD use a namespaced script prefix (e.g. `img:png`, `img:compress`).

Rationale: the maintainer and AI agents drive everything through these commands; AGENTS.md and
skills depend on them.

### III. Page-Level CDP Only

- Any code that talks to Chrome MUST connect only through `Cdp.connectToSite()` (or an already
  open `Cdp` session) — one page's own websocket.
- Browser-level websocket connections, Puppeteer-style auto-attach and `Target.*` calls are
  prohibited.
- Functions passed to `cdp.evaluate(fn, ...args)` MUST be fully self-contained (only their own
  parameters), since they are serialized and run inside the page.

Rationale: a browser-level connection attaches to the DevTools frontend and renders nested
DevTools; a page-level connection makes that failure structurally impossible.

### IV. Erasable TypeScript, No Build Step

- Source in `src/` MUST run directly on Node 24+ with no build step for day-to-day scripts.
- Only erasable syntax is allowed: no `enum`, no `namespace`, no constructor parameter
  properties.
- Relative imports MUST use an explicit `.ts` extension; type-only imports MUST use
  `import type`.

Rationale: zero-build edit-run loop; `npm run build` exists only for the distributable.

### V. Simplicity and Minimal Dependencies

- Prefer Node built-ins (`fetch`, `WebSocket`, `fs`, `path`) over packages.
- A new dependency MUST clearly earn its place (e.g. `sharp` for image encoding) and be noted in
  the feature's plan.
- No speculative abstractions: build what the current tool needs; extract to `src/shared/` only
  when a second tool actually needs it.

Rationale: one maintainer, small tools — fewer moving parts means faster fixes.

## Dealer-Site Work Constraints

- Fix priority for dealer sites is CSS → HTML → JS. JS injection is a last resort, opt-in via
  `"scripts": true`, and MUST be a guarded, idempotent IIFE that does not assume jQuery or the DOM.
- All CSS changes MUST go at the end of `styles/home.css`, start with the standard section
  comment, contain no other comments, no `@import`, use the brand color variables, keep selectors
  scoped to their section, and never underline links on hover unless asked.
- HTML changes are previewed with `dbg replace`/`dbg inner` and handed to the user; the toolbox
  never edits the CMS directly.

## Development Workflow

- Work happens on a branch, never directly on `master`.
- `npm run typecheck` MUST pass before every commit.
- Every npm script touched by a change MUST be smoke-tested (run at least once) before the change
  is reported complete.
- One commit per task, with a conventional message (`feat:`, `fix:`, `refactor:`, `docs:`,
  `chore:`).
- File moves MUST use `git mv` so history is preserved.
- AGENTS.md is the runtime guidance file: it MUST be updated in the same change whenever folder
  structure, commands or config change.

## Governance

This constitution supersedes ad-hoc practice for icc-toolbox. Every spec, plan and review MUST
check compliance with the principles above; any deviation MUST be justified in the plan's
Complexity Tracking section.

- Amendments: edit this file via `/speckit-constitution`, include a Sync Impact Report, and
  commit separately with a `docs:` message.
- Versioning: MAJOR for removing or redefining a principle, MINOR for adding a principle or
  section or materially expanding guidance, PATCH for wording and clarifications.
- Runtime development guidance lives in `AGENTS.md`; where the two conflict, this constitution
  wins and AGENTS.md MUST be corrected.

**Version**: 1.0.0 | **Ratified**: 2026-10-05 | **Last Amended**: 2026-10-05
