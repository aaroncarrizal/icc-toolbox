import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";

export interface ImageFile {
  name: string;
  path: string;
  ext: string; // lower-cased, without the dot
}

/** Regular files directly in `folder` (no subfolders) with one of `extensions`, sorted by name. Other files are never opened. */
export async function listImageFiles(folder: string, extensions: readonly string[]): Promise<ImageFile[]> {
  const entries = await readdir(folder, { withFileTypes: true });
  const files: ImageFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = extname(entry.name).slice(1).toLowerCase();
    if (!extensions.includes(ext)) continue;
    files.push({ name: entry.name, path: join(folder, entry.name), ext });
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}
