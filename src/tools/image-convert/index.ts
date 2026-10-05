/**
 * img:png — converts every .jpg/.jpeg/.webp directly in a folder to PNG, written to <folder>/png/.
 *
 *   npm run img:png -- <folder> [--force]
 *
 * This file is the CLI shell: argument parsing, folder validation, printing and the exit code.
 * The actual work (finding images, deciding what to skip, encoding) lives in convert.ts, which
 * never prints. See README.md in this folder for the full behavior.
 *
 * Exit codes: 0 = everything converted or skipped (including "nothing to do");
 *             1 = bad arguments, folder missing, or at least one file failed.
 */

import { mkdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { convertOne, listSources, planConversions, type ConversionResult } from "./convert.ts";

const TAG = "[img:png]";
const USAGE = `Usage: npm run img:png -- <folder> [--force]

Converts every .jpg, .jpeg and .webp file directly in <folder> to PNG, written to <folder>/png/.
Originals are never touched; subfolders are not scanned.

Options:
  -f, --force   Overwrite PNGs that already exist in <folder>/png/
  -h, --help    Show this help`;

/** Parses argv. Exits on --help (0) and on bad/missing arguments (1); otherwise returns an absolute folder. */
function parseCli(): { folder: string; force: boolean } {
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        force: { type: "boolean", short: "f" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (err) {
    console.error(`${TAG} ${(err as Error).message}\n\n${USAGE}`);
    process.exit(1);
  }
  if (parsed.values.help) {
    console.log(USAGE);
    process.exit(0);
  }
  if (parsed.positionals.length !== 1) {
    console.error(USAGE);
    process.exit(1);
  }
  return { folder: resolve(parsed.positionals[0]), force: parsed.values.force ?? false };
}

/** True if `path` exists and is a directory — false for missing paths instead of throwing. */
async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** One aligned output line per file; `width` is the longest source name so the columns line up. */
function formatResult(r: ConversionResult, folder: string, width: number): string {
  const name = r.source.name.padEnd(width);
  const status = r.status.padEnd(10);
  if (r.status === "converted") {
    const out = relative(folder, r.outPath).replaceAll("\\", "/");
    return `${TAG} ${status} ${name} -> ${out}${r.warning ? `  (warning: ${r.warning})` : ""}`;
  }
  return `${TAG} ${status} ${name} (${r.reason})`;
}

const { folder, force } = parseCli();

if (!(await isDirectory(folder))) {
  console.error(`${TAG} Not a folder: ${folder}`);
  process.exit(1);
}

const sources = await listSources(folder);
if (sources.length === 0) {
  console.log(`${TAG} No .jpg, .jpeg or .webp files in ${folder}`);
  process.exit(0);
}

const outDir = join(folder, "png");
const plan = planConversions(sources, outDir, force);
// Only create png/ when something will actually be written, so an all-skipped run leaves no trace.
if (plan.some((p) => !p.skip)) await mkdir(outDir, { recursive: true });

const width = Math.max(...sources.map((s) => s.name.length));
const results: ConversionResult[] = [];
for (const { source, outPath, skip } of plan) {
  let result: ConversionResult;
  if (skip) {
    result = { source, outPath, status: "skipped", reason: skip };
  } else {
    // One bad file must not stop the batch: record it as failed and keep going.
    try {
      result = await convertOne(source, outPath);
    } catch (err) {
      result = { source, outPath, status: "failed", reason: (err as Error).message };
    }
  }
  results.push(result);
  console.log(formatResult(result, folder, width));
}

const count = (status: ConversionResult["status"]) => results.filter((r) => r.status === status).length;
console.log(
  `${TAG} ${count("converted")} converted, ${count("skipped")} skipped, ${count("failed")} failed — output: ${outDir}`,
);
if (count("failed") > 0) process.exitCode = 1;
