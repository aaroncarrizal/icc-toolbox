# Data Model: Image Compressor

In-memory only.

## ImageFile (shared, `src/shared/image-files.ts`)

| Field | Type | Rule |
|---|---|---|
| name | string | file name in the folder |
| path | string | absolute path |
| ext | string | lower-cased extension without the dot |

Returned by `listImageFiles(folder, extensions)`: regular files directly in `folder` whose
`ext` is in `extensions`, sorted by name.

## CompressionResult

| Field | Type | Rule |
|---|---|---|
| source | ImageFile (+ `size` in bytes) | |
| outPath | string | `<folder>/compressed/<source name>` (same name + extension) |
| status | `"compressed" \| "copied" \| "skipped" \| "failed"` | |
| outSize | number? | bytes written; set for compressed/copied; always ≤ limit |
| steps | string? | what changed, e.g. `quality 75`, `palette q75`, `resized 3707px, quality 60` |
| reason | string? | required for skipped (`already exists — use --force to overwrite`) and failed (error message, or `can't reach 1 MB at quality 60 / 1000px (best: 1.3 MB)`) |
| warning | string? | `animated WebP — first frame only` |

### State transitions (per source)

```text
planned ─(output exists && !force)──────────────────────────▶ skipped
   └─▶ size ≤ limit && !(maxWidth && width > maxWidth) ───────▶ copied
   └─▶ ladder: quality/palette steps ─(fits)─────────────────▶ compressed
                 └─(none fit)─▶ resize loop ─(fits)───────────▶ compressed
                                   └─(floor hit, still big)───▶ failed
   (any thrown error) ────────────────────────────────────────▶ failed
```

## RunSummary

| Field | Rule |
|---|---|
| compressed / copied / skipped / failed | counts |
| bytesBefore / bytesAfter | over compressed + copied files only |
| saved | `bytesBefore − bytesAfter`, printed human-readable with % |
| exitCode | `failed > 0 ? 1 : 0` |
