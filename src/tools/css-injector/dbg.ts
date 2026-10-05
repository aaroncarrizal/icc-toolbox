#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname, sep } from "node:path";
import { Cdp } from "./cdp.ts";
import { loadConfig, type Config } from "./config.ts";
import { readState, writeState, bumpState } from "./state.ts";
import { CONSOLE_LOG_FILE } from "./console-log.ts";

const DEBUG_DIR = resolve("./debug");
const PREVIEW_ID = "debug-preview";
const OUTLINE_ID = "debug-outline-style";
const HTML_BACKUP_ATTR = "data-dbg-html";

const BOOTSTRAP_BREAKPOINTS: Record<string, number> = {
  xs: 375,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1400,
};

const DEFAULT_STYLE_PROPS = [
  "display", "position", "top", "right", "bottom", "left", "width", "height",
  "min-width", "max-width", "min-height", "max-height", "margin", "padding",
  "box-sizing", "flex", "flex-direction", "flex-wrap", "justify-content",
  "align-items", "gap", "grid-template-columns", "font-family", "font-size",
  "font-weight", "line-height", "color", "background-color", "background-image",
  "border", "border-radius", "z-index", "overflow", "opacity", "visibility", "transform",
];

interface Ctx {
  cdp: Cdp;
  config: Config;
}
type CommandFn = (ctx: Ctx, args: string[]) => Promise<unknown>;
interface CommandSpec {
  usage: string;
  run: CommandFn;
}

function extractFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  const value = args[idx + 1];
  args.splice(idx, 2);
  return value;
}

function extractBoolFlag(args: string[], name: string): boolean {
  const idx = args.indexOf(name);
  if (idx === -1) return false;
  args.splice(idx, 1);
  return true;
}

/** `@path/to/file` reads the file; anything else is returned as-is. */
async function readArg(value: string): Promise<string> {
  if (value.startsWith("@")) return readFile(resolve(value.slice(1)), "utf-8");
  return value;
}

async function ensureParentDir(filePath: string) {
  await mkdir(dirname(filePath), { recursive: true });
}

/** Reads all of stdin as text; rejects if stdin is an interactive TTY with nothing piped in. */
function readStdin(): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    if (process.stdin.isTTY) {
      reject(new Error("Usage: dbg batch @file, or pipe commands via stdin (one per line)"));
      return;
    }
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolvePromise(data));
    process.stdin.on("error", reject);
  });
}

/** CDP sometimes leaves "!important" embedded in a longhand's value (from shorthand expansion) even though `important` is already a separate flag; strip the redundant text so callers don't see it twice. */
function stripImportant(value: string): string {
  return value.replace(/\s*!important\s*$/i, "");
}

/** Splits one batch line into argv-style tokens, honoring "double" and 'single' quotes. */
function tokenize(line: string): string[] {
  const out: string[] = [];
  const re = /"((?:\\.|[^"\\])*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    out.push(m[1] !== undefined ? m[1].replace(/\\(.)/g, "$1") : m[2] ?? m[3]);
  }
  return out;
}

interface ShotOptions {
  clip?: { x: number; y: number; width: number; height: number };
  full?: boolean;
  png?: boolean;
  fullRes?: boolean;
  name: string;
  path?: string;
}

/** Screenshot a clip (or viewport/full page) — default JPEG q70, downscaled to <=1280px wide. */
async function shoot(cdp: Cdp, opts: ShotOptions): Promise<string> {
  const metrics = await cdp.send("Page.getLayoutMetrics");
  let clip = opts.clip;
  if (opts.full) {
    clip = {
      x: 0,
      y: 0,
      width: metrics.cssContentSize.width,
      height: Math.min(metrics.cssContentSize.height, 16000),
    };
  } else if (!clip) {
    const v = metrics.cssVisualViewport;
    clip = { x: v.pageX, y: v.pageY, width: v.clientWidth, height: v.clientHeight };
  }
  const scale = opts.fullRes ? 1 : Math.min(1, 1280 / clip.width);
  const format = opts.png ? "png" : "jpeg";
  const { data } = await cdp.send("Page.captureScreenshot", {
    format,
    ...(format === "jpeg" ? { quality: 70 } : {}),
    clip: { ...clip, scale },
    captureBeyondViewport: true,
  });
  const path = opts.path
    ? resolve(opts.path)
    : resolve(DEBUG_DIR, `${opts.name}-${Date.now()}.${format === "png" ? "png" : "jpg"}`);
  await ensureParentDir(path);
  await writeFile(path, Buffer.from(data, "base64"));
  return path;
}

