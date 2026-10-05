import type { Cdp } from "./cdp.ts";
import type { Source } from "./sources.ts";

export interface InvalidDeclaration {
  id: string;
  line: number;
  prop: string;
  value: string;
}

/**
 * Pulls out `prop: value` declarations with their 1-based line number, skipping
 * custom properties, vendor-prefixed properties, values using var()/env() (not
 * checkable in isolation), and @-rule lines (media/supports/font-face headers
 * aren't declarations). This is a hint, not a real parser — false negatives are
 * fine, false positives should stay rare.
 */
function extractDeclarations(css: string): { line: number; prop: string; value: string }[] {
  // Blank out comments but keep every character's line position intact.
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  const out: { line: number; prop: string; value: string }[] = [];
  const re = /([-a-zA-Z]+)\s*:\s*([^;{}]+?)\s*(?=[;}])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(noComments))) {
    const prop = m[1];
    let value = m[2];

    if (prop.startsWith("--") || prop.startsWith("-moz-") || prop.startsWith("-ms-") || prop.startsWith("-o-")) continue;
    if (/var\(|env\(/i.test(value)) continue;

    const lineStart = noComments.lastIndexOf("\n", m.index) + 1;
    const lineEndIdx = noComments.indexOf("\n", m.index);
    const lineText = noComments.slice(lineStart, lineEndIdx === -1 ? undefined : lineEndIdx);
    if (lineText.trim().startsWith("@")) continue;

    const line = (noComments.slice(0, m.index).match(/\n/g) ?? []).length + 1;
    value = value.replace(/!important/gi, "").trim();
    out.push({ line, prop, value });
  }
  return out;
}

/** Checks every declaration in `sources` with CSS.supports() inside the page, in one round trip. */
export async function findInvalidDeclarations(cdp: Cdp, sources: Source[]): Promise<InvalidDeclaration[]> {
  const all: InvalidDeclaration[] = [];
  for (const s of sources) {
    for (const d of extractDeclarations(s.content)) all.push({ id: s.id, ...d });
  }
  if (all.length === 0) return [];

  const pairs = all.map((d): [string, string] => [d.prop, d.value]);
  const supported = await cdp.evaluate((decls: [string, string][]) => {
    return decls.map(([p, v]) => {
      try {
        return CSS.supports(p, v);
      } catch {
        return true; // can't tell — don't false-positive
      }
    });
  }, pairs);

  return all.filter((_, i) => !supported[i]);
}
