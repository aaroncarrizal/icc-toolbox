# image-convert (`npm run img:png`)

Converts `.jpg`, `.jpeg` and `.webp` images to `.png`, for dealer sites that need PNG uploads.

## Usage

```bash
npm run img:png -- <folder>            # convert
npm run img:png -- <folder> --force    # also overwrite PNGs that already exist
npm run img:png -- --help              # usage
```

`<folder>` is relative to the project root, or absolute. Example:

```bash
npm run img:png -- "C:/Users/me/Downloads/campsite-photos"
```

```text
[img:png] converted  a.jpg      -> png/a.png
[img:png] converted  banner.webp -> png/banner.png
[img:png] skipped    logo.webp  (name conflict with logo.jpg)
[img:png] failed     broken.jpg (Input file contains unsupported image format)
[img:png] 2 converted, 1 skipped, 1 failed — output: C:\Users\me\Downloads\campsite-photos\png
```

## Behavior

| Rule | Detail |
|---|---|
| Which files | `.jpg`, `.jpeg`, `.webp` in any letter case, **directly** in `<folder>`. Subfolders (including `png/`) are not scanned. Every other file is ignored and never opened. |
| Where output goes | `<folder>/png/<same base name>.png`. `png/` is created only if at least one file will be written. |
| Originals | Never modified, moved or deleted. |
| Image fidelity | Same displayed size as the source. WebP transparency is kept. JPEG EXIF rotation is applied, so phone photos aren't sideways (PNG has no rotation tag). Metadata (EXIF, camera info) is dropped. |
| Animated WebP | Only the first frame is converted; the line shows a warning. |
| PNG already exists | Skipped — `--force` overwrites it. |
| Name conflict | `logo.jpg` and `logo.webp` both map to `logo.png` (compared case-insensitively, like Windows/macOS). The first in name order wins; the others are skipped even with `--force`. |
| Broken file | Reported as `failed` with the reason; the rest of the batch still converts. |
| Partial files | Never — each PNG is fully encoded in memory before it's written. |

## Exit codes

| Code | When |
|---|---|
| `0` | Every file was converted or skipped, or there was nothing to convert |
| `1` | Missing/unknown argument, folder doesn't exist or isn't a folder, or any file failed |

## Notes

- PNG is lossless, so the PNG is often **larger** than the JPEG/WebP it came from. Getting files
  under a size limit is the job of the separate image-compress tool (planned).
- Speed: 50 photo-like 1920×1080 JPEGs convert in about 7.5 s.
- Don't commit images: point the command at a folder outside the repo.

## Code

| File | Role |
|---|---|
| `index.ts` | CLI shell — arguments (`node:util` `parseArgs`), folder check, per-file lines, summary, exit code |
| `convert.ts` | `listSources` (find eligible files) → `planConversions` (skip / conflict decisions) → `convertOne` (decode with [sharp](https://sharp.pixelplumbing.com/), auto-orient, encode PNG, write). Never prints. |

Imports only `node:*` and `sharp` — nothing from other tools (see the Toolbox Layout rules in
[AGENTS.md](../../../AGENTS.md)). Design history: [specs/002-image-convert/](../../../specs/002-image-convert/).
