import { describe, expect, it } from "vitest";
import { markdownToNodes, nodesToMarkdown } from "../../src/markdown/nodes";

const NL = "\n";

describe("markdownToNodes", () => {
  it("converts a simple paragraph", () => {
    expect(markdownToNodes("Hello world")).toEqual([{ tag: "p", children: ["Hello world"] }]);
  });

  it("produces headings and paragraphs", () => {
    const nodes = markdownToNodes(["# Title", "", "Paragraph with **bold**."].join(NL));
    const tags = nodes.filter((n) => typeof n !== "string").map((n) => (n as { tag: string }).tag);
    expect(tags).toContain("h1");
    expect(tags).toContain("p");
  });

  it("escapes raw html (no passthrough)", () => {
    const nodes = markdownToNodes("x <script>alert(1)</script> y");
    // never a script tag node, and re-rendering the round-tripped markdown stays safe
    expect(JSON.stringify(nodes)).not.toContain('"tag":"script"');
    const out = nodesToMarkdown(nodes);
    expect(out).toContain("alert(1)");
  });

  it("handles strikethrough, lists, code fence and links", () => {
    const fence = "\u0060\u0060\u0060";
    const md = ["~~gone~~", "", "- a", "- b", "", fence, "code", fence, "", "[link](https://x.example)"].join(NL);
    const json = JSON.stringify(markdownToNodes(md));
    expect(json).toContain('"tag":"s"');
    expect(json).toContain('"tag":"ul"');
    expect(json).toContain('"tag":"pre"');
    expect(json).toContain('"tag":"a"');
  });
});

describe("nodesToMarkdown", () => {
  it("returns empty string for empty input", () => {
    expect(nodesToMarkdown([])).toBe("");
    expect(nodesToMarkdown(undefined)).toBe("");
  });

  it("converts a paragraph", () => {
    expect(nodesToMarkdown([{ tag: "p", children: ["Hello world"] }])).toContain("Hello world");
  });

  it("formats bold and italic", () => {
    const md = nodesToMarkdown([
      { tag: "p", children: ["Normal ", { tag: "b", children: ["Bold"] }, " ", { tag: "i", children: ["Italic"] }] },
    ]);
    expect(md).toContain("**Bold**");
    expect(md).toContain("*Italic*");
  });

  it("converts links exactly like the Django version", () => {
    const md = nodesToMarkdown([{ tag: "a", attrs: { href: "https://example.com" }, children: ["Link"] }]);
    expect(md).toBe("[Link](https://example.com)");
  });

  it("handles lists, images, blockquotes and headings", () => {
    const md = nodesToMarkdown([
      { tag: "h3", children: ["Head"] },
      { tag: "ul", children: [{ tag: "li", children: ["one"] }, { tag: "li", children: ["two"] }] },
      { tag: "blockquote", children: ["quoted line"] },
      { tag: "img", attrs: { src: "https://x/i.png" } },
    ]);
    expect(md).toContain("### Head");
    expect(md).toContain("- one");
    expect(md).toContain("- two");
    expect(md).toContain("> quoted line");
    expect(md).toContain("![image](https://x/i.png)");
  });

  it("round-trips paragraphs through markdown", () => {
    const back = nodesToMarkdown(markdownToNodes("Hello **bold** world"));
    expect(back).toContain("Hello **bold** world");
  });
});
