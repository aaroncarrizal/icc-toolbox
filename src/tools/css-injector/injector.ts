import type { Cdp } from "./cdp.ts";
import type { State, Viewport } from "./state.ts";
import type { Source } from "./sources.ts";
import { runtimeSource } from "./page-runtime.ts";

let cssRegistration: string | null = null;
let jsRegistration: string | null = null;

/** Register the CSS runtime for future documents AND update the current one live. */
export async function syncCss(cdp: Cdp, sources: Source[], state: State): Promise<void> {
  const source = runtimeSource({
    local: sources.map((s) => ({ id: s.id, css: s.content })),
    disabledLocal: state.disabledLocal,
    disabledRemote: state.disabledRemote,
  });
  if (cssRegistration) {
    await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: cssRegistration });
  }
  cssRegistration = (await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source })).identifier;
  await cdp.send("Runtime.evaluate", { expression: source });
}

/** JS injection (last resort). Same pattern: next documents + current document. */
export async function syncJs(cdp: Cdp, sources: Source[]): Promise<void> {
  if (jsRegistration) {
    await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: jsRegistration });
    jsRegistration = null;
  }
  if (sources.length === 0) return;
  const source = sources.map((s) => `// ${s.id}\n${s.content}`).join("\n;\n");
  jsRegistration = (await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source })).identifier;
  await cdp.send("Runtime.evaluate", { expression: source });
}

export async function applyViewport(cdp: Cdp, vp: Viewport | null): Promise<void> {
  if (!vp) {
    await cdp.send("Emulation.clearDeviceMetricsOverride");
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
    return;
  }
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: 1,
    mobile: vp.mobile,
  });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: vp.mobile });
}

/**
 * HTTP basic auth, answered only for the site's own origin (credentials never go to CDNs).
 * Every request matching the pattern is paused, so it MUST be continued.
 */
export async function enableBasicAuth(
  cdp: Cdp,
  siteUrl: string,
  username: string,
  password: string,
): Promise<void> {
  const host = new URL(siteUrl).host;
  cdp.on("Fetch.requestPaused", (p) => {
    void cdp.send("Fetch.continueRequest", { requestId: p.requestId }).catch(() => {});
  });
  cdp.on("Fetch.authRequired", (p) => {
    void cdp
      .send("Fetch.continueWithAuth", {
        requestId: p.requestId,
        authChallengeResponse: { response: "ProvideCredentials", username, password },
      })
      .catch(() => {});
  });
  await cdp.send("Fetch.enable", { handleAuthRequests: true, patterns: [{ urlPattern: `*://${host}/*` }] });
}

export function describeSync(sources: Source[], state: State): string {
  const off = sources.filter((s) => state.disabledLocal.includes(s.id)).length;
  return `${sources.length} local file(s) (${off} off), remote patterns off: ${
    state.disabledRemote.length ? state.disabledRemote.join(", ") : "none"
  }`;
}
