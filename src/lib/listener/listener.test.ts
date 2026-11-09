import { describe, expect, it } from "vitest";
import {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  extractJson,
  complete,
  llmConfigFromEnv,
  LlmError,
} from "../llm";
import {
  buildListenerPrompt,
  parseAnalysis,
  stubAnalysis,
  type AnalysisInput,
} from "./analyze";
import {
  StubTranscriber,
  transcriberFromEnv,
  ParakeetTranscriber,
} from "../transcribe/client";
import { UploadQueue } from "../capture/upload-queue";

const input = (over: Partial<AnalysisInput> = {}): AnalysisInput => ({
  transcript: [
    "I spend about ten hours a week chasing people for quotes. I never check my email until late.",
  ],
  facts: [],
  openQuestions: [],
  ...over,
});

describe("listener reply handling", () => {
  it("keeps a said fact only when its quote is really in the transcript", () => {
    const a = parseAnalysis(
      {
        facts: [
          {
            text: "Ten hours a week on quotes",
            provenance: "said",
            quote: "ten hours a week chasing people for quotes",
            checklistKey: "duration",
          },
          {
            text: "Hates email",
            provenance: "said",
            quote: "I hate email so much",
            checklistKey: "constraints",
          },
        ],
      },
      input(),
    );
    expect(a.facts[0].provenance).toBe("said");
    expect(a.facts[1].provenance).toBe("inferred");
    expect(a.facts[1].quote).toBeNull();
  });
  it("never lets the model confirm a fact", () => {
    const a = parseAnalysis(
      { facts: [{ text: "x", provenance: "read-back-confirmed" }] },
      input(),
    );
    expect(a.facts[0].provenance).toBe("inferred");
  });
  it("caps suggestions at three and drops repeats", () => {
    const a = parseAnalysis(
      {
        suggestions: ["a", "b", "c", "d", "b"].map((t) => ({
          text: t,
          checklistKey: "problem",
        })),
      },
      input({ openQuestions: ["a"] }),
    );
    expect(a.suggestions.map((s) => s.text)).toEqual(["b", "c", "d"]);
  });
  it("survives garbage", () => {
    expect(parseAnalysis("nope", input())).toEqual({
      suggestions: [],
      facts: [],
    });
    expect(
      parseAnalysis({ suggestions: [1, null], facts: [{}] }, input()),
    ).toEqual({ suggestions: [], facts: [] });
  });
  it("asks about what is still missing when no model is set", () => {
    const a = stubAnalysis(input());
    expect(a.suggestions).toHaveLength(2);
    expect(a.suggestions[0].checklistKey).toBe("problem");
  });
  it("puts the transcript and the missing items in the prompt", () => {
    const p = buildListenerPrompt(input());
    expect(p.user).toContain("chasing people for quotes");
    expect(p.user).toContain("How often it happens");
    expect(p.system).toMatch(/never speak to the guest/i);
  });
});

describe("model client", () => {
  it("is off without a key", () => {
    expect(llmConfigFromEnv({})).toBeNull();
    // An Anthropic key no longer turns the model on: the gateway is the seam now.
    expect(llmConfigFromEnv({ ANTHROPIC_API_KEY: "k" })).toBeNull();
    expect(
      llmConfigFromEnv({ OPENCODE_GO_API_KEY: "k", ARGO_MODEL: "m" }),
    ).toMatchObject({ apiKey: "k", model: "m" });
    expect(llmConfigFromEnv({ ARGO_LLM_API_KEY: "k" })).toMatchObject({
      apiKey: "k",
      model: DEFAULT_MODEL,
      baseUrl: DEFAULT_BASE_URL,
    });
  });
  it("posts to the gateway with a bearer token and a session header", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return Response.json({ choices: [{ message: { content: "ok" } }] });
    }) as unknown as typeof fetch;
    expect(
      await complete(
        { system: "s", user: "u", maxTokens: 12 },
        { apiKey: "k", model: "m", baseUrl: "https://gw.test/v1/", fetchImpl },
      ),
    ).toBe("ok");
    expect(seen?.url).toBe("https://gw.test/v1/chat/completions");
    const headers = seen?.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer k");
    expect(headers["x-opencode-session"]).toMatch(/[0-9a-f-]{20,}/);
    const body = JSON.parse(String(seen?.init.body));
    expect(body.model).toBe("m");
    expect(body.max_tokens).toBe(12);
    expect(body.messages).toEqual([
      { role: "system", content: "s" },
      { role: "user", content: "u" },
    ]);
  });
  it("extracts JSON from fenced or chatty replies", () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('here: {"a":[1,2]} done')).toEqual({ a: [1, 2] });
    expect(() => extractJson("no json")).toThrow();
  });
  it("does not leak the response body in errors", async () => {
    const fetchImpl = (async () =>
      new Response("SECRET guest words", { status: 500 })) as typeof fetch;
    await expect(
      complete(
        { system: "s", user: "u" },
        { apiKey: "k", model: "m", fetchImpl },
      ),
    ).rejects.toThrow(LlmError);
    await expect(
      complete(
        { system: "s", user: "u" },
        { apiKey: "k", model: "m", fetchImpl },
      ),
    ).rejects.not.toThrow(/SECRET/);
  });
  it("reads both string and part-shaped replies", async () => {
    const parts = (async () =>
      Response.json({
        choices: [
          {
            message: {
              content: [
                { type: "text", text: "a" },
                { type: "reasoning", text: "x" },
                { type: "text", text: "b" },
              ],
            },
          },
        ],
      })) as unknown as typeof fetch;
    expect(
      await complete(
        { system: "s", user: "u" },
        { apiKey: "k", model: "m", fetchImpl: parts },
      ),
    ).toBe("ab");
  });
});

