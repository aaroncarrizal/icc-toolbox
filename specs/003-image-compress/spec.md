# Feature Specification: Image Compressor

**Feature Branch**: `003-image-compress`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Image compressor tool for icc-toolbox: compress every image in a given folder so each file is at most 1 MB, for upload to dealer sites. Run as a namespaced npm script (img:compress) with the folder as an argument. New tool folder under src/tools/, isolated from other tools per the constitution. Sibling of the img:png converter — follow the same conventions (top-level folder only, originals untouched, output subfolder, per-file lines + summary, exit 1 on failures)."

## Clarifications

### Session 2026-10-05

- Q: How are files brought under 1 MB? → A: Keep format; lower quality (JPEG/WebP) or reduce colors (PNG) first, shrink dimensions only as a last resort.
- Q: What about files already under 1 MB? → A: Copy unchanged into `compressed/`.
- Q: Cap large images to a max width? → A: No cap by default; optional max-width setting.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Shrink a folder of images under 1 MB (Priority: P1)

The dealer CMS rejects (or slows down on) images over 1 MB. The maintainer has a folder of
photos and graphics, runs one command on it, and gets a version of every image that is at most
1 MB and still looks good on the site.

**Why this priority**: This is the whole feature; it replaces compressing images one by one in an
editor or online tool.

**Independent Test**: Put a mix of large and small `.jpg`, `.jpeg`, `.webp` and `.png` files in a
folder, run the command, and check every output file is ≤ 1 MB, visually acceptable, and the
originals are unchanged.

**Acceptance Scenarios**:

1. **Given** a folder with a 4 MB `.jpg` photo, a 3 MB `.png` graphic and a 2 MB `.webp`,
   **When** the maintainer runs the compress command, **Then** each gets an output file of at
   most 1 MB in a `compressed/` subfolder of that folder, compressed by keeping
   its format: JPEG/WebP quality is lowered step by step, PNG colors are reduced, and dimensions
   are shrunk only if that is still not enough.
2. **Given** a 300 KB image already under the limit, **When** the command runs, **Then** it is copied
   unchanged into `compressed/` and reported as `copied`, so `compressed/` is a complete upload set.
3. **Given** the run finishes, **Then** the originals are untouched, files of other types are
   ignored, and a summary shows per file the size before → after and the total saved.

---

### User Story 2 - Safe re-runs and clear failures (Priority: P2)

Same guarantees as `img:png`: re-runs never clobber existing output unless asked, and one bad or
impossible file doesn't stop the batch.

**Why this priority**: Makes the tool trustworthy for repeated use; US1 delivers the core value.

**Independent Test**: Run twice on the same folder; add a corrupt file and an image that can't
reach 1 MB at acceptable quality; run again.

**Acceptance Scenarios**:

1. **Given** output already exists for a file, **When** the command runs again, **Then** that file
   is skipped unless the maintainer passes an explicit overwrite option.
2. **Given** a corrupt file among valid ones, **When** the command runs, **Then** the valid files
   are still compressed, the corrupt one is reported with a reason, and the command ends with a
   failure status.
3. **Given** an image that cannot get under 1 MB without dropping below the minimum acceptable
   quality and size, **When** the command runs, **Then** it is reported as failed with a reason
   and no output is written for it (an over-limit file is never presented as a success).

### Edge Cases

- Folder missing / not a folder → clear error, failure status. No eligible files → message,
  success status.
- Extensions in any letter case are eligible; subfolders (including `compressed/`) are not scanned.
- PNGs with transparency must keep their transparency.
- Phone photos with a rotation flag must not come out sideways.
- Animated WebP → first frame only, with a warning.
- Very large dimensions (e.g. 6000×4000 camera originals) are only shrunk when needed to reach
  the limit; the maintainer can pass a maximum width to cap them anyway.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The maintainer MUST be able to run the compressor with one command, passing the
  folder to process.
- **FR-002**: Eligible files are `.jpg`, `.jpeg`, `.webp` and `.png` (case-insensitive) directly
  in the target folder; subfolders are not scanned and other files are never opened.
- **FR-003**: Every output file MUST be at most the size limit — default 1 MB, defined as
  1,000,000 bytes so it satisfies both "1 MB" conventions; the maintainer MAY pass a different
  limit.
- **FR-004**: Output files are written to a `compressed/` subfolder of the target folder (created
  if needed) and keep the source's base name.
- **FR-005**: Original files MUST be left untouched.
- **FR-006**: Transparency MUST be preserved for images that have it, and EXIF rotation applied.
- **FR-007**: Existing output MUST NOT be overwritten unless the maintainer passes an explicit
  overwrite option.
- **FR-008**: A failure on one file MUST NOT stop the others; a file that can't reach the limit at
  minimum acceptable quality is a failure, and no over-limit output is written for it.
- **FR-009**: The command MUST print a per-file line (size before → after, or skip/fail reason)
  and a summary (counts, total size saved, output location), and exit with a failure status if
  any file failed.
- **FR-003a**: Files over the limit keep their format. JPEG/WebP: quality is lowered step by step,
  never below the quality floor; PNG: colors are reduced to a palette. Only if that is not enough
  are dimensions reduced, never below the dimension floor.
- **FR-003b**: Files already at or under the limit are copied byte-for-byte into `compressed/` and
  reported as `copied`.
- **FR-003c**: No maximum width by default; an optional maximum-width setting scales wider images
  down first (and applies to files under the limit too, which are then re-encoded instead of
  copied).
- **FR-010**: The tool MUST be a separate tool in the toolbox and not depend on any other tool.

### Key Entities

- **Source image**: an eligible file in the target folder; name, path, format, size in bytes.
- **Compression result**: per source — compressed / copied / skipped (reason) / failed (reason),
  output path, size before and after, and what was changed (quality, dimensions).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of output files are ≤ the size limit.
- **SC-002**: A folder of 50 typical website images (≤ 10 MB each) is processed in under 60
  seconds.
- **SC-003**: Compressed photos show no visible artifacts at normal viewing size on a 1920 px wide
  screen (spot-check of 5 images).
- **SC-004**: 0 originals and 0 non-eligible files are modified by a run.
- **SC-005**: The maintainer can tell from the summary alone which files changed, by how much, and
  which failed and why.

## Assumptions

- Images are local files; no downloading or uploading.
- Quality floor: quality is never lowered below 60 (on a 1–100 scale); dimension floor: the
  longest side is never reduced below 1000 px. A file that still exceeds the limit at both floors
  fails (FR-008).
- Metadata (EXIF camera info) need not be preserved; dropping it also saves space.
- Command name follows the constitution's namespaced convention: `img:compress`.
- Shares conventions with `img:png` (top-level only, originals untouched, output subfolder,
  `--force`, exit codes) but no code — any shared code would move to `src/shared/` per the
  constitution.
