import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface Config {
  url: string;
  dir: string; // local CSS directory
  include: string; // glob inside dir
  exclude: string; // glob inside dir ("" = none)
  headless: boolean;
  stripPatterns: string[]; // remote stylesheets disabled by default (href patterns, * = wildcard)
  username: string; // HTTP basic auth ("" = off)
  password: string;
  chromePath: string; // "" = auto-detect
  scripts: boolean; // JS injection (last resort), default false
  jsDir: string;
  jsInclude: string;
}

export const CONFIG_FILE = resolve(".cssinjector.json");

export const DEFAULT_CONFIG: Config = {
  url: "",
  dir: "./styles",
  include: "**/*.css",
  exclude: "",
  headless: false,
  stripPatterns: [],
  username: "",
  password: "",
  chromePath: "",
  scripts: false,
  jsDir: "./scripts",
  jsInclude: "**/*.js",
};

export async function loadConfig(overrides: Partial<Config> = {}): Promise<Config> {
  let file: Partial<Config> = {};
  try {
    file = JSON.parse(await readFile(CONFIG_FILE, "utf-8"));
  } catch {
    file = {};
  }
  const cleanOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([, v]) => v !== undefined && v !== ""),
  );
  return { ...DEFAULT_CONFIG, ...file, ...cleanOverrides };
}