describe("transcription client", () => {
  it("falls back to a stub with no server configured", async () => {
    const t = transcriberFromEnv({});
    expect(t).toBeInstanceOf(StubTranscriber);
    expect(await t.transcribe(new ArrayBuffer(1), "audio/mp4")).toMatch(/stub/);
  });
  it("posts audio with the bearer token and returns the text", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return Response.json({ text: "hello" });
    }) as unknown as typeof fetch;
    const t = new ParakeetTranscriber("https://p.example/", "tok", fetchImpl);
    expect(await t.transcribe(new ArrayBuffer(2), "audio/mp4")).toBe("hello");
    expect(seen?.url).toBe("https://p.example/transcribe");
    expect((seen?.init.headers as Record<string, string>).authorization).toBe(
      "Bearer tok",
    );
  });
  it("fails loudly on a bad reply", async () => {
    const t = new ParakeetTranscriber(
      "https://p.example",
      undefined,
      (async () => Response.json({})) as typeof fetch,
    );
    await expect(t.transcribe(new ArrayBuffer(1), "x")).rejects.toThrow(
      /no text/,
    );
  });
});

describe("upload queue (segments retry after a dropped connection)", () => {
  const fast = { sleep: async () => {}, backoff: () => 0 };
  it("sends in order and empties", async () => {
    const sent: number[] = [];
    const q = new UploadQueue<string>(
      async (s) => void sent.push(s.index),
      fast,
    );
    q.push("a");
    q.push("b");
    expect(await q.flush()).toEqual({ sent: 2, failed: 0 });
    expect(sent).toEqual([0, 1]);
  });
  it("retries the same segment, keeping its index, after a failure", async () => {
    let calls = 0;
    const sent: number[] = [];
    const q = new UploadQueue<string>(async (s) => {
      calls += 1;
      if (calls <= 2) throw new Error("offline");
      sent.push(s.index);
    }, fast);
    q.push("a");
    q.push("b");
    expect(await q.flush()).toEqual({ sent: 2, failed: 0 });
    expect(sent).toEqual([0, 1]);
    expect(calls).toBe(4);
  });
  it("keeps unsent segments when the connection stays down", async () => {
    const q = new UploadQueue<string>(
      async () => {
        throw new Error("offline");
      },
      { ...fast, maxAttempts: 3 },
    );
    q.push("a");
    q.push("b");
    expect(await q.flush()).toEqual({ sent: 0, failed: 2 });
    expect(q.pending).toBe(2);
  });
});

import { pickMimeType } from "../capture/recorder";
import { partitionFacts } from "../profile/view";
import type { ProfileFact } from "../profile/facts";

describe("iPad recording", () => {
  it("never hard-codes a file type: takes the first one the browser supports", () => {
    expect(pickMimeType((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(pickMimeType((t) => t.startsWith("audio/webm"))).toBe(
      "audio/webm;codecs=opus",
    );
    expect(pickMimeType(() => false)).toBeUndefined();
  });
});

describe("FDE profile groups", () => {
  const f = (
    id: string,
    provenance: ProfileFact["provenance"],
  ): ProfileFact => ({
    id,
    text: id,
    provenance,
    quote: null,
    checklistKey: null,
    lockedAt: null,
  });
  it("keeps inferred facts out of the confirmed anchors and marks them as drafts", () => {
    const p = partitionFacts([
      f("a", "inferred"),
      f("b", "read-back-confirmed"),
      f("c", "said"),
      f("d", "fde-approved"),
    ]);
    expect(p.anchors.map((x) => x.id)).toEqual(["b", "d"]);
    expect(p.drafts.map((x) => x.id)).toEqual(["c", "a"]);
  });
});
