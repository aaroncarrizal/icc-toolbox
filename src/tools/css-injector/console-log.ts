import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Cdp } from "./cdp.ts";

export const CONSOLE_LOG_FILE = resolve("debug/console.jsonl");
const MAX_ENTRIES = 200;

export interface LogEntry {
  t: number;
  type: string;
  text?: string;
  url?: string;
  line?: number;
  status?: number;
}

/**
 * Captures page console errors/warnings, uncaught exceptions, and failed or
 * 4xx+ network requests into an in-memory ring buffer (last 200 entries),
 * flushed to debug/console.jsonl. Cleared on every main-frame navigation.
 * `npm run dbg -- errors` reads the file back. Requires Page.enable,
 * Runtime.enable and Network.enable to already be on for this session.
 */
export function captureConsoleAndNetwork(cdp: Cdp): void {
  let entries: LogEntry[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  const pendingUrls = new Map<string, string>();

  const flush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(async () => {
      flushTimer = null;
      try {
        await mkdir(dirname(CONSOLE_LOG_FILE), { recursive: true });
        const body = entries.map((e) => JSON.stringify(e)).join("\n");
        await writeFile(CONSOLE_LOG_FILE, body.length > 0 ? body + "\n" : "", "utf-8");
      } catch {
        // best effort; logging must never crash the injector
      }
    }, 200);
  };

  const add = (entry: Omit<LogEntry, "t">) => {
    entries.push({ t: Date.now(), ...entry });
    if (entries.length > MAX_ENTRIES) entries.shift();
    flush();
  };

  cdp.on("Runtime.exceptionThrown", (p) => {
    const d = p.exceptionDetails;
    add({
      type: "exception",
      text: d.exception?.description ?? d.text,
      url: d.url,
      line: typeof d.lineNumber === "number" ? d.lineNumber + 1 : undefined,
    });
  });

  cdp.on("Runtime.consoleAPICalled", (p) => {
    if (p.type !== "error" && p.type !== "warning") return;
    add({
      type: `console.${p.type}`,
      text: (p.args ?? []).map((a: any) => a.value ?? a.description ?? "").join(" "),
    });
  });

  cdp.on("Network.requestWillBeSent", (p) => pendingUrls.set(p.requestId, p.request.url));
  cdp.on("Network.loadingFinished", (p) => pendingUrls.delete(p.requestId));
  cdp.on("Network.loadingFailed", (p) => {
    add({ type: "network", text: p.errorText, url: pendingUrls.get(p.requestId) });
    pendingUrls.delete(p.requestId);
  });
  cdp.on("Network.responseReceived", (p) => {
    if (p.response.status >= 400) add({ type: "http", status: p.response.status, url: p.response.url });
  });

  cdp.on("Page.frameNavigated", (p) => {
    if (p.frame.parentId) return; // only a main-frame navigation clears the log
    entries = [];
    flush();
  });
}
