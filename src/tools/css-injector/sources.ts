import fg from "fast-glob";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface Source {
  id: string; // path relative to dir, forward slashes, e.g. "home.css" or "pages/srp.css"
  content: string;
}

/** Files sorted alphabetically: name them 10-base.css, 20-nav.css... to control cascade order. */
export async function readSources(dir: string, include: string, exclude: string): Promise<Source[]> {
  const cwd = resolve(dir);
  const ids = (await fg(include, { cwd, ignore: exclude ? [exclude] : [] })).sort();
  return Promise.all(
    ids.map(async (id) => ({ id, content: await readFile(resolve(cwd, id), "utf-8") })),
  );
}
