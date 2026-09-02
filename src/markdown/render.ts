// Render Markdown to safe HTML (no raw-HTML pass-through) plus:
//  - target/rel attributes on external links (per-page link_target setting)
//  - whole-paragraph YouTube links converted to <iframe>
import MarkdownIt from "markdown-it";
import Footnote from "markdown-it-footnote";

const md: MarkdownIt = new MarkdownIt({
  html: false, // raw HTML is escaped, never passed through (XSS safe by default)
  linkify: false,
  typographer: false,
  breaks: false,
}).use(Footnote as unknown as (m: MarkdownIt) => void);

const YOUTUBE_HOST_RE = /(^|\.)youtu\.be$|(^|\.)youtube\.com$/;
const YT_ID_RE = /^[A-Za-z0-9_-]{6,20}$/;

export function isHttpUrl(href: string): boolean {
  try {
    const u = new URL(href);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Extract a YouTube video id from a URL, or null. */
export function youtubeIdOf(href: string): string | null {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (!YOUTUBE_HOST_RE.test(host)) return null;
  const seg = u.pathname.split("/").filter((s) => s.length > 0);
  if (/youtu\.be$/.test(host) || host === "youtu.be") {
    if (seg.length && YT_ID_RE.test(seg[0]!)) return seg[0]!;
    return null;
  }
  if (seg[0] === "embed" && seg[1] && YT_ID_RE.test(seg[1]!)) return seg[1]!;
  const v = u.searchParams.get("v");
  if (v && YT_ID_RE.test(v)) return v;
  return null;
}

function ytIframe(id: string): string {
  return '<iframe class="graf-embed" width="560" height="315" src="https://www.youtube.com/embed/' +
    id + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>';
}

/** Rewrite <a ...> open tags to carry target/rel for http(s) links that lack them. */
function applyLinkAttrs(html: string, linkTarget: string): string {
  let out = "";
  let last = 0;
  const re = /<a\b[^>]*?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    out += html.slice(last, m.index);
    if (/target=/.test(tag) && /rel=/.test(tag)) {
      out += tag;
    } else {
      const href = /\bhref="([^"]*)"/.exec(tag)?.[1] || "";
      const attrs = isHttpUrl(href) ? ' target="' + linkTarget + '" rel="noopener noreferrer"' : "";
      out += tag.replace(/>$/, attrs + ">");
    }
    last = m.index + tag.length;
  }
  return out + html.slice(last);
}

/** Convert whole-paragraph YouTube links/URLs into iframes. */
function embedYouTubeParagraphs(html: string): string {
  const paraRe = /<p>([\s\S]*?)<\/p>/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = paraRe.exec(html)) !== null) {
    out += html.slice(last, m.index);
    const inner = m[1]!;
    // <p><a href="yt">text</a></p>
    const anchor = /^\s*<a\s[^>]*?href="([^"]*)"[^>]*>[\s\S]*?<\/a>\s*$/.exec(inner);
    if (anchor) {
      const id = youtubeIdOf(anchor[1]!);
      out += id ? ytIframe(id) : "<p>" + inner + "</p>";
    } else {
      // plain text URL on its own line
      const bare = /^\s*(https?:\/\/[^\s<]*)\s*$/.exec(inner);
      if (bare) {
        const id = youtubeIdOf(bare[1]!);
        out += id ? ytIframe(id) : "<p>" + inner + "</p>";
      } else {
        out += "<p>" + inner + "</p>";
      }
    }
    last = m.index + m[0].length;
  }
  return out + html.slice(last);
}

export interface RenderOptions {
  linkTarget?: "_self" | "_blank";
}

/** Full render pipeline for a stored Markdown page body. */
export function renderMarkdown(content: string, opts: RenderOptions = {}): string {
  const target = opts.linkTarget === "_blank" ? "_blank" : "_self";
  let html = md.render(content);
  // strikethrough parity with the Django version (<del>)
  html = html.replace(/<s>([\s\S]*?)<\/s>/g, "<del>$1</del>");
  html = embedYouTubeParagraphs(html);
  html = applyLinkAttrs(html, target);
  return html;
}
