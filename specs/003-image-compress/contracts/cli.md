# Contract: `npm run img:compress`

## Usage

```text
npm run img:compress -- <folder> [--force] [--max <size>] [--max-width <px>]
npm run img:compress -- --help
```

| Argument | Required | Meaning |
|---|---|---|
| `<folder>` | yes | Folder to scan (relative to the project root, or absolute). Only files directly inside it. |
| `--force`, `-f` | no | Overwrite files that already exist in `<folder>/compressed/`. |
| `--max <size>` | no | Size limit per file. Default `1MB`. Accepts `1MB`, `800KB`, `1.5MB` or bytes. Decimal units (1MB = 1,000,000 bytes). |
| `--max-width <px>` | no | Scale anything wider than this down first (also re-encodes files already under the limit). Positive integer. |
| `--help`, `-h` | no | Print usage, exit 0. |

## Output (stdout)

```text
[img:compress] compressed  hero.jpg     4.2 MB -> 912 KB  (quality 75)
[img:compress] compressed  banner.png  10.8 MB -> 654 KB  (palette q75)
[img:compress] compressed  huge.jpg     9.8 MB -> 987 KB  (resized 3200px, quality 60)
[img:compress] copied      logo.png     84 KB
[img:compress] skipped     old.jpg      (already exists — use --force to overwrite)
[img:compress] failed      broken.jpg   (Input file contains unsupported image format)
[img:compress] 3 compressed, 1 copied, 1 skipped, 1 failed — 24.9 MB -> 2.6 MB (saved 22.3 MB, 90%) — output: C:\...\compressed
```

Sizes are decimal (1 KB = 1,000 B, 1 MB = 1,000,000 B), one decimal place for MB, none for KB.

No eligible files: `[img:compress] No .jpg, .jpeg, .webp or .png files in <abs folder>`

## Errors and exit codes

| Situation | Output | Exit |
|---|---|---|
| All files compressed/copied/skipped, or nothing to do | — | 0 |
| Any file failed | failed lines on stdout | 1 |
| Missing folder arg, unknown option, bad `--max` / `--max-width` | message + usage on stderr | 1 |
| Folder missing / not a directory | `[img:compress] Not a folder: <path>` on stderr | 1 |

## Guarantees

- Every file written to `compressed/` is ≤ the limit.
- Originals and non-eligible files are never modified; subfolders are not scanned.
- Nothing is written for a failed file; `compressed/` is created only if something will be written.
