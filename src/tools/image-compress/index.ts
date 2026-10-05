import { existsSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { listImageFiles } from "../../shared/image-files.ts";
import {
  compressOne,
  DEFAULT_LIMIT,
  EXTENSIONS,
  formatBytes,
  parseSize,
  type CompressionResult,
} from "./compress.ts";

const TAG = "[img:compress]";
const USAGE = `Usage: npm run img:compress -- <folder> [--force] [--max <size>] [--max-width <px>]

Compresses every .jpg, .jpeg, .webp and .png file directly in <folder> to at most <size>,
keeping its format, written to <folder>/compressed/. Files already under the limit are copied.
Originals are never touched; subfolders are not scanned.

Options:
  -f, --force          Overwrite files that already exist in <folder>/compressed/
      --max <size>     Size limit per file: 1MB (default), 800KB, 1.5MB or bytes (1MB = 1,000,000)
      --max-width <px> Scale images wider than this down first
  -h, --help           Show this help`;

function usageError(message?: string): never {
  console.error(`${message ? `${TAG} ${message}\n\n` : ""}${USAGE}`);
  process.exit(1);
}

function parseCli(): { folder: string; force: boolean; limit: number; maxWidth?: number } {
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        force: { type: "boolean", short: "f" },
        max: { type: "string" },
        "max-width": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (err) {
    usageError((err as Error).message);
  }
  if (parsed.values.help) {
    console.log(USAGE);
    process.exit(0);
  }
  if (parsed.positionals.length !== 1) usageError();

  const limit = parsed.values.max === undefined ? DEFAULT_LIMIT : parseSize(parsed.values.max);
  if (limit === undefined) usageError(`Invalid --max: ${parsed.values.max}`);

  let maxWidth: number | undefined;
  if (parsed.values["max-width"] !== undefined) {
    maxWidth = Number(parsed.values["max-width"]);
    if (!Number.isInteger(maxWidth) || maxWidth <= 0) usageError(`Invalid --max-width: ${parsed.values["max-width"]}`);
  }

  return { folder: resolve(parsed.positionals[0]), force: parsed.values.force ?? false, limit, maxWidth };
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

function formatResult(r: CompressionResult, width: number): string {
  const status = r.status.padEnd(11);
  const name = r.source.name.padEnd(width);
  const warning = r.warning ? `  (warning: ${r.warning})` : "";
  if (r.status === "compressed") {
    return `${TAG} ${status} ${name} ${formatBytes(r.size!).padStart(8)} -> ${formatBytes(r.outSize!)}  (${r.steps})${warning}`;
  }
  if (r.status === "copied") return `${TAG} ${status} ${name} ${formatBytes(r.size!).padStart(8)}${warning}`;
  return `${TAG} ${status} ${name} (${r.reason})`;
}

const { folder, force, limit, maxWidth } = parseCli();

if (!(await isDirectory(folder))) {
  console.error(`${TAG} Not a folder: ${folder}`);
  process.exit(1);
}

const files = await listImageFiles(folder, EXTENSIONS);
if (files.length === 0) {
  console.log(`${TAG} No .jpg, .jpeg, .webp or .png files in ${folder}`);
  process.exit(0);
}

const outDir = join(folder, "compressed");
const plan = files.map((file) => {
  const outPath = join(outDir, file.name);
  return { file, outPath, exists: !force && existsSync(outPath) };
});
if (plan.some((p) => !p.exists)) await mkdir(outDir, { recursive: true });

const width = Math.max(...files.map((f) => f.name.length));
const results: CompressionResult[] = [];
for (const { file, outPath, exists } of plan) {
  let result: CompressionResult;
  if (exists) {
    result = { source: file, outPath, status: "skipped", reason: "already exists — use --force to overwrite" };
  } else {
    try {
      result = await compressOne(file, outPath, { limit, maxWidth });
    } catch (err) {
      result = { source: file, outPath, status: "failed", reason: (err as Error).message };
    }
  }
  results.push(result);
  console.log(formatResult(result, width));
}

const count = (status: CompressionResult["status"]) => results.filter((r) => r.status === status).length;
const written = results.filter((r) => r.status === "compressed" || r.status === "copied");
const before = written.reduce((sum, r) => sum + r.size!, 0);
const after = written.reduce((sum, r) => sum + r.outSize!, 0);
const pct = before > 0 ? Math.round(((before - after) / before) * 100) : 0;
console.log(
  `${TAG} ${count("compressed")} compressed, ${count("copied")} copied, ${count("skipped")} skipped, ${count("failed")} failed` +
    ` — ${formatBytes(before)} -> ${formatBytes(after)} (saved ${formatBytes(before - after)}, ${pct}%) — output: ${outDir}`,
);
if (count("failed") > 0) process.exitCode = 1;
