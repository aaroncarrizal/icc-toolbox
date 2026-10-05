export const CDP_PORT = 9222;
export const CDP_HTTP = `http://127.0.0.1:${CDP_PORT}`;

export interface PageTarget {
  id: string;
  type: string;
  url: string;
  title: string;
  webSocketDebuggerUrl?: string;
}

const NON_SITE_PREFIXES = ["devtools://", "chrome://", "chrome-extension://", "chrome-untrusted://"];

export async function isChromeUp(): Promise<boolean> {
  try {
    const res = await fetch(`${CDP_HTTP}/json/version`);
    return res.ok;
  } catch {
    return false;
  }
}

/** Page targets only. DevTools windows and chrome:// pages are never returned. */
export async function listPages(): Promise<PageTarget[]> {
  const res = await fetch(`${CDP_HTTP}/json/list`);
  const all = (await res.json()) as PageTarget[];
  return all.filter(
    (t) => t.type === "page" && !NON_SITE_PREFIXES.some((p) => t.url.startsWith(p)),
  );
}

function bareHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** The tab showing the configured site; falls back to the first http(s) tab. */
export function pickSitePage(pages: PageTarget[], siteUrl: string): PageTarget | undefined {
  const host = bareHost(siteUrl);
  return (
    (host ? pages.find((p) => bareHost(p.url) === host) : undefined) ??
    pages.find((p) => /^https?:/.test(p.url))
  );
}

export function wsUrlFor(target: PageTarget): string {
  return target.webSocketDebuggerUrl ?? `ws://127.0.0.1:${CDP_PORT}/devtools/page/${target.id}`;
}

interface Pending {
  resolve: (value: any) => void;
  reject: (err: Error) => void;
  method: string;
}

/**
 * A CDP client bound to a single PAGE target's own websocket — never the
 * browser-level websocket. This is deliberate: Puppeteer's browser-level
 * auto-attach is what made an open DevTools window render a second, nested
 * DevTools inside itself (the DevTools frontend is itself a target, and by
 * the time a target filter can inspect its URL it may already be attached).
 * A page-level connection cannot see or touch the DevTools frontend at all,
 * so that failure mode is structurally impossible here.
 *
 * Never add Target.* calls or connect to the browser websocket from
 * /json/version in this file.
 */
export class Cdp {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private listeners = new Map<string, Set<(params: any) => void>>();

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String((ev as MessageEvent).data));
      if (typeof msg.id === "number") {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
        else p.resolve(msg.result);
      } else if (msg.method) {
        this.listeners.get(msg.method)?.forEach((h) => h(msg.params));
      }
    });
    ws.addEventListener("close", () => {
      for (const p of this.pending.values()) p.reject(new Error(`${p.method}: connection closed`));
      this.pending.clear();
      this.listeners.get("close")?.forEach((h) => h({}));
    });
  }

  static connect(wsUrl: string): Promise<Cdp> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      ws.addEventListener("open", () => resolve(new Cdp(ws)), { once: true });
      ws.addEventListener("error", () => reject(new Error(`Cannot open ${wsUrl}`)), { once: true });
    });
  }

  /** Used by the css/dbg CLIs: connect to the site tab or exit with a clear message. */
  static async connectToSite(siteUrl: string): Promise<Cdp> {
    if (!(await isChromeUp())) {
      console.error(`Chrome is not reachable at ${CDP_HTTP}. Is \`npm run dev\` running?`);
      process.exit(1);
    }
    const target = pickSitePage(await listPages(), siteUrl);
    if (!target) {
      console.error(`No tab found for ${siteUrl}. Is the site open in the injector's Chrome?`);
      process.exit(1);
    }
    return Cdp.connect(wsUrlFor(target));
  }

  send<T = any>(method: string, params: object = {}): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Subscribe to a CDP event (or "close"). Returns an unsubscribe function. */
  on(event: string, handler: (params: any) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
    return () => set.delete(handler);
  }

  /**
   * Run `fn` inside the page and return its (JSON-serialisable) result.
   * `fn` must be self-contained: it cannot use anything from this file's
   * scope, only its own parameters — it is serialized to a string and
   * evaluated inside the page, not called from Node.
   */
  async evaluate<T = any>(fn: (...args: any[]) => T | Promise<T>, ...args: unknown[]): Promise<T> {
    const expression = `(() => { const __name = (f) => f; return (${fn.toString()})(...${JSON.stringify(args)}); })()`;
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text);
    }
    return res.result.value as T;
  }

  close(): void {
    this.ws.close();
  }
}
