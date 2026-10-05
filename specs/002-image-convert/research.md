# Research: Image Format Converter

## 1. Image library

- **Decision**: `sharp` ^0.35.5.
- **Rationale**: Node has no built-in image codec. sharp decodes JPEG + WebP and encodes PNG,
  ships prebuilt binaries for win32-x64 (no compiler needed), supports Node ≥ 20.9, and includes
  TypeScript types. A spike in the session scratchpad on this machine (Node 26.9, libvips 8.18.7)
  confirmed: install works; WebP alpha is kept in the PNG (`hasAlpha: true`); corrupt input
  throws `Input buffer contains unsupported image format`.
- **Alternatives considered**: `jimp` (pure JS, no WebP decode without plugins, much slower);
  shelling out to ImageMagick (external install required on every machine); browser canvas via
  the existing Chrome/CDP (couples to css-injector — violates Principle I).

## 2. EXIF orientation

- **Decision**: Auto-orient (`sharp(...).rotate()` with no args) before encoding.
- **Rationale**: PNG has no orientation tag, so a phone JPEG with orientation 6 would come out
  sideways. Spike: a 30×10 JPEG with orientation 6 → 10×30 PNG, displayed the same as the source.
  "Same pixel dimensions" (FR-003/SC-002) therefore means the **displayed** dimensions.

## 3. Animated WebP

- **Decision**: Read `metadata().pages`; if > 1, convert the default (first) frame and attach a
  warning to that file's result.
- **Rationale**: sharp reads only page 0 unless `pages`/`animated` is requested; `pages` is
  `undefined` for single-frame images (spike), so check `(pages ?? 1) > 1`.

## 4. Argument parsing

- **Decision**: `node:util` `parseArgs` — one positional folder, `--force`/`-f` boolean,
  `--help`/`-h`.
- **Rationale**: Principle V: built-in beats commander for 2 options; keeps the tool free of any
  coupling to css-injector's CLI setup.

## 5. Writes and failure isolation

- **Decision**: Encode to a buffer, then `writeFile` the PNG. Wrap each file in its own
  try/catch; process sequentially.
- **Rationale**: Buffer-then-write means a decode/encode failure never leaves a partial PNG.
  Sequential keeps output ordered and memory bounded; libvips already multithreads each image, so
  50 web images finish well inside 30 s.
- **Alternatives considered**: `toFile()` directly (can leave a partial file on failure);
  parallel `Promise.all` (unordered output, memory spikes on large batches, little real gain).

## 6. Name conflicts and existing files

- **Decision**: Sort sources by name; map each to `png/<base>.png`; compare targets
  **case-insensitively** (Windows/macOS file systems are case-insensitive). First source wins,
  later ones are `skipped: name conflict with <first>` — even with `--force`. Then, if the target
  already exists on disk and `--force` is not set → `skipped: already exists`.
- **Rationale**: Deterministic, never silently overwrites (spec edge case, FR-006).

## 7. Exit codes

- **Decision**: `0` = every eligible file converted or skipped (including "nothing to convert");
  `1` = any file failed, or the folder is missing/not a directory, or bad arguments.
