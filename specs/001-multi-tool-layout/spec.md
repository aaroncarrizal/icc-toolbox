# Feature Specification: Multi-Tool Layout

**Feature Branch**: `001-multi-tool-layout`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Restructure icc-toolbox into a multi-tool layout. Move the existing CSS injector + debug CLI into its own tool folder and the px unit converters into another, preserving history. Add a shared area for code used by more than one tool. Tools may use shared code but never each other. All existing commands must keep working with identical behavior. Update build entry and docs. Pure move — no behavior changes. Future image tools (convert to PNG, compress to ≤1MB) are out of scope but the layout must accommodate them."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Existing daily workflow keeps working (Priority: P1)

The maintainer (and AI agents following AGENTS.md) keep using the same commands —
`npm run dev`, `npm run css -- …`, `npm run dbg -- …`, `npm run clamp/vw/vh -- …` — after the
restructure, with no change in what they do or print.

**Why this priority**: The CSS injector is the toolbox's main, in-use tool. A restructure that
breaks it has negative value.

**Independent Test**: After the move, run each command once against a configured dealer site and
compare output and behavior with the pre-move version.

**Acceptance Scenarios**:

1. **Given** a configured `.cssinjector.json`, **When** the maintainer runs `npm run dev`,
   **Then** Chrome opens the site, local CSS is injected and hot-reloads on save exactly as before.
2. **Given** the injector is running, **When** the maintainer runs `npm run css -- list` and
   `npm run dbg -- why "<selector>" <prop>`, **Then** both return the same results as before.
3. **Given** any terminal, **When** the maintainer runs `npm run clamp -- 24`, **Then** the
   output is identical to the pre-move output.
4. **Given** the restructured repo, **When** the maintainer runs `npm run typecheck` and
   `npm run build`, **Then** both succeed, and `npm start` runs the built injector.

---

### User Story 2 - Clear place to add a new tool (Priority: P2)

The maintainer wants to add a new tool (e.g. an image converter) by creating one new folder and
one new npm script, without touching or understanding the CSS injector's code.

**Why this priority**: This is the reason for the restructure, but it delivers value only once
US1 is intact.

**Independent Test**: Inspect the layout and AGENTS.md: a new contributor can tell where a new
tool goes, where shared code goes, and which imports are forbidden.

**Acceptance Scenarios**:

1. **Given** the restructured repo, **When** a contributor reads AGENTS.md, **Then** it names the
   per-tool folder convention, the shared folder and the "no cross-tool imports" rule.
2. **Given** the restructured repo, **When** the source tree is inspected, **Then** each existing
   tool lives in its own folder and no tool imports from another tool's folder.

---

### User Story 3 - History is preserved (Priority: P3)

The maintainer can still see the full change history of each moved file at its new location.

**Why this priority**: Useful for blame/archaeology, but doesn't affect daily use.

**Independent Test**: Run a history-following log on a moved file and see commits from before
the move.

**Acceptance Scenarios**:

1. **Given** the move is committed, **When** the maintainer views the history of a moved file
   following renames, **Then** pre-move commits appear.

### Edge Cases

- Code that resolves paths relative to its own file location (rather than the working directory)
  could silently point to the wrong place after moving deeper into the tree.
- Dealer branches created from the old `master` will need to merge this change; dealer-owned
  files (`styles/`, `scripts/`, `snippets/`, `.cssinjector.json`) must not move, so merges don't
  conflict on them.
- Skills and docs that mention old source paths (e.g. `src/cdp.ts`) must be updated so agents
  don't look in the wrong place.
- The unit converters must not end up importing from the CSS injector (or vice versa).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The CSS injector, source-toggle CLI and debug CLI MUST live together in one
  dedicated tool folder.
- **FR-002**: The px → clamp/vw/vh converters MUST live in their own separate tool folder.
- **FR-003**: A shared folder MUST exist for code used by more than one tool; it starts empty.
- **FR-004**: No tool folder MUST import from another tool folder.
- **FR-005**: All existing commands (`dev`, `css`, `dbg`, `clamp`, `vw`, `vh`, `build`, `start`,
  `typecheck`) MUST keep their names and produce identical behavior.
- **FR-006**: File moves MUST preserve per-file version history.
- **FR-007**: Dealer-owned working files and folders (`styles/`, `scripts/`, `snippets/`,
  `debug/`, `.cssinjector*.json`, `.cssinjector.state.json`) MUST stay where they are.
- **FR-008**: AGENTS.md and README MUST describe the new layout and the tool-isolation rule, and
  every reference to an old source path in docs and skills MUST point to the new location.
- **FR-009**: The layout MUST allow adding a future tool (image converter, image compressor) as a
  new folder plus a new command, with no edits to existing tools.

### Key Entities

- **Tool**: a self-contained capability with its own folder, entry point(s), commands, optional
  config and AGENTS.md section. Existing: css-injector, units.
- **Shared module area**: code usable by any tool; contains nothing owned by a single tool.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 9 of 9 existing commands run successfully after the restructure, with behavior
  unchanged from before.
- **SC-002**: 0 imports cross from one tool folder into another.
- **SC-003**: 100% of moved files show pre-move commits when their history is viewed.
- **SC-004**: 0 references to old source paths remain in docs and skills.
- **SC-005**: Adding a new tool requires changes in only 3 places: a new tool folder, one new
  command entry, and one new docs section.

## Assumptions

- The restructure is a single package (not a multi-package workspace); dependencies stay shared.
- Tool folder names: `css-injector` and `units`; shared folder: `shared`.
- Config file names (`.cssinjector.json`, `.cssinjector.state.json`) keep their names to avoid
  breaking existing dealer branches and the `/set-up` skill; renaming them is out of scope.
- No new `icc <tool>` dispatcher command is added in this feature.
- The image converter and image compressor are separate future features.