/**
 * Emulate each width in turn, run fn(width), then clear the override and
 * restore the injector's persisted viewport (bumpState re-applies state.viewport
 * — CDP emulation belongs to the connection that set it, and this short-lived
 * dbg process is about to disconnect, so the long-lived injector session must
 * hold whatever viewport should persist).
 */
async function withWidths<T>(
  cdp: Cdp,
  config: Config,
  widths: number[],
  fn: (width: number) => Promise<T>,
): Promise<T[]> {
  const out: T[] = [];
  for (const width of widths) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    await new Promise((r) => setTimeout(r, 300));
    out.push(await fn(width));
  }
  await cdp.send("Emulation.clearDeviceMetricsOverride");
  await bumpState(config);
  return out;
}

// --- CSS "why does this lose" inspection (dbg why / dbg rules) -----------------

async function findNodeId(cdp: Cdp, selector: string): Promise<number> {
  const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  if (!nodeId) throw new Error(`No element for: ${selector}`);
  return nodeId;
}

/** DOM.describeNode's `attributes` is a flat [name, value, name, value, ...] array. */
function attrMap(flat: string[] = []): Record<string, string> {
  const map: Record<string, string> = {};
  for (let i = 0; i < flat.length; i += 2) map[flat[i]] = flat[i + 1];
  return map;
}

/** Listener must be attached before CSS.enable, which fires styleSheetAdded for every existing sheet. */
async function enableCssInspection(cdp: Cdp): Promise<Map<string, any>> {
  const headers = new Map<string, any>();
  cdp.on("CSS.styleSheetAdded", (p) => headers.set(p.header.styleSheetId, p.header));
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  return headers;
}

