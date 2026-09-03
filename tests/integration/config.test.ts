// SECRET semantics & config parsing.
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config";

const base = {
  SECRET: "a".repeat(64),
  SITE_NAME: "Graf",
  SITE_ID: "default",
  ENABLE_COMMENTS: "true",
} as const;

describe("loadConfig SECRET semantics", () => {
  it("accepts a secret when comments are enabled (defaults)", () => {
    const cfg = loadConfig({ ...base } as never);
    expect(cfg.misconfigured).toBeNull();
    expect(cfg.enableComments).toBe(true);
  });
  it("requires SECRET when comments or admin are enabled", () => {
    const cfg = loadConfig({ ENABLE_COMMENTS: "true", ADMIN_USERNAME: "", ADMIN_PASSWORD: "" } as never);
    expect(cfg.misconfigured).toContain("SECRET");
    const cfg2 = loadConfig({ ENABLE_COMMENTS: "false", ADMIN_USERNAME: "admin", ADMIN_PASSWORD: "pw" } as never);
    expect(cfg2.misconfigured).toContain("SECRET");
  });
  it("allows an intentionally stripped instance without SECRET", () => {
    const cfg = loadConfig({ ENABLE_COMMENTS: "false", ADMIN_USERNAME: "", ADMIN_PASSWORD: "" } as never);
    expect(cfg.misconfigured).toBeNull();
  });
  it("parses numeric envs sanely (bad values fall back)", () => {
    const cfg = loadConfig({ ...base, CACHE_TTL: "-5", MAX_PAGE_LENGTH: "10", COMMENT_RATE_LIMIT: "3", LIKE_RATE_LIMIT: "x" } as never);
    expect(cfg.maxPageLength).toBe(10);
    expect(cfg.cacheTtlSeconds).toBe(0);
    expect(cfg.maxCommentsPerMinute).toBe(3);
    expect(cfg.maxLikesPerMinute).toBe(60);
  });
});
