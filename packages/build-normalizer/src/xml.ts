// Minimal, dependency-free, defensive XML reader — just enough to walk a
// Path-of-Building document tree. It is NOT a compliant XML parser: it tolerates
// junk, ignores namespaces/DTD/processing-instructions, and never throws on
// malformed markup (it returns whatever structure it could recover). This keeps
// the PoB importer resilient — the importer decides what it could not extract and
// DECLARES the gaps rather than crashing (RFC-0001 I3: no silent structural drift).

export interface XmlElement {
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: readonly XmlElement[];
  /** Concatenated direct text content (trimmed), if any. */
  readonly text: string;
}

const VOID_SELF_CLOSING = /\/\s*>$/;

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

function parseAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w:.-]+)\s*=\s*"([^"]*)"|([\w:.-]+)\s*=\s*'([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const key = m[1] ?? m[3];
    const val = m[2] ?? m[4] ?? "";
    if (key !== undefined) attrs[key] = decodeEntities(val);
  }
  return attrs;
}

interface MutableElement {
  name: string;
  attributes: Record<string, string>;
  children: MutableElement[];
  textParts: string[];
}

function freeze(el: MutableElement): XmlElement {
  return {
    name: el.name,
    attributes: el.attributes,
    children: el.children.map(freeze),
    text: el.textParts.join("").trim(),
  };
}

/**
 * Parse a string into a single root XmlElement, or null if no element was found.
 * Malformed input yields a best-effort tree; it never throws.
 */
export function parseXml(input: string): XmlElement | null {
  // Strip declarations, comments, CDATA wrappers, DOCTYPE, processing instructions.
  const cleaned = input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_m, inner: string) => inner)
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "");

  const root: MutableElement = { name: "#root", attributes: {}, children: [], textParts: [] };
  const stack: MutableElement[] = [root];
  const tagRe = /<\s*(\/?)\s*([\w:.-]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)\s*>/g;

  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(cleaned)) !== null) {
    const [full, closing, name, attrRaw, selfCloseSlash] = m;
    // Text between the previous tag and this one belongs to the current parent.
    const between = cleaned.slice(lastIndex, m.index);
    if (between.trim().length > 0) {
      const top = stack[stack.length - 1];
      if (top) top.textParts.push(decodeEntities(between));
    }
    lastIndex = tagRe.lastIndex;

    if (name === undefined) continue;

    if (closing === "/") {
      // Close the nearest matching open tag; ignore stray closers.
      for (let i = stack.length - 1; i >= 1; i--) {
        if (stack[i]?.name === name) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const el: MutableElement = {
      name,
      attributes: parseAttributes(attrRaw ?? ""),
      children: [],
      textParts: [],
    };
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(el);

    const selfClosing = selfCloseSlash === "/" || VOID_SELF_CLOSING.test(full);
    if (!selfClosing) stack.push(el);
  }

  // Trailing text after the last tag.
  const tail = cleaned.slice(lastIndex);
  if (tail.trim().length > 0) root.textParts.push(decodeEntities(tail));

  const first = root.children[0];
  return first ? freeze(first) : null;
}

/** Depth-first collect all descendants (and self) whose tag name matches. */
export function findAll(el: XmlElement, name: string): XmlElement[] {
  const out: XmlElement[] = [];
  const walk = (node: XmlElement): void => {
    if (node.name === name) out.push(node);
    for (const c of node.children) walk(c);
  };
  walk(el);
  return out;
}

/** First descendant (or self) with the given tag name, or null. */
export function findFirst(el: XmlElement, name: string): XmlElement | null {
  return findAll(el, name)[0] ?? null;
}
