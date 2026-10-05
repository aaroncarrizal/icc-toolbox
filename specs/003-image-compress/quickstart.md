# Quickstart: Validate the Image Compressor

## Prerequisites

- `npm install` done (sharp already present)
- Fixture folders in the **session scratchpad**, never in the repo

## 1. Static checks

```bash
npm run typecheck                      # exits 0
grep -rnE "from \"\.\./" src/tools/    # only "../../shared/..." imports allowed, no other tool
```

## 2. Fixtures (generate with a throwaway sharp script)

| File | Purpose |
|---|---|
| `photo.jpg` 4000×3000 noisy, ~3.6 MB | quality ladder then resize |
| `easy.jpg` 3000×2000 smooth, > 1 MB | fits at q85 |
| `graphic.png` 3000×2000 RGBA noisy, ~10 MB | palette step, alpha kept |
| `pic.webp` large, > 1 MB | WebP ladder |
| `small.png` < 1 MB | copied byte-for-byte |
| `rot.jpg` small, EXIF orientation 6 | copied (orientation flag kept) |
| `IMPOSSIBLE.JPG` 1000×1000 pure noise, ~1.5 MB | upper-case ext; fits 1 MB at q85, but with `--max 100KB` hits both floors → failed |
| `broken.jpg` (text bytes) | failed |
| `notes.txt`, `sub/x.jpg` | ignored |

## 3. Scenarios

| # | Command | Expected |
|---|---|---|
| 1 | `npm run img:compress -- <f>` | photo/easy/graphic/pic/IMPOSSIBLE compressed, small/rot copied, broken failed; every file in `compressed/` ≤ 1,000,000 B; exit 1 |
| 2 | inspect | `graphic.png` output has alpha; `small.png`/`rot.jpg` byte-identical to source; originals unchanged (size+mtime); no `sub/compressed`, no `broken.jpg` in `compressed/` |
| 3 | run #1 again | all previously written files skipped; broken still failed; no output mtime changes |
| 3b | `IMPOSSIBLE.JPG` + `easy.jpg` alone, `--max 100KB` | easy compressed; IMPOSSIBLE failed with `can't reach 100 KB at quality 60 / 1000px (best: …)`; nothing written for it; exit 1 |
| 4 | `--force --max 500KB` | every output ≤ 500,000 B or failed |
| 5 | `--force --max-width 1920` | photo/easy/graphic/pic outputs ≤ 1920 px wide; small files narrower than 1920 still copied |
| 6 | empty folder | "No .jpg, .jpeg, .webp or .png files", exit 0, no `compressed/` |
| 7 | missing folder / no arg / `--max abc` / `--max-width -5` | error + exit 1 |
| 8 | `--help` | usage, exit 0 |
| 9 | `npm run img:png` scenarios 1–2 from specs/002-image-convert/quickstart.md | unchanged behavior after the shared refactor |

## 4. Performance (SC-002)

50 generated camera-like JPEGs (4000×3000, 3–5 MB) in the scratchpad: `img:compress` finishes in
< 60 s.
