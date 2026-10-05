# Quickstart: Validate the Image Converter

## Prerequisites

- `npm install` (pulls in `sharp`)
- A scratch fixture folder **outside the repo** (e.g. the session scratchpad) — never commit test
  images

## 1. Static checks

```bash
npm run typecheck                      # exits 0
grep -rnE "from \"\.\./" src/tools/    # prints nothing (no cross-tool imports)
```

## 2. Build a fixture folder

Generate (with a throwaway node script using sharp) into `<fixtures>/`:

| File | Purpose |
|---|---|
| `a.jpg` 300×200 | basic JPEG |
| `b.JPEG` 120×80 | upper-case extension |
| `c.webp` 64×64 with 50% alpha | transparency kept |
| `rot.jpg` 30×10, EXIF orientation 6 | auto-orient → 10×30 PNG |
| `logo.jpg` + `logo.webp` | name conflict |
| `broken.jpg` (text bytes) | failure isolation |
| `keep.png`, `notes.txt` | must be ignored |
| `sub/d.jpg` | subfolder must be ignored |

## 3. Scenarios

| # | Command | Expected |
|---|---|---|
| 1 | `npm run img:png -- <fixtures>` | `png/` holds a, b, c, rot, logo `.png`; `logo.webp` skipped (conflict); `broken.jpg` failed; exit 1; summary `5 converted, 1 skipped, 1 failed` |
| 2 | check outputs | `c.png` has alpha; `rot.png` is 10×30; others match source size; originals' byte sizes and mtimes unchanged; `keep.png`, `notes.txt`, `sub/` untouched; no `sub/png/` |
| 3 | run #1 again | 0 converted, 6 skipped (5 already exists + 1 conflict), 1 failed; no PNG mtime changes |
| 4 | delete `broken.jpg`, run with `--force` | 5 converted, 1 skipped (conflict), exit 0 |
| 5 | `npm run img:png -- <empty folder>` | "No .jpg, .jpeg or .webp files", exit 0, no `png/` created |
| 6 | `npm run img:png -- ./does-not-exist` | `Not a folder`, exit 1 |
| 7 | `npm run img:png` (no folder) | usage on stderr, exit 1 |
| 8 | `npm run img:png -- --help` | usage, exit 0 |

## 4. Performance (SC-001)

Generate 50 JPEGs at 1920×1080 and time `npm run img:png -- <folder>` — must finish in < 30 s.
