import { mkdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { convertOne, listSources, pngPathFor, type ConversionResult } from "./convert.ts";

const TAG = "[img:png]";
const USAGE = `Usage: npm run img:png -- <folder> [--force]

Converts every .jpg, .jpeg and .webp file directly in <folder> to PNG, written to <folder>/png/.
Originals are never touched; subfolders are not scanned.

Options:
  -f, --force   Overwrite PNGs that already exist in <folder>/png/
  -h, --help    Show this help`;

function parseCli(): { folder: string } {
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
  return { folder: resolve(parsed.positionals[0]) };
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

function formatResult(r: ConversionResult, folder: string, width: number): string {
  const name = r.source.name.padEnd(width);
  const status = r.status.padEnd(10);
  if (r.status === "converted") {
    const out = relative(folder, r.outPath).replaceAll("\\", "/");
    return `${TAG} ${status} ${name} -> ${out}${r.warning ? `  (warning: ${r.warning})` : ""}`;
  }
  return `${TAG} ${status} ${name} (${r.reason})`;
}

const { folder } = parseCli();

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
await mkdir(outDir, { recursive: true });

const width = Math.max(...sources.map((s) => s.name.length));
const results: ConversionResult[] = [];
for (const source of sources) {
  const result = await convertOne(source, pngPathFor(source, outDir));
  results.push(result);
  console.log(formatResult(result, folder, width));
}

const count = (status: ConversionResult["status"]) => results.filter((r) => r.status === status).length;
console.log(
  `${TAG} ${count("converted")} converted, ${count("skipped")} skipped, ${count("failed")} failed — output: ${outDir}`,
);
