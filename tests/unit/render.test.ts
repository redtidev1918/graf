import { describe, expect, it } from "vitest";
import { renderMarkdown, youtubeIdOf } from "../../src/markdown/render";

const NL = "\n";

describe("renderMarkdown", () => {
  it("renders strikethrough as del", () => {
    expect(renderMarkdown("~~Deleted text~~")).toContain("<del>Deleted text</del>");
  });

  it("renders headings, bold and lists", () => {
    const html = renderMarkdown(["# Heading", "", "**Bold** and *em*", "", "- one", "- two"].join(NL));
    expect(html).toContain("<h1>Heading</h1>");
    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain("<em>em</em>");
    expect(html).toContain("<li>one</li>");
  });

  it("renders footnotes", () => {
    const html = renderMarkdown(["Here is a footnote reference[^1]", "", "[^1]: Here is the footnote."].join(NL));
    expect(html).toContain('id="fn1"');
    expect(html).toContain("Here is the footnote");
  });

  it("converts a standalone youtube link paragraph to an iframe", () => {
    const html = renderMarkdown("[Video](https://youtu.be/dQw4w9WgXcQ)");
    expect(html).toContain("<iframe");
    expect(html).toContain("youtube.com/embed/dQw4w9WgXcQ");
  });

  it("converts a bare youtube url to an iframe", () => {
    const html = renderMarkdown("https://youtu.be/dQw4w9WgXcQ");
    expect(html).toContain("youtube.com/embed/dQw4w9WgXcQ");
  });

  it("leaves normal links alone except target/rel", () => {
    const html = renderMarkdown("[Regular](https://example.com/page)");
    expect(html).not.toContain("<iframe");
    expect(html).toContain('href="https://example.com/page"');
    expect(html).toContain('target="_self"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("never passes raw script through", () => {
    const html = renderMarkdown("hello <script>alert(1)</script> world");
    expect(html.toLowerCase()).not.toContain("<script");
  });

  it("does not linkify javascript: URLs", () => {
    const html = renderMarkdown("[x](javascript:alert(1))");
    expect(html).not.toContain('href="javascript:');
  });
});

describe("youtubeIdOf", () => {
  it("extracts ids from various youtube urls", () => {
    expect(youtubeIdOf("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdOf("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3s")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdOf("https://youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdOf("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youtubeIdOf("https://youtu.be/way-too-long-and-invalid-video-id-here")).toBeNull();
  });
});
