/**
 * A very small client for the OpenCode Go gateway, using fetch so there is no
 * extra dependency. It speaks the OpenAI-compatible chat completions shape.
 *
 * Prompts and replies hold guest speech: nothing here logs them.
 *
 * The gateway is not the model. `ARGO_MODEL` picks the model behind it; models
 * are listed at https://opencode.ai/zen/go/v1/models . Every request needs an
 * `x-opencode-session` header, which is how the gateway routes a conversation.
 */
export interface LlmConfig {
  apiKey: string;
  model: string;
  /** Defaults to https://opencode.ai/zen/go/v1 */
  baseUrl?: string;
  /** Defaults to a fresh UUID per request. Reuse one to keep routing stable. */
  sessionId?: string;
  fetchImpl?: typeof fetch;
}

export interface LlmRequest {
  system: string;
  user: string;
  maxTokens?: number;
}

export const DEFAULT_BASE_URL = "https://opencode.ai/zen/go/v1";

/** The model behind the gateway, not the gateway itself. */
export const DEFAULT_MODEL = "glm-5.3";

export function llmConfigFromEnv(
  env: Record<string, string | undefined>,
): LlmConfig | null {
  const apiKey = (env.OPENCODE_GO_API_KEY ?? env.ARGO_LLM_API_KEY)?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    model: env.ARGO_MODEL?.trim() || DEFAULT_MODEL,
    baseUrl: env.ARGO_LLM_BASE_URL?.trim() || DEFAULT_BASE_URL,
  };
}

export class LlmError extends Error {
  constructor(public status: number) {
    super(`Model request failed with status ${status}.`);
    this.name = "LlmError";
  }
}

/** Reads the reply whether the gateway returns a string or content parts. */
function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object") {
        const { type, text } = part as { type?: unknown; text?: unknown };
        // Reasoning and tool parts are not the reply.
        if (type !== undefined && type !== "text") return "";
        return typeof text === "string" ? text : "";
      }
      return "";
    })
    .join("");
}

export async function complete(
  req: LlmRequest,
  cfg: LlmConfig,
): Promise<string> {
  const f = cfg.fetchImpl ?? fetch;
  const baseUrl = (cfg.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const res = await f(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
      "x-opencode-session": cfg.sessionId ?? crypto.randomUUID(),
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: req.maxTokens ?? 4096,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
    }),
  });
  // Deliberately do not include the response body: it can echo the prompt.
  if (!res.ok) throw new LlmError(res.status);
  const body = (await res.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  return textOf(body.choices?.[0]?.message?.content);
}

/** Pulls the first JSON value out of a reply, tolerating code fences and chatter. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start < 0) throw new Error("The model reply had no JSON in it.");
  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  const end = candidate.lastIndexOf(close);
  if (end <= start) throw new Error("The model reply had unfinished JSON.");
  return JSON.parse(candidate.slice(start, end + 1));
}
