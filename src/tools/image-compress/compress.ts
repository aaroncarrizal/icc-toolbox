import { copyFile, stat, writeFile } from "node:fs/promises";
import sharp, { type Sharp } from "sharp";
import type { ImageFile } from "../../shared/image-files.ts";

export const EXTENSIONS = ["jpg", "jpeg", "webp", "png"] as const;
export const DEFAULT_LIMIT = 1_000_000;
const MIN_LONGEST_SIDE = 1000;
const RESIZE_TRIES = 4;

export interface CompressOptions {
  limit: number;
  maxWidth?: number;
}

export interface CompressionResult {
  source: ImageFile;
  outPath: string;
  status: "compressed" | "copied" | "skipped" | "failed";
  size?: number;
  outSize?: number;
  steps?: string;
  reason?: string;
  warning?: string;
}

interface Step {
  label: string;
  apply: (image: Sharp) => Sharp;
}

/** "1MB", "800KB", "1.5MB" or plain bytes → bytes, decimal units (1 MB = 1,000,000). undefined if invalid. */
export function parseSize(text: string): number | undefined {
  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb)?$/i.exec(text.trim());
  if (!match) return undefined;
  const unit = (match[2] ?? "b").toLowerCase();
  const bytes = Math.floor(Number(match[1]) * (unit === "mb" ? 1_000_000 : unit === "kb" ? 1_000 : 1));
  return bytes > 0 ? bytes : undefined;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

/** Same-format encodings, best quality first; the last one is the floor used when resizing. */
function ladder(ext: string): Step[] {
  if (ext === "png") {
    return [
      { label: "lossless", apply: (s) => s.png({ compressionLevel: 9, adaptiveFiltering: true }) },
      ...[90, 75, 60].map((q) => ({ label: `palette q${q}`, apply: (s: Sharp) => s.png({ palette: true, quality: q, effort: 7 }) })),
    ];
  }
  if (ext === "webp") {
    return [85, 75, 65, 60].map((q) => ({ label: `quality ${q}`, apply: (s: Sharp) => s.webp({ quality: q }) }));
  }
  return [85, 75, 65, 60].map((q) => ({ label: `quality ${q}`, apply: (s: Sharp) => s.jpeg({ quality: q, mozjpeg: true }) }));
}

/**
 * Copies files already under the limit; otherwise re-encodes in the same format, walking the
 * quality ladder and only then shrinking dimensions (never below 1000 px on the longest side).
 * Output is written only once a buffer under the limit is in hand — nothing is written on failure.
 */
export async function compressOne(file: ImageFile, outPath: string, opts: CompressOptions): Promise<CompressionResult> {
  const size = (await stat(file.path)).size;
  const meta = await sharp(file.path).metadata();
  const warning = (meta.pages ?? 1) > 1 ? "animated WebP — first frame only" : undefined;
  // EXIF orientations 5–8 are rotated 90°, so the displayed width is the stored height.
  const swap = (meta.orientation ?? 1) >= 5;
  const width = (swap ? meta.height : meta.width) ?? 0;
  const height = (swap ? meta.width : meta.height) ?? 0;
  const needsResize = opts.maxWidth !== undefined && width > opts.maxWidth;

  if (size <= opts.limit && !needsResize) {
    await copyFile(file.path, outPath);
    return { source: file, outPath, status: "copied", size, outSize: size, warning };
  }

  const encode = (step: Step, w: number) => {
    let image = sharp(file.path).rotate();
    if (w < width) image = image.resize({ width: w });
    return step.apply(image).toBuffer();
  };
  const done = async (buffer: Buffer, steps: string): Promise<CompressionResult> => {
    await writeFile(outPath, buffer);
    return { source: file, outPath, status: "compressed", size, outSize: buffer.length, steps, warning };
  };

  let w = needsResize ? opts.maxWidth! : width;
  const resizedLabel = (step: Step) => (w < width ? `resized ${w}px, ${step.label}` : step.label);
  const steps = ladder(file.ext);
  let best = Buffer.alloc(0);
  for (const step of steps) {
    best = await encode(step, w);
    if (best.length <= opts.limit) return done(best, resizedLabel(step));
  }

  const floor = steps[steps.length - 1];
  const longest = Math.max(w, Math.round((height * w) / width));
  const minWidth = longest > MIN_LONGEST_SIDE ? Math.ceil((w * MIN_LONGEST_SIDE) / longest) : w;
  for (let i = 0; i < RESIZE_TRIES && w > minWidth; i++) {
    w = Math.max(minWidth, Math.floor(w * Math.sqrt(opts.limit / best.length) * 0.95));
    best = await encode(floor, w);
    if (best.length <= opts.limit) return done(best, resizedLabel(floor));
  }

  throw new Error(
    `can't reach ${formatBytes(opts.limit)} at ${floor.label} / ${MIN_LONGEST_SIDE}px (best: ${formatBytes(best.length)})`,
  );
}
