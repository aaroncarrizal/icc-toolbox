import { readdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import sharp from "sharp";

const EXTENSIONS = ["jpg", "jpeg", "webp"] as const;

export interface SourceImage {
  name: string;
  path: string;
  ext: (typeof EXTENSIONS)[number];
}

export interface ConversionResult {
  source: SourceImage;
  outPath: string;
  status: "converted" | "skipped" | "failed";
  reason?: string;
  warning?: string;
}

/** Eligible images directly in `folder` (no subfolders), sorted by name. Other files are never opened. */
export async function listSources(folder: string): Promise<SourceImage[]> {
  const entries = await readdir(folder, { withFileTypes: true });
  const sources: SourceImage[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = extname(entry.name).slice(1).toLowerCase();
    if (!(EXTENSIONS as readonly string[]).includes(ext)) continue;
    sources.push({ name: entry.name, path: join(folder, entry.name), ext: ext as SourceImage["ext"] });
  }
  return sources.sort((a, b) => a.name.localeCompare(b.name));
}

/** Target PNG path for a source: <outDir>/<base name>.png */
export function pngPathFor(source: SourceImage, outDir: string): string {
  return join(outDir, source.name.slice(0, -extname(source.name).length) + ".png");
}

/** Encodes fully in memory before writing, so a failure never leaves a partial PNG. */
export async function convertOne(source: SourceImage, outPath: string): Promise<ConversionResult> {
  const image = sharp(source.path);
  const { pages } = await image.metadata();
  // rotate() with no args applies EXIF orientation — PNG has no orientation tag to carry it.
  const buffer = await image.rotate().png().toBuffer();
  await writeFile(outPath, buffer);
  const result: ConversionResult = { source, outPath, status: "converted" };
  if ((pages ?? 1) > 1) result.warning = "animated WebP — first frame only";
  return result;
}
