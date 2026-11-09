import { describe, expect, it } from "vitest";
import { findStaff, parseAllowlist, canSee } from "./staff";
import { checkLink, generateToken, hashToken, looksLikeToken } from "./tokens";

describe("guest link tokens", () => {
  it("are long, random and unique", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(looksLikeToken(a)).toBe(true);
    expect(a.length).toBeGreaterThanOrEqual(43);
  });
  it("store only a hash, and the same token always hashes the same", async () => {
    const t = generateToken();
    expect(await hashToken(t)).toBe(await hashToken(t));
    expect(await hashToken(t)).not.toContain(t);
  });
  it("rejects junk before it reaches the database", () => {
    expect(looksLikeToken("short")).toBe(false);
    expect(looksLikeToken("../../etc/passwd")).toBe(false);
  });
  it("stop working when expired or revoked", () => {
    const now = 1_000;
    expect(checkLink({ expiresAt: 2_000 }, now)).toBe("ok");
    expect(checkLink({ expiresAt: 1_000 }, now)).toBe("expired");
    expect(checkLink({ expiresAt: 9_000, revokedAt: 500 }, now)).toBe(
      "revoked",
    );
    expect(checkLink(null, now)).toBe("unknown");
  });
});

describe("staff allowlist", () => {
  const list = parseAllowlist(
    "Ana@Example.com:fde, sam@example.com:facilitator,boss@example.com:admin,bare@example.com,bad,x@y.com:wizard",
  );
  it("parses roles, defaults to fde, and skips junk", () => {
    expect(list.map((m) => `${m.email}:${m.role}`)).toEqual([
      "ana@example.com:fde",
      "sam@example.com:facilitator",
      "boss@example.com:admin",
      "bare@example.com:fde",
    ]);
  });
  it("finds staff case-insensitively and refuses strangers", () => {
    expect(findStaff(list, "ANA@example.com")?.role).toBe("fde");
    expect(findStaff(list, "nobody@example.com")).toBeNull();
    expect(findStaff(list, undefined)).toBeNull();
  });
  it("lets admins see everything", () => {
    expect(canSee("admin", ["facilitator"])).toBe(true);
    expect(canSee("fde", ["facilitator"])).toBe(false);
  });
});
