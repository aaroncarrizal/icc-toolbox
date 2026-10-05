import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import sharp from "sharp";
import { listImageFiles } from "../../shared/image-files.ts";

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
  return (await listImageFiles(folder, EXTENSIONS)) as SourceImage[];
}

/** Target PNG path for a source: <outDir>/<base name>.png */
export function pngPathFor(source: SourceImage, outDir: string): string {
  return join(outDir, source.name.slice(0, -extname(source.name).length) + ".png");
}

export interface PlannedConversion {
  source: SourceImage;
  outPath: string;
  skip?: string;
}

/**
 * Decides what happens to each source before anything is written. Targets are compared
 * case-insensitively (Windows/macOS file systems are), so `logo.jpg` and `Logo.webp` conflict:
 * the first one in name order wins, the rest are skipped even with --force.
 */
export function planConversions(sources: SourceImage[], outDir: string, force: boolean): PlannedConversion[] {
  const claimed = new Map<string, string>();
  return sources.map((source) => {
    const outPath = pngPathFor(source, outDir);
    const key = outPath.toLowerCase();
    const owner = claimed.get(key);
    if (owner) return { source, outPath, skip: `name conflict with ${owner}` };
    claimed.set(key, source.name);
    if (!force && existsSync(outPath)) {
      return { source, outPath, skip: `already exists: png/${basename(outPath)} — use --force to overwrite` };
    }
    return { source, outPath };
  });
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
