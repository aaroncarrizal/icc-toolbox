# Contract: `npm run img:png`

## Usage

```text
npm run img:png -- <folder> [--force]
npm run img:png -- --help
```

| Argument | Required | Meaning |
|---|---|---|
| `<folder>` | yes | Folder to scan (relative to the project root, or absolute). Only files directly inside it are processed. |
| `--force`, `-f` | no | Overwrite PNGs that already exist in `<folder>/png/`. Does **not** override name conflicts. |
| `--help`, `-h` | no | Print usage and exit 0. |

## Output (stdout)

One line per eligible file, in name order, then a summary:

```text
[img:png] converted  hero.jpg   -> png/hero.png
[img:png] converted  banner.webp -> png/banner.png  (warning: animated WebP — first frame only)
[img:png] skipped    logo.jpg   (already exists: png/logo.png — use --force to overwrite)
[img:png] skipped    logo.webp  (name conflict with logo.jpg)
[img:png] failed     broken.jpg (Input buffer contains unsupported image format)
[img:png] 2 converted, 2 skipped, 1 failed — output: C:\...\images\png
```

No eligible files:

```text
[img:png] No .jpg, .jpeg or .webp files in C:\...\images
```

## Errors (stderr) and exit codes

| Situation | stderr | Exit |
|---|---|---|
| All files converted/skipped, or nothing to do | — | 0 |
| One or more files failed | (failed lines stay on stdout) | 1 |
| Missing `<folder>` argument / unknown option | usage message | 1 |
| `<folder>` doesn't exist or isn't a directory | `[img:png] Not a folder: <path>` | 1 |

## Guarantees

- Original files are never modified, moved or deleted.
- Non-eligible files are never opened.
- A PNG is written only after it has been fully encoded (no partial files).
- `png/` is created only if at least one file will be converted.
