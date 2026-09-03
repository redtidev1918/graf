import { describe, expect, it } from "vitest";
import { randomPath, randomHex, validatePath, validateId, newEditToken, newAccessToken } from "../../src/ids";

describe("ids", () => {
  it("generates 8-char paths matching the path regex", () => {
    for (let i = 0; i < 50; i++) {
      const p = randomPath();
      expect(p).toHaveLength(8);
      expect(validatePath(p)).toBe(true);
    }
  });

  it("generates tokens of the expected lengths", () => {
    expect(newEditToken()).toHaveLength(32);
    expect(newAccessToken()).toHaveLength(64);
    expect(randomHex(3)).toHaveLength(6);
  });

  it("validates ids", () => {
    expect(validatePath("abc12345")).toBe(true);
    expect(validatePath("short")).toBe(false);
    expect(validatePath("with space")).toBe(false);
    expect(validateId("a.b_c-d")).toBe(true);
    expect(validateId("a/b")).toBe(false);
    expect(validateId("x".repeat(101))).toBe(false);
  });
});
