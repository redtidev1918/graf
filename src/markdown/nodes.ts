// Telegraph Node <-> Markdown conversion (port of the legacy Django implementation's behaviour).
import MarkdownIt from "markdown-it";
import { decodeEntities } from "./entities";

const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
  breaks: false,
});

export type Node = {
  tag: string;
  attrs?: Record<string, string>;
  children?: (Node | string)[];
};

const VOID_TAGS = new Set(["br", "img", "hr", "meta", "link", "input", "source", "area", "base", "col", "embed", "track", "wbr"]);
const RAW_TEXT_TAGS = new Set(["pre", "code", "kbd", "samp"]);

function collapseWs(s: string): string {
  return s.replace(/[\t\n\r ]+/g, " ");
}

// ---------- Markdown -> Nodes ----------

function parseHtmlToNodes(html: string): (Node | string)[] {
  const root: (Node | string)[] = [];
  const stack: Node[] = [];
  let rawDepth = 0;

  const pushText = (raw: string) => {
    if (raw.length === 0) return;
    const decoded = decodeEntities(raw);
    const text = rawDepth > 0 ? decoded : collapseWs(decoded);
    if (text.length === 0) return;
    const top = stack[stack.length - 1];
    if (top) {
      if (!top.children) top.children = [];
      top.children.push(text);
    } else {
      root.push(text);
    }
  };

  const TAG_RE = /<\s*(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^<>]*?)?)(\s*\/?)>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(html)) !== null) {
    pushText(html.slice(last, m.index));
    last = m.index + m[0].length;
    const closing = m[1] === "/";
    const tag = m[2]!.toLowerCase();
    const selfClose = m[4]!.includes("/");
    if (closing) {
      const top = stack[stack.length - 1];
      if (top && top.tag === tag) {
        stack.pop();
        if (RAW_TEXT_TAGS.has(tag) && rawDepth > 0) rawDepth--;
      }
      continue;
    }
    const attrs = parseAttrs(m[3] || "");
    const node: Node = { tag };
    if (Object.keys(attrs).length) node.attrs = attrs;
    const parent = stack.length ? stack[stack.length - 1] : undefined;
    if (parent) {
      if (!parent.children) parent.children = [];
      parent.children.push(node);
    } else {
      root.push(node);
    }
    if (RAW_TEXT_TAGS.has(tag) && !selfClose) rawDepth++;
    if (!VOID_TAGS.has(tag) && !selfClose) stack.push(node);
  }
  pushText(html.slice(last));
  return root.filter((n) => !(typeof n === "string" && n.trim() === ""));
}

function parseAttrs(chunk: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chunk)) !== null) {
    const name = m[1]!.toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    attrs[name] = decodeEntities(value);
  }
  return attrs;
}

export function markdownToNodes(mdText: string): (Node | string)[] {
  if (!mdText) return [];
  const html = md.render(mdText);
  return parseHtmlToNodes(html);
}

// ---------- Nodes -> Markdown ----------

function rawTextOf(children: (Node | string)[] | undefined): string {
  if (!children) return "";
  return children.map((c) => (typeof c === "string" ? c : rawTextOf(c.children))).join("");
}

function inlineMd(children: (Node | string)[] | undefined): string {
  if (!children) return "";
  return children.map((c) => (typeof c === "string" ? c : nodeInline(c))).join("");
}

function nodeInline(n: Node): string {
  const kids = n.children;
  switch (n.tag) {
    case "b":
    case "strong":
      return "**" + inlineMd(kids) + "**";
    case "i":
    case "em":
      return "*" + inlineMd(kids) + "*";
    case "s":
    case "del":
    case "strike":
      return "~~" + inlineMd(kids) + "~~";
    case "code":
      return "`" + rawTextOf(kids) + "`";
    case "a": {
      const href = (n.attrs && n.attrs.href) || "";
      if (!href) return inlineMd(kids);
      return "[" + inlineMd(kids) + "](" + href + ")";
    }
    case "br":
      return "  \n";
    case "img": {
      const src = (n.attrs && n.attrs.src) || "";
      const alt = (n.attrs && n.attrs.alt) || "image";
      return "![" + alt + "](" + src + ")";
    }
    default:
      return inlineMd(kids);
  }
}

function headingMd(n: Node): string {
  const level = Number(n.tag.slice(1)) || 1;
  return "#".repeat(level <= 3 ? level : 4);
}

export function nodesToMarkdown(nodes: (Node | string)[] | undefined): string {
  if (!nodes || nodes.length === 0) return "";
  const out: string[] = [];

  for (const item of nodes) {
    if (typeof item === "string") {
      out.push(item);
      continue;
    }
    const kids = item.children;
    switch (item.tag) {
      case "p":
        out.push(inlineMd(kids) + "\n\n");
        break;
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        out.push(headingMd(item) + " " + inlineMd(kids) + "\n\n");
        break;
      case "blockquote": {
        const lines = inlineMd(kids).split("\n").map((l) => l.trim()).filter(Boolean);
        out.push(lines.map((l) => "> " + l).join("\n") + "\n\n");
        break;
      }
      case "ul":
      case "ol":
        listToMarkdown(item, out);
        break;
      case "pre": {
        const code = rawTextOf(kids).replace(/\n+$/, "");
        out.push("```\n" + code + "\n```\n\n");
        break;
      }
      case "hr":
        out.push("---\n\n");
        break;
      case "img": {
        const src = (item.attrs && item.attrs.src) || "";
        const alt = (item.attrs && item.attrs.alt) || "image";
        out.push("![" + alt + "](" + src + ")\n\n");
        break;
      }
      default:
        out.push(nodeInline(item));
    }
  }
  return out.join("").replace(/\n{3,}/g, "\n\n");
}

function listToMarkdown(n: Node, out: string[]): void {
  const ordered = n.tag === "ol";
  let idx = 1;
  for (const child of n.children || []) {
    if (typeof child === "string") continue;
    if (child.tag !== "li") {
      out.push(nodeInline(child) + "\n");
      continue;
    }
    const bullet = ordered ? idx + ". " : "- ";
    const inner = listItemContent(child);
    const lines = inner.split("\n");
    out.push(lines.map((l) => (l.trim() ? bullet + l : "")).join("\n") + "\n");
    idx++;
  }
  out.push("\n");
}

function listItemContent(li: Node): string {
  const parts: string[] = [];
  for (const c of li.children || []) {
    if (typeof c === "string") {
      parts.push(c);
    } else if (c.tag === "ul" || c.tag === "ol") {
      const tmp: string[] = [];
      listToMarkdown(c, tmp);
      parts.push(tmp.join("").replace(/\n{2,}$/, "\n"));
    } else {
      parts.push(nodeInline(c));
    }
  }
  return parts.join("");
}
