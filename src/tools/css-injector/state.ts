import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Config } from "./config.ts";

export const STATE_FILE = resolve(".cssinjector.state.json");

export interface Viewport {
  width: number;
  height: number;
  mobile: boolean;
}

export interface State {
  disabledLocal: string[]; // local file ids, e.g. "home.css"
  disabledRemote: string[]; // href patterns, "*" = wildcard
  viewport: Viewport | null; // null = the real window size
  rev: number; // bumped on every write so the injector always sees a change
}

export function defaultState(config: Config): State {
  return { disabledLocal: [], disabledRemote: [...config.stripPatterns], viewport: null, rev: 0 };
}

export async function readState(config: Config): Promise<State> {
  try {
    const raw = JSON.parse(await readFile(STATE_FILE, "utf-8"));
    return { ...defaultState(config), ...raw };
  } catch {
    return defaultState(config);
  }
}

export async function writeState(state: State): Promise<void> {
  state.rev = (state.rev ?? 0) + 1;
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

/** Make sure the file exists so the injector's watcher can watch it. */
export async function ensureStateFile(config: Config): Promise<void> {
  if (!existsSync(STATE_FILE)) await writeState(defaultState(config));
}

/** Rewrite the state unchanged so the injector re-applies it (e.g. the viewport after dbg emulation). */
export async function bumpState(config: Config): Promise<void> {
  await writeState(await readState(config));
}