/** The kind of source a stylesheet is, without a line number yet (cached per styleSheetId). */
async function baseOriginLabel(cdp: Cdp, config: Config, header: any): Promise<string> {
  if (!header) return "unknown";
  if (header.ownerNode) {
    const { node } = await cdp.send("DOM.describeNode", { backendNodeId: header.ownerNode });
    const attrs = attrMap(node.attributes);
    if (attrs["data-css-injector"]) {
      const dir = config.dir.replace(/^\.\//, "").replace(/\/$/, "");
      return `${dir}/${attrs["data-css-injector"]}`;
    }
    if (attrs["id"] === "debug-preview") return "preview";
    return "inline <style>";
  }
  return header.sourceURL || "inline";
}

/** "styles/home.css:12", "preview:3", "inline <style>:1", "https://cdn/site.css:40", or "user-agent". */
async function originLabel(
  cdp: Cdp,
  config: Config,
  headers: Map<string, any>,
  cache: Map<string, string>,
  rule: any,
  range: { startLine?: number } | undefined,
): Promise<string> {
  if (rule.origin === "user-agent") return "user-agent";
  const styleSheetId = rule.styleSheetId;
  if (!styleSheetId) return "inline";
  let base = cache.get(styleSheetId);
  if (base === undefined) {
    base = await baseOriginLabel(cdp, config, headers.get(styleSheetId));
    cache.set(styleSheetId, base);
  }
  if (base === "unknown") return base;
  const header = headers.get(styleSheetId);
  const startLine = range?.startLine ?? rule.style?.range?.startLine ?? 0;
  // For an external file, header.startLine is 0 and startLine is already the
  // absolute line. For an inline <style>, CDP's range is relative to the
  // style tag's OWN content, while header.startLine is where that content
  // starts in the parent HTML document — so the absolute line is the SUM of
  // the two, not the difference (confirmed against a real page: a rule deep
  // in an inline <style> at document line ~1716 reports range.startLine ~21-26,
  // and header.startLine + range.startLine + 1 lands on the right line).
  const line = (header?.startLine ?? 0) + startLine + 1;
  return `${base}:${line}`;
}

const COMMANDS: Record<string, CommandSpec> = {
  screenshot: {
    usage: "screenshot [path] [--png] [--full-res] [--at w1,w2,...]",
    run: async (ctx, args) => {
      const png = extractBoolFlag(args, "--png");
      const fullRes = extractBoolFlag(args, "--full-res");
      const at = extractFlag(args, "--at");
      if (at) {
        const widths = at.split(",").map(Number).filter((n) => n > 0);
        return withWidths(ctx.cdp, ctx.config, widths, (width) =>
          shoot(ctx.cdp, { png, fullRes, name: `screenshot-${width}` }),
        );
      }
      return shoot(ctx.cdp, { png, fullRes, name: "screenshot", path: args[0] });
    },
  },

  fullpage: {
    usage: "fullpage [path] [--png] [--full-res]",
    run: async (ctx, args) => {
      const png = extractBoolFlag(args, "--png");
      const fullRes = extractBoolFlag(args, "--full-res");
      return shoot(ctx.cdp, { full: true, png, fullRes, name: "fullpage", path: args[0] });
    },
  },

  crop: {
    usage: "crop <selector> [path] [--png] [--full-res] [--at w1,w2,...]",
    run: async (ctx, args) => {
      const png = extractBoolFlag(args, "--png");
      const fullRes = extractBoolFlag(args, "--full-res");
      const at = extractFlag(args, "--at");
      const selector = args[0];
      const path = args[1];
      if (!selector) throw new Error("Usage: crop <selector> [path]");

      const getClip = () =>
        ctx.cdp.evaluate((sel: string) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height };
        }, selector);

      if (at) {
        const widths = at.split(",").map(Number).filter((n) => n > 0);
        return withWidths(ctx.cdp, ctx.config, widths, async (width) => {
          const clip = await getClip();
          if (!clip) throw new Error(`No element found for: ${selector}`);
          return shoot(ctx.cdp, { clip, png, fullRes, name: `crop-${width}` });
        });
      }
      const clip = await getClip();
      if (!clip) throw new Error(`No element found for: ${selector}`);
      return shoot(ctx.cdp, { clip, png, fullRes, name: "crop", path });
    },
  },

  outline: {
    usage: "outline [selector|reset]",
    run: async (ctx, args) => {
      const selector = args[0];
      if (selector === "reset") {
        await ctx.cdp.evaluate((id: string) => document.getElementById(id)?.remove(), OUTLINE_ID);
        return "Outline overlay removed";
      }
      const count = await ctx.cdp.evaluate(
        (id: string, sel: string | null) => {
          document.getElementById(id)?.remove();
          const style = document.createElement("style");
          style.id = id;
          style.textContent = sel
            ? `${sel}{outline:2px solid red !important;outline-offset:-2px !important;}`
            : `body *{outline:1px solid rgba(255,0,0,.35) !important;}`;
          document.head.appendChild(style);
          return document.querySelectorAll(sel ?? "body *").length;
        },
        OUTLINE_ID,
        selector ?? null,
      );
      const path = await shoot(ctx.cdp, { name: "outline" });
      return { count, path };
    },
  },

  styles: {
    usage: "styles <selector> [--all]",
    run: async (ctx, args) => {
      const all = extractBoolFlag(args, "--all");
      const selector = args[0];
      if (!selector) throw new Error("Usage: styles <selector> [--all]");
      return ctx.cdp.evaluate(
        (sel: string, props: string[], wantAll: boolean) => {
          const el = document.querySelector(sel);
          if (!el) return { error: `No element found for selector: ${sel}` };
          const computed = window.getComputedStyle(el);
          const styleObj: Record<string, string> = {};
          if (wantAll) {
            for (let i = 0; i < computed.length; i++) {
              const prop = computed[i];
              styleObj[prop] = computed.getPropertyValue(prop);
            }
          } else {
            for (const prop of props) {
              styleObj[prop] = computed.getPropertyValue(prop);
            }
          }
          const rect = el.getBoundingClientRect();
          return {
            selector: sel,
            tag: el.tagName.toLowerCase(),
            id: el.id || null,
            classList: Array.from(el.classList),
            boundingBox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            styles: styleObj,
          };
        },
        selector,
        DEFAULT_STYLE_PROPS,
        all,
      );
    },
  },

  select: {
    usage: "select <selector>",
    run: async (ctx, args) => {
      const selector = args[0];
      if (!selector) throw new Error("Usage: select <selector>");
      return ctx.cdp.evaluate((sel: string) => {
        const elements = document.querySelectorAll(sel);
        if (elements.length === 0) return { error: `No elements found for selector: ${sel}` };
        const info = Array.from(elements).map((el, i) => {
          const rect = el.getBoundingClientRect();
          const computed = window.getComputedStyle(el);
          return {
            index: i,
            tag: el.tagName.toLowerCase(),
            id: el.id || null,
            classList: Array.from(el.classList),
            visible: computed.display !== "none" && computed.visibility !== "hidden",
            opacity: computed.opacity,
            boundingBox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
          };
        });
        return { selector: sel, count: elements.length, elements: info };
      }, selector);
    },
  },

  html: {
    usage: "html [selector]",
    run: async (ctx, args) => {
      const selector = args[0] ?? null;
      return ctx.cdp.evaluate((sel: string | null) => {
        if (sel) {
          const el = document.querySelector(sel);
          return el ? el.outerHTML : `No element found for selector: ${sel}`;
        }
        return document.documentElement.outerHTML;
      }, selector);
    },
  },

  eval: {
    usage: "eval <expression>",
    run: async (ctx, args) => {
      const expression = args.join(" ");
      if (!expression) throw new Error("Usage: eval <expression>");
      const res = await ctx.cdp.send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (res.exceptionDetails) {
        return { error: res.exceptionDetails.exception?.description ?? res.exceptionDetails.text };
      }
      return res.result.value;
    },
  },

  find: {
    usage: "find <text> [limit]",
    run: async (ctx, args) => {
      if (args.length === 0) throw new Error("Usage: find <text> [limit]");
      const rest = [...args];
      let limit = 15;
      const last = rest[rest.length - 1];
      if (rest.length > 1 && /^\d+$/.test(last)) {
        limit = Number(last);
        rest.pop();
      }
      const text = rest.join(" ");
      return ctx.cdp.evaluate(
        (needle: string, lim: number) => {
          const lower = needle.toLowerCase();
          const out: unknown[] = [];
          for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
            const own = (el.textContent || "").toLowerCase();
            if (!own.includes(lower)) continue;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;

            let childHasText = false;
            for (const child of Array.from(el.children)) {
              if ((child.textContent || "").toLowerCase().includes(lower)) {
                childHasText = true;
                break;
              }
            }
            if (childHasText) continue;

            let selector: string;
            if (el.id && !/^\d/.test(el.id)) {
              selector = "#" + CSS.escape(el.id);
            } else {
              let path = "";
              let node: Element | null = el;
              for (let depth = 0; node && node !== document.body && depth < 5; depth++) {
                let part = node.tagName.toLowerCase();
                if (node.id && !/^\d/.test(node.id)) {
                  path = "#" + CSS.escape(node.id) + (path ? " > " + path : "");
                  break;
                }
                const classes = Array.from(node.classList).slice(0, 2);
                part += classes.map((c) => "." + CSS.escape(c)).join("");
                const parent = node.parentElement;
                const current = node;
                if (parent) {
                  const same = Array.from(parent.children).filter((c) => c.tagName === current.tagName);
                  if (same.length > 1) part += `:nth-of-type(${same.indexOf(current) + 1})`;
                }
                path = path ? part + " > " + path : part;
                node = node.parentElement;
              }
              selector = path;
            }

            out.push({
              selector,
              tag: el.tagName.toLowerCase(),
              id: el.id || null,
              classes: Array.from(el.classList),
              box: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
              text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 90),
            });
          }
          return out.slice(0, lim);
        },
        text,
        limit,
      );
    },
  },

  box: {
    usage: "box <selector>",
    run: async (ctx, args) => {
      const selector = args[0];
      if (!selector) throw new Error("Usage: box <selector>");
      return ctx.cdp.evaluate((sel: string) => {
        const el = document.querySelector<HTMLElement>(sel);
        if (!el) return { error: `No element found for: ${sel}` };

        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        const ancestors: unknown[] = [];
        let node = el.parentElement;
        for (let i = 0; i < 6 && node; i++) {
          const pcs = getComputedStyle(node);
          const r = node.getBoundingClientRect();
          ancestors.push({
            tag: node.tagName.toLowerCase(),
            id: node.id || null,
            classes: Array.from(node.classList).slice(0, 4),
            display: pcs.display,
            maxWidth: pcs.maxWidth,
            width: Math.round(r.width),
            margin: pcs.margin,
            padding: pcs.padding,
          });
          node = node.parentElement;
        }

        return {
          selector: sel,
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          classes: Array.from(el.classList),
          box: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          layout: {
            display: cs.display,
            position: cs.position,
            width: cs.width,
            height: cs.height,
            maxWidth: cs.maxWidth,
            margin: cs.margin,
            padding: cs.padding,
            textAlign: cs.textAlign,
            flex: cs.display.includes("flex")
              ? {
                  direction: cs.flexDirection,
                  justify: cs.justifyContent,
                  align: cs.alignItems,
                  gap: cs.gap,
                }
              : null,
          },
          ancestors,
        };
      }, selector);
    },
  },

  check: {
    usage: "check <selector> [widths...]",
    run: async (ctx, args) => {
      const selector = args[0];
      if (!selector) throw new Error("Usage: check <selector> [widths...]");
      const rawWidths = args.slice(1).map(Number).filter((n) => n > 0);
      const widths = rawWidths.length > 0 ? rawWidths : Object.values(BOOTSTRAP_BREAKPOINTS);
      const results = await withWidths(ctx.cdp, ctx.config, widths, async (width) => {
        const info = await ctx.cdp.evaluate((sel: string) => {
          const el = document.querySelector<HTMLElement>(sel);
          if (!el) return { present: false };
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return {
            present: true,
            display: cs.display,
            visibility: cs.visibility,
            opacity: cs.opacity,
            elementWidth: Math.round(r.width),
            elementHeight: Math.round(r.height),
            x: Math.round(r.x),
            visible:
              cs.display !== "none" &&
              cs.visibility !== "hidden" &&
              Number(cs.opacity) > 0 &&
              r.width > 0 &&
              r.height > 0,
            inViewport: r.top < window.innerHeight && r.bottom > 0 && r.left < window.innerWidth && r.right > 0,
          };
        }, selector);
        const name = Object.entries(BOOTSTRAP_BREAKPOINTS).find(([, v]) => v === width)?.[0];
        return { width, breakpoint: name ?? null, ...info };
      });
      return { selector, results };
    },
  },

  preview: {
    usage: "preview <css|@file|reset> [--save <path>]",
    run: async (ctx, args) => {
      const savePath = extractFlag(args, "--save");
      const arg = args.join(" ");
      if (!arg && !savePath) throw new Error("Usage: preview <css|@file|reset> [--save <path>]");

      if (arg === "reset" || arg === "--reset") {
        const removed = await ctx.cdp.evaluate((id: string) => {
          const el = document.getElementById(id);
          if (!el) return false;
          el.remove();
          return true;
        }, PREVIEW_ID);
        return removed ? "Preview cleared" : "Preview was not set";
      }

      let message = "";
      if (arg) {
        const css = await readArg(arg);
        await ctx.cdp.evaluate(
          (id: string, content: string) => {
            let style = document.getElementById(id) as HTMLStyleElement | null;
            if (!style) {
              style = document.createElement("style");
              style.id = id;
              document.head.appendChild(style);
            }
            style.textContent = content;
          },
          PREVIEW_ID,
          css,
        );
        message = `Preview applied (${css.length} bytes) as #${PREVIEW_ID}`;
      }

      if (!savePath) return message;

      // Turn the tested preview into a real file: append it to a file inside
      // config.dir, then clear the preview so the injector's own watcher picks
      // up the same CSS from disk — what was tested is exactly what gets saved.
      const current = await ctx.cdp.evaluate(
        (id: string) => document.getElementById(id)?.textContent ?? "",
        PREVIEW_ID,
      );
      if (!current.trim()) throw new Error("Nothing to save: the preview is empty");

      const dirAbs = resolve(ctx.config.dir) + sep;
      const targetAbs = resolve(savePath);
      if (!targetAbs.startsWith(dirAbs)) {
        throw new Error(`--save path must be inside ${ctx.config.dir} (got ${savePath})`);
      }

      await ensureParentDir(targetAbs);
      let existing = "";
      try {
        existing = await readFile(targetAbs, "utf-8");
      } catch {
        existing = "";
      }
      const next = existing + (existing && !existing.endsWith("\n") ? "\n" : "") + current.trim() + "\n";
      await writeFile(targetAbs, next, "utf-8");

      await ctx.cdp.evaluate((id: string) => document.getElementById(id)?.remove(), PREVIEW_ID);

      return { saved: savePath, bytes: current.trim().length + 1 };
    },
  },

  set: {
    usage: "set <selector> <prop> <value>",
    run: async (ctx, args) => {
      const [selector, prop, ...valueParts] = args;
      const value = valueParts.join(" ");
      if (!selector || !prop || !value) throw new Error("Usage: set <selector> <prop> <value>");
      await ctx.cdp.evaluate(
        (id: string, sel: string, p: string, v: string) => {
          let style = document.getElementById(id) as HTMLStyleElement | null;
          if (!style) {
            style = document.createElement("style");
            style.id = id;
            document.head.appendChild(style);
          }
          style.textContent += `\n${sel}{${p}:${v};}`;
        },
        PREVIEW_ID,
        selector,
        prop,
        value,
      );
      return `Added: ${selector} { ${prop}: ${value}; }`;
    },
  },

  bp: {
    usage: "bp <xs|sm|md|lg|xl|xxl|reset> [height]",
    run: async (ctx, args) => {
      const name = args[0];
      if (!name) throw new Error("Usage: bp <xs|sm|md|lg|xl|xxl|reset> [height]");
      const state = await readState(ctx.config);
      if (name === "reset") {
        state.viewport = null;
        await writeState(state);
        return "viewport -> reset (real window size)";
      }
      const key = name.toLowerCase().replace(/^bp-/, "");
      const width = BOOTSTRAP_BREAKPOINTS[key];
      if (!width) {
        throw new Error(`Unknown breakpoint "${name}". Options: ${Object.keys(BOOTSTRAP_BREAKPOINTS).join(", ")}`);
      }
      const height = Number(args[1]) || 900;
      const mobile = width < 768;
      state.viewport = { width, height, mobile };
      await writeState(state);
      return `viewport -> ${width}x${height}${mobile ? " (mobile)" : ""}`;
    },
  },

  resize: {
    usage: "resize <width> [height]",
    run: async (ctx, args) => {
      const width = Number(args[0]);
      if (!Number.isFinite(width) || width <= 0) throw new Error("Usage: resize <width> [height]");
      const height = Number(args[1]) || 900;
      const mobile = width < 768;
      const state = await readState(ctx.config);
      state.viewport = { width, height, mobile };
      await writeState(state);
      return `viewport -> ${width}x${height}${mobile ? " (mobile)" : ""}`;
    },
  },

  why: {
    usage: "why <selector> <property>",
    run: async (ctx, args) => {
      const selector = args[0];
      const property = args[1];
      if (!selector || !property) throw new Error("Usage: why <selector> <property>");

      const headers = await enableCssInspection(ctx.cdp);
      const nodeId = await findNodeId(ctx.cdp, selector);
      const matched = await ctx.cdp.send("CSS.getMatchedStylesForNode", { nodeId });
      const { computedStyle } = await ctx.cdp.send("CSS.getComputedStyleForNode", { nodeId });

      const labelCache = new Map<string, string>();
      const entries: any[] = [];

      for (const ruleMatch of matched.matchedCSSRules ?? []) {
        const rule = ruleMatch.rule;
        for (const p of rule.style.cssProperties as any[]) {
          if (p.name !== property) continue;
          const matchIdx = ruleMatch.matchingSelectors?.[0] ?? 0;
          const specObj = rule.selectorList?.selectors?.[matchIdx]?.specificity;
          entries.push({
            selector: rule.selectorList?.text ?? "(unknown selector)",
            value: stripImportant(p.value),
            important: !!p.important,
            origin: await originLabel(ctx.cdp, ctx.config, headers, labelCache, rule, p.range ?? rule.style.range),
            media: (rule.media ?? []).map((m: any) => m.text),
            specificity: specObj ? `${specObj.a},${specObj.b},${specObj.c}` : null,
            valid: p.parsedOk !== false,
            disabled: !!p.disabled,
          });
        }
      }

      if (matched.inlineStyle) {
        for (const p of matched.inlineStyle.cssProperties as any[]) {
          if (p.name !== property) continue;
          entries.push({
            selector: "(style attribute)",
            value: stripImportant(p.value),
            important: !!p.important,
            origin: "style attribute",
            media: [],
            specificity: null,
            valid: p.parsedOk !== false,
            disabled: !!p.disabled,
          });
        }
      }

      const computedEntry = (computedStyle as any[]).find((c) => c.name === property);
      const valid = entries.filter((e) => e.valid && !e.disabled);
      const invalid = entries.filter((e) => !e.valid || e.disabled);

      let winner: any = null;
      for (let i = valid.length - 1; i >= 0; i--) {
        if (valid[i].important) {
          winner = valid[i];
          break;
        }
      }
      if (!winner && valid.length > 0) winner = valid[valid.length - 1];
      const overridden = valid.filter((e) => e !== winner).reverse();

      let inheritedFrom: any = null;
      if (!winner) {
        for (let depth = 0; depth < (matched.inherited?.length ?? 0) && !inheritedFrom; depth++) {
          for (const rm of matched.inherited[depth].matchedCSSRules ?? []) {
            const found = (rm.rule.style.cssProperties as any[]).find(
              (p) => p.name === property && p.parsedOk !== false && !p.disabled,
            );
            if (found) {
              inheritedFrom = {
                depth: depth + 1,
                selector: rm.rule.selectorList?.text,
                value: stripImportant(found.value),
                origin: await originLabel(ctx.cdp, ctx.config, headers, labelCache, rm.rule, found.range ?? rm.rule.style.range),
              };
              break;
            }
          }
        }
      }

      return {
        selector,
        property,
        computed: computedEntry?.value ?? null,
        winner,
        overridden,
        invalid,
        inheritedFrom,
      };
    },
  },

  rules: {
    usage: "rules <selector> [--ua]",
    run: async (ctx, args) => {
      const ua = extractBoolFlag(args, "--ua");
      const selector = args[0];
      if (!selector) throw new Error("Usage: rules <selector> [--ua]");

      const headers = await enableCssInspection(ctx.cdp);
      const nodeId = await findNodeId(ctx.cdp, selector);
      const matched = await ctx.cdp.send("CSS.getMatchedStylesForNode", { nodeId });
      const labelCache = new Map<string, string>();

      const items: any[] = [];
      for (const ruleMatch of matched.matchedCSSRules ?? []) {
        const rule = ruleMatch.rule;
        if (!ua && rule.origin === "user-agent") continue;
        const declarations = (rule.style.cssProperties as any[])
          .filter((p) => p.text)
          .map((p) => p.text as string);
        items.push({
          selector: rule.selectorList?.text ?? "(unknown)",
          origin: await originLabel(ctx.cdp, ctx.config, headers, labelCache, rule, rule.style?.range),
          media: (rule.media ?? []).map((m: any) => m.text),
          declarations,
        });
      }
      items.reverse(); // matchedCSSRules is lowest-to-highest priority; we want strongest first

      if (matched.inlineStyle) {
        const declarations = (matched.inlineStyle.cssProperties as any[])
          .filter((p) => p.text)
          .map((p) => p.text as string);
        if (declarations.length > 0) {
          items.push({ selector: "(style attribute)", origin: "style attribute", media: [], declarations });
        }
      }

      return { selector, rules: items };
    },
  },

  replace: {
    usage: "replace <selector> <html|@file>",
    run: async (ctx, args) => {
      const selector = args[0];
      const htmlArg = args.slice(1).join(" ");
      if (!selector || !htmlArg) throw new Error("Usage: replace <selector> <html|@file>");
      const html = await readArg(htmlArg);
      return ctx.cdp.evaluate(
        (sel: string, htmlContent: string, attr: string) => {
          const w = window as any;
          w.__dbgHtmlBackup ||= {};
          const el = document.querySelector(sel);
          if (!el) return { error: `No element found for: ${sel}` };
          if (!(sel in w.__dbgHtmlBackup)) w.__dbgHtmlBackup[sel] = el.outerHTML;
          const template = document.createElement("template");
          template.innerHTML = htmlContent;
          const nodes = Array.from(template.content.childNodes);
          for (const node of nodes) {
            if (node.nodeType === 1) (node as Element).setAttribute(attr, sel);
          }
          el.replaceWith(...nodes);
          return { replaced: nodes.filter((n) => n.nodeType === 1).length };
        },
        selector,
        html,
        HTML_BACKUP_ATTR,
      );
    },
  },

  inner: {
    usage: "inner <selector> <html|@file>",
    run: async (ctx, args) => {
      const selector = args[0];
      const htmlArg = args.slice(1).join(" ");
      if (!selector || !htmlArg) throw new Error("Usage: inner <selector> <html|@file>");
      const html = await readArg(htmlArg);
      return ctx.cdp.evaluate(
        (sel: string, htmlContent: string, attr: string) => {
          const w = window as any;
          w.__dbgHtmlBackup ||= {};
          const el = document.querySelector(sel);
          if (!el) return { error: `No element found for: ${sel}` };
          if (!(sel in w.__dbgHtmlBackup)) w.__dbgHtmlBackup[sel] = el.outerHTML;
          el.innerHTML = htmlContent;
          el.setAttribute(attr, sel);
          return { replaced: 1 };
        },
        selector,
        html,
        HTML_BACKUP_ATTR,
      );
    },
  },

  restore: {
    usage: "restore [selector]",
    run: async (ctx, args) => {
      const selector = args[0] ?? null;
      return ctx.cdp.evaluate(
        (sel: string | null, attr: string) => {
          const w = window as any;
          w.__dbgHtmlBackup ||= {};
          const keys = sel ? [sel] : Object.keys(w.__dbgHtmlBackup);
          const restored: string[] = [];
          for (const key of keys) {
            if (!(key in w.__dbgHtmlBackup)) continue;
            const matches = Array.from(document.querySelectorAll(`[${attr}]`)).filter(
              (n) => n.getAttribute(attr) === key,
            );
            if (matches.length === 0) {
              delete w.__dbgHtmlBackup[key];
              continue;
            }
            const template = document.createElement("template");
            template.innerHTML = w.__dbgHtmlBackup[key];
            const nodes = Array.from(template.content.childNodes);
            matches[0].replaceWith(...nodes);
            for (let i = 1; i < matches.length; i++) matches[i].remove();
            delete w.__dbgHtmlBackup[key];
            restored.push(key);
          }
          return { restored };
        },
        selector,
        HTML_BACKUP_ATTR,
      );
    },
  },

  errors: {
    usage: "errors [--clear]",
    run: async (_ctx, args) => {
      const clear = extractBoolFlag(args, "--clear");
      if (clear) {
        await writeFile(CONSOLE_LOG_FILE, "", "utf-8").catch(() => {});
        return "Cleared debug/console.jsonl";
      }
      let text = "";
      try {
        text = await readFile(CONSOLE_LOG_FILE, "utf-8");
      } catch {
        return [];
      }
      return text
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l));
    },
  },

  batch: {
    usage: "batch [@file]   (or pipe commands via stdin, one per line)",
    run: async (ctx, args) => {
      const file = args[0];
      const text = file ? await readArg(file) : await readStdin();
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));

      // Prints one JSON line per command as it runs, instead of one big
      // array at the end, so a long batch is legible and one failure
      // doesn't hide the results that already succeeded.
      for (const line of lines) {
        const tokens = tokenize(line);
        const cmdName = tokens[0];
        if (cmdName === "batch") {
          console.log(JSON.stringify({ cmd: line, error: "batch cannot call itself" }));
          continue;
        }
        const spec = COMMANDS[cmdName];
        if (!spec) {
          console.log(JSON.stringify({ cmd: line, error: `Unknown command: ${cmdName}` }));
          continue;
        }
        try {
          const result = await spec.run(ctx, tokens.slice(1));
          console.log(JSON.stringify({ cmd: line, result }));
        } catch (err) {
          console.log(JSON.stringify({ cmd: line, error: (err as Error).message }));
        }
      }
      return undefined;
    },
  },
};

function printUsage() {
  console.log("Usage: npm run dbg -- <command> [args] [--pretty]\n");
  console.log("Commands:");
  for (const spec of Object.values(COMMANDS)) {
    console.log(`  ${spec.usage}`);
  }
  console.log("  help                                     Show this help");
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const pretty = rawArgs.includes("--pretty");
  const args = rawArgs.filter((a) => a !== "--pretty");
  const command = args[0];

  if (!command || command === "help") {
    printUsage();
    return;
  }

  const spec = COMMANDS[command];
  if (!spec) {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }

  const config = await loadConfig();
  const cdp = await Cdp.connectToSite(config.url);
  try {
    const result = await spec.run({ cdp, config }, args.slice(1));
    if (command === "batch") {
      // batch prints one JSON line per sub-command itself, as they complete.
    } else if (typeof result === "string") {
      console.log(result);
    } else {
      console.log(JSON.stringify(result, null, pretty ? 2 : undefined));
    }
  } catch (err) {
    console.error(`[dbg] ${(err as Error).message}`);
    process.exitCode = 1;
  } finally {
    cdp.close();
  }
}

main();
