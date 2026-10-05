# Feature Specification: Image Format Converter

**Feature Branch**: `002-image-convert`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Image format converter tool for icc-toolbox: convert every .jpeg, .jpg and .webp image stored in a given folder to .png. Run as an npm script (namespaced, e.g. img:png) with the folder as an argument. New tool folder under src/tools/, isolated from the css-injector per the constitution."

## Clarifications

### Session 2026-10-05

- Q: Where are PNGs saved? → A: A `png/` subfolder of the target folder.
- Q: What happens to originals? → A: Kept untouched.
- Q: Are subfolders included? → A: No, top-level folder only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Convert a folder of images to PNG (Priority: P1)

While building or migrating a dealer site, the maintainer has a folder of JPEG/WebP images
(e.g. downloaded from an old site or a supplier) that must be PNG for upload. They run one
command pointing at that folder and get a PNG version of every eligible image.

**Why this priority**: This is the whole feature; it replaces converting images one by one in an
editor or online tool.

**Independent Test**: Put a mix of `.jpg`, `.jpeg`, `.webp`, `.png` and non-image files in a
folder, run the command on it, and check that exactly one PNG was produced per JPEG/WebP file and
nothing else was touched.

**Acceptance Scenarios**:

1. **Given** a folder with `a.jpg`, `b.jpeg` and `c.webp`, **When** the maintainer runs the
   convert command on it, **Then** `a.png`, `b.png` and `c.png` are created in a `png/` subfolder of that folder (created
   if missing), and each looks the same as its source (same pixel dimensions, transparency kept).
2. **Given** the same folder, **When** the conversion finishes, **Then** the original files are still there, unchanged.
3. **Given** a folder that also contains `.png`, `.gif`, `.txt` files, **When** the command runs,
   **Then** those files are ignored and not modified.
4. **Given** a successful run, **When** it finishes, **Then** a summary shows how many files were
   converted, skipped and failed, and the output location.

---

### User Story 2 - Safe re-runs and clear failures (Priority: P2)

The maintainer re-runs the command after adding a few more images, or on a folder containing a
broken file, and nothing already converted is clobbered and one bad file doesn't stop the batch.

**Why this priority**: Makes the tool trustworthy for repeated use, but US1 already delivers the
core value.

**Independent Test**: Run the command twice on the same folder; then add a corrupt `.jpg` and run
again.

**Acceptance Scenarios**:

1. **Given** `a.png` already exists for `a.jpg`, **When** the command runs again, **Then** `a.jpg`
   is skipped and reported as skipped, unless the maintainer passes an explicit overwrite option.
2. **Given** a corrupt or unreadable `bad.jpg` among valid images, **When** the command runs,
   **Then** every valid image is still converted, `bad.jpg` is reported with a reason, and the
   command ends with a failure status.

### Edge Cases

- Folder path doesn't exist or isn't a folder → clear error, nothing converted, failure status.
- Folder has no eligible images → message saying so, success status.
- Extensions in any letter case (`.JPG`, `.Jpeg`, `.WEBP`) are treated as eligible.
- Two sources with the same base name (`logo.jpg` and `logo.webp`) would produce the same
  `logo.png` → the second is skipped and reported as a name conflict, never silently overwritten.
- Animated WebP → converted from its first frame, with a warning in the summary.
- File names with spaces or non-ASCII characters convert correctly.
- Subfolders (including an existing `png/` output folder) are not scanned; only images directly
  in the target folder are converted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The maintainer MUST be able to run the converter with one command, passing the
  folder to process.
- **FR-002**: The converter MUST convert every file with extension `.jpg`, `.jpeg` or `.webp`
  (case-insensitive) in the target folder to PNG.
- **FR-003**: Each PNG MUST keep the source's pixel dimensions and, for WebP, its transparency.
- **FR-004**: Each PNG MUST keep the source's base file name, with a `.png` extension, and be
  written to a `png/` subfolder of the target folder (created if missing).
- **FR-004a**: Original files MUST be left untouched (never modified, moved or deleted).
- **FR-004b**: Only files directly in the target folder are processed; subfolders are not scanned.
- **FR-005**: Files with any other extension MUST NOT be read, changed or moved.
- **FR-006**: An existing PNG with the target name MUST NOT be overwritten unless the maintainer
  passes an explicit overwrite option.
- **FR-007**: A failure on one file MUST NOT stop the other files from converting.
- **FR-008**: The command MUST print a per-file result line and a final summary (converted,
  skipped, failed, output location) and exit with a failure status if any file failed.
- **FR-009**: The tool MUST be a separate tool in the toolbox and not depend on any other tool.

### Key Entities

- **Source image**: a JPEG or WebP file in the target folder; has name, path, format.
- **Conversion result**: per source — converted / skipped (with reason) / failed (with reason),
  plus the output path.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A folder of 50 typical website images (≤ 5 MB each) converts with one command in
  under 30 seconds.
- **SC-002**: 100% of valid JPEG/WebP files in the folder produce a PNG with identical pixel
  dimensions.
- **SC-003**: 0 non-eligible files are modified by a run.
- **SC-004**: Re-running on an already converted folder converts 0 files and overwrites 0 files
  (without the overwrite option).
- **SC-005**: The maintainer can tell from the summary alone, without opening the folder, which
  files failed and why.

## Assumptions

- Images are local files on the maintainer's machine; no downloading or uploading.
- PNG output is lossless; the PNG may be larger than the source — shrinking is the job of the
  separate image-compress tool (future feature).
- Metadata (EXIF, color profile beyond what's needed to display correctly) need not be preserved.
- The folder argument is relative to the project root or absolute.
- Command name follows the constitution's namespaced convention: `img:png`.
