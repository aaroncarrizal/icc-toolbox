import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { CDP_HTTP, CDP_PORT, isChromeUp, listPages, pickSitePage, type PageTarget } from "./cdp.ts";

export function findChrome(configured: string): string {
  if (configured) {
    if (!existsSync(configured)) throw new Error(`chromePath not found: ${configured}`);
    return configured;
  }
  const candidates: string[] = [];
  if (process.platform === "win32") {
    for (const base of [process.env["PROGRAMFILES"], process.env["PROGRAMFILES(X86)"], process.env["LOCALAPPDATA"]]) {
      if (base) candidates.push(join(base, "Google", "Chrome", "Application", "chrome.exe"));
    }
  } else if (process.platform === "darwin") {
    candidates.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
  } else {
    candidates.push("/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/opt/google/chrome/chrome");
  }
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error('Google Chrome not found. Set "chromePath" in .cssinjector.json.');
  return found;
}

/**
 * Starts Chrome with the debug port and a dedicated profile, or reuses a Chrome
 * already listening on the port. Returns the child process only if we spawned it
 * (the caller should only kill it in that case).
 */
export async function launchChrome(chromePath: string, headless: boolean): Promise<ChildProcess | null> {
  if (await isChromeUp()) {
    console.log(`[css-injector] Reusing Chrome already running on ${CDP_HTTP}`);
    return null;
  }
  const args = [
    `--remote-debugging-port=${CDP_PORT}`,
    // A dedicated profile is REQUIRED: Chrome 136+ ignores the debug port on the default profile.
    `--user-data-dir=${resolve(".chrome-profile")}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--start-maximized",
    ...(headless ? ["--headless=new", "--window-size=1280,900"] : []),
    "about:blank",
  ];
  const child = spawn(findChrome(chromePath), args, { stdio: "ignore" });
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await isChromeUp()) return child;
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill();
  throw new Error(`Chrome did not open ${CDP_HTTP} within 15s`);
}

/** The site tab if one is open, else any page tab, else a new blank tab. */
export async function getOrCreatePage(siteUrl: string): Promise<PageTarget> {
  const pages = await listPages();
  const existing = pickSitePage(pages, siteUrl) ?? pages[0];
  if (existing) return existing;
  const res = await fetch(`${CDP_HTTP}/json/new?about:blank`, { method: "PUT" });
  return (await res.json()) as PageTarget;
}
