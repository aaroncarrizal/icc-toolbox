# Research: Image Compressor

Spike run in the session scratchpad on this machine (sharp 0.35.5 / libvips 8.18.7, Node 26.9)
with deliberately hard, noise-heavy images.

| Input | Step | Bytes |
|---|---|---|
| 4000×3000 photo-like JPEG (q92) | source | 3,650,795 |
| | JPEG q90 / q80 / q70 / q60 (mozjpeg) | 2,976,738 / 1,915,404 / 1,359,164 / 1,050,700 |
| | WebP q60 | 1,054,738 |
| | resize to 3707 px wide, JPEG q60 | **915,213** ✅ |
| 3000×2000 RGBA PNG | source | 10,804,705 |
| | lossless, compressionLevel 9 | 7,184,782 |
| | palette q90 / q75 / q60 | 1,673,021 / **654,044** ✅ / 654,044 (alpha kept) |

## 1. Library

- **Decision**: Reuse `sharp` (already a dependency from img:png).
- **Rationale**: Handles JPEG (mozjpeg), WebP, PNG (lossless + libimagequant palette), resize and
  auto-orient. No new dependency (Principle V).

## 2. Strategy ladder (per spec FR-003a)

- **Decision**: Try encodings in a fixed order and keep the **first** result ≤ limit:
  - **JPEG**: `jpeg({ quality: q, mozjpeg: true })` for q = 85, 75, 65, 60.
  - **WebP**: `webp({ quality: q })` for q = 85, 75, 65, 60.
  - **PNG**: `png({ compressionLevel: 9, adaptiveFiltering: true })` (lossless) first, then
    `png({ palette: true, quality: q, effort: 7 })` for q = 90, 75, 60.
  - **Resize** (if the last step still exceeds the limit): estimate a new width with
    `width × √(limit / size) × 0.95`, re-encode at the floor setting (q60 / palette q60), repeat
    up to 4 times, never letting the longest side drop below **1000 px**. Still too big → failed.
- **Rationale**: Highest quality that fits wins; ≤ 4 encodes for the common case; the √ ratio
  converges in 1–2 resizes (spike: 1 step). Quality floor 60 and dimension floor 1000 px come from
  the spec's assumptions.
- **Alternatives considered**: Binary search over quality (more encodes, ~same result for this
  range); converting everything to JPEG (rejected in clarification); palette-only for PNG
  (lossless sometimes already fits and is exact — try it first).

## 3. Files already under the limit

- **Decision**: `copyFile` byte-for-byte → status `copied`. Exception: with `--max-width`, a file
  wider than that is resized and re-encoded at the top ladder step (q85 / lossless PNG) even if
  it was under the limit.
- **Rationale**: Clarification answer; copying keeps EXIF orientation intact (browsers honor it).

## 4. Orientation, alpha, metadata

- **Decision**: Every re-encode starts with `sharp(path).rotate()` (auto-orient) — metadata is
  dropped by default, which also saves bytes. PNG/WebP alpha passes through untouched (spike:
  palette PNG keeps alpha).

## 5. Size limit argument

- **Decision**: `--max <size>`, default `1MB`. Accepts `1MB`, `800KB`, `1.5MB` or plain bytes;
  decimal units (`1MB = 1,000,000`, `1KB = 1,000`) so the default satisfies both readings of
  "1 MB". Invalid → usage error, exit 1.

## 6. Shared code

- **Decision**: Move "list regular files directly in a folder whose lower-cased extension is in a
  set, sorted by name" to `src/shared/image-files.ts` as `listImageFiles(folder, extensions)`.
  image-convert's `listSources` becomes a thin wrapper; image-compress uses it directly.
- **Rationale**: Constitution Principle I — code needed by two tools goes to `src/shared/`, never
  cross-imported. Output formatting and planning differ between the tools, so they stay put.
- **Verification**: re-run img:png quickstart scenarios 1–2 after the refactor.

## 7. Existing output / failures / exit codes

- **Decision**: Same as img:png — existing `compressed/<name>` skipped unless `--force`; each
  file in its own try/catch; exit 1 if any failed or bad args/folder. No name conflicts are
  possible (output keeps the source's extension, so names are already unique in the folder).
- **Writes**: encode to a buffer, check size, then `writeFile` — an over-limit or failed encode
  never touches the output folder.

## 8. Throughput

- **Decision**: Sequential processing. The spike's worst-case photo took ~5 encodes; typical
  camera JPEGs fit at q85 after one or two encodes. Measure against SC-002 in polish; parallelism
  is a later optimization if needed.
