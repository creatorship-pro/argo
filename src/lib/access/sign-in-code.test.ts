import { describe, expect, it, vi } from "vitest";
import {
  deliverSignInCode,
  resendSender,
  type DeliveryDeps,
} from "./sign-in-code";

const deps = (
  env: Record<string, string>,
): DeliveryDeps & { sent: unknown[]; lines: string[] } => {
  const sent: unknown[] = [];
  const lines: string[] = [];
  return {
    env,
    send: async (m) => void sent.push(m),
    log: (l) => void lines.push(l),
    sent,
    lines,
  };
};

describe("staff sign-in codes", () => {
  it("send nothing to anyone off the allowlist, and say nothing about it", async () => {
    const d = deps({
      STAFF_ALLOWLIST: "ana@x.com",
      EMAIL_API_KEY: "k",
      EMAIL_FROM: "a@b.c",
    });
    expect(await deliverSignInCode("stranger@x.com", "123456", d)).toBe(
      "skipped",
    );
    expect(d.sent).toEqual([]);
    expect(d.lines).toEqual([]);
  });
  it("log the code in development, when no email key is set", async () => {
    const d = deps({ STAFF_ALLOWLIST: "ana@x.com" });
    expect(await deliverSignInCode("ANA@x.com", "123456", d)).toBe("logged");
    expect(d.lines[0]).toContain("123456");
    expect(d.sent).toEqual([]);
  });
  it("email the code when a key and sender are set", async () => {
    const d = deps({
      STAFF_ALLOWLIST: "ana@x.com",
      EMAIL_API_KEY: "k",
      EMAIL_FROM: "argo@x.com",
    });
    expect(await deliverSignInCode("ana@x.com", "654321", d)).toBe("sent");
    expect(d.sent[0]).toMatchObject({ from: "argo@x.com", to: "ana@x.com" });
    expect(JSON.stringify(d.sent[0])).toContain("654321");
    expect(d.lines).toEqual([]);
  });
  it("fail loudly, not by logging, when a key is set but no sender", async () => {
    const d = deps({ STAFF_ALLOWLIST: "ana@x.com", EMAIL_API_KEY: "k" });
    await expect(deliverSignInCode("ana@x.com", "1", d)).rejects.toThrow(
      /EMAIL_FROM/,
    );
    expect(d.lines).toEqual([]);
  });
  it("report a provider failure", async () => {
    const send = resendSender(
      "k",
      (async () => new Response("no", { status: 403 })) as typeof fetch,
    );
    await expect(
      send({ from: "a", to: "b", subject: "s", text: "t" }),
    ).rejects.toThrow(/403/);
  });
  it("post to the provider with the key", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    await resendSender(
      "sekret",
      f as unknown as typeof fetch,
    )({ from: "a", to: "b", subject: "s", text: "t" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer sekret",
    );
  });
});
