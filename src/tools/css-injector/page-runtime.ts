export interface RuntimePayload {
  local: { id: string; css: string }[];
  disabledLocal: string[];
  disabledRemote: string[];
}

/**
 * Runs INSIDE THE PAGE — this function is turned into a string (installRuntime.toString())
 * and registered with Page.addScriptToEvaluateOnNewDocument so it runs at document start on
 * every navigation, plus it's evaluated directly for a live update on the current document.
 * It must not reference anything outside itself: no imports, no closures over Node scope.
 */
export function installRuntime(payload: RuntimePayload): void {
  const w = window as any;
  if (w.__cssInjector) {
    w.__cssInjector.update(payload);
    return;
  }

  const ATTR = "data-css-injector";
  const OFF_ATTR = "data-css-injector-off";
  let current = payload;
  let scheduled = false;

  const toRegex = (pattern: string) =>
    new RegExp(pattern.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*"));

  const apply = () => {
    const head = document.head;
    if (!head) return; // too early; the observer calls apply() again once <head> exists

    // 1. One <style data-css-injector="id"> per local file.
    const byId = new Map<string, HTMLStyleElement>();
    head.querySelectorAll<HTMLStyleElement>(`style[${ATTR}]`).forEach((el) => {
      byId.set(el.getAttribute(ATTR) || "", el);
    });
    const wanted = new Set(current.local.map((s) => s.id));
    byId.forEach((el, id) => {
      if (!wanted.has(id)) {
        el.remove();
        byId.delete(id);
      }
    });
    for (const src of current.local) {
      let el = byId.get(src.id);
      if (!el) {
        el = document.createElement("style");
        el.setAttribute(ATTR, src.id);
        head.appendChild(el);
        byId.set(src.id, el);
      }
      if (el.textContent !== src.css) el.textContent = src.css;
      const media = current.disabledLocal.includes(src.id) ? "not all" : "";
      if (el.media !== media) el.media = media;
    }

    // 2. Keep our styles last in <head>, in file order, so they win the cascade.
    const ours = current.local.map((s) => byId.get(s.id)!).filter(Boolean);
    const tail = Array.from(head.children).slice(-ours.length);
    const inOrder = ours.length === tail.length && ours.every((el, i) => el === tail[i]);
    if (ours.length > 0 && !inOrder) ours.forEach((el) => head.appendChild(el));

    // 3. Site stylesheets: disable (not remove) the ones matching a disabled pattern.
    const regexes = current.disabledRemote.map(toRegex);
    document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]').forEach((link) => {
      const off = regexes.some((re) => re.test(link.href));
      if (off) {
        if (!link.disabled) link.disabled = true;
        if (!link.hasAttribute(OFF_ATTR)) link.setAttribute(OFF_ATTR, "1");
      } else if (link.hasAttribute(OFF_ATTR)) {
        link.disabled = false;
        link.removeAttribute(OFF_ATTR);
      }
    });
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      apply();
    });
  };

  // Re-apply when <head>, <link> or <style> nodes are added (site scripts add stylesheets late).
  new MutationObserver((records) => {
    const relevant = records.some(
      (r) =>
        r.target === document.head ||
        r.target === document.documentElement ||
        Array.from(r.addedNodes).some(
          (n) => n.nodeName === "LINK" || n.nodeName === "STYLE" || n.nodeName === "HEAD",
        ),
    );
    if (relevant) schedule();
  }).observe(document, { childList: true, subtree: true });

  const list = () => ({
    local: current.local.map((s) => ({
      id: s.id,
      bytes: s.css.length,
      enabled: !current.disabledLocal.includes(s.id),
    })),
    remote: Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]')).map((l) => ({
      href: l.href,
      enabled: !l.disabled,
    })),
  });

  w.__cssInjector = {
    update: (p: RuntimePayload) => {
      current = p;
      apply();
    },
    apply,
    list,
  };
  apply();
}

/** The JS source that installs/updates the runtime with this payload. */
export function runtimeSource(payload: RuntimePayload): string {
  return `(${installRuntime.toString()})(${JSON.stringify(payload)});`;
}
