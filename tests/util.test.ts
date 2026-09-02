import { describe, expect, it } from "vitest";
import { toBool, plainSnippet, firstImage } from "../src/util";

describe("util", () => {
  it("parses booleans leniently", () => {
    expect(toBool("true")).toBe(true);
    expect(toBool("True")).toBe(true);
    expect(toBool("1")).toBe(true);
    expect(toBool("false")).toBe(false);
    expect(toBool("no")).toBe(false);
    expect(toBool(undefined, true)).toBe(true);
  });

  it("builds plain snippets", () => {
    const md = ["# Big", "", "Hello **world**"].join("\n");
    expect(plainSnippet(md)).toBe("Big Hello world");
  });

  it("finds first image", () => {
    expect(firstImage(["text", "", "![alt](https://x/y.png)"].join("\n"))).toBe("https://x/y.png");
    expect(firstImage("no image here")).toBeNull();
  });
});
