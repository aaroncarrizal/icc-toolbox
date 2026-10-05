# Data Model: Image Format Converter

In-memory only; nothing is persisted besides the PNG files.

## SourceImage

| Field | Type | Rule |
|---|---|---|
| name | string | file name in the target folder, e.g. `Hero.JPG` |
| path | string | absolute path |
| ext | `"jpg" \| "jpeg" \| "webp"` | lower-cased extension; only these are eligible (FR-002) |

Eligible = a regular file directly in the folder (FR-004b) whose extension, lower-cased, is one of
the three. Everything else is ignored and never opened (FR-005).

## ConversionResult

| Field | Type | Rule |
|---|---|---|
| source | SourceImage | |
| outPath | string | `<folder>/png/<base name>.png` (FR-004) |
| status | `"converted" \| "skipped" \| "failed"` | |
| reason | string? | required for `skipped` (`already exists`, `name conflict with <name>`) and `failed` (error message) |
| warning | string? | e.g. `animated WebP — first frame only` |

### State transitions (per source)

```text
planned ──(target name already claimed)────────────▶ skipped: name conflict
   │
   ├──(target exists && !force)───────────────────▶ skipped: already exists
   │
   └──▶ converting ──(decode/encode/write ok)──────▶ converted (+ optional warning)
                   └─(any error)──────────────────▶ failed: <message>
```

## RunSummary

| Field | Rule |
|---|---|
| converted / skipped / failed | counts of results by status |
| outDir | `<folder>/png` |
| exitCode | `failed > 0 ? 1 : 0` |
