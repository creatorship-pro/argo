/**
 * A very small client for the Anthropic Messages API, using fetch so there is
 * no extra dependency. Prompts and replies hold guest speech: nothing here
 * logs them.
 */
export interface LlmConfig {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}

export interface LlmRequest {
  system: string;
  user: string;
  maxTokens?: number;
}

export const DEFAULT_MODEL = "claude-sonnet-5";

export function llmConfigFromEnv(
  env: Record<string, string | undefined>,
): LlmConfig | null {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  return { apiKey, model: env.ARGO_MODEL?.trim() || DEFAULT_MODEL };
}

export class LlmError extends Error {
  constructor(public status: number) {
    super(`Model request failed with status ${status}.`);
    this.name = "LlmError";
  }
}

export async function complete(
  req: LlmRequest,
  cfg: LlmConfig,
): Promise<string> {
  const f = cfg.fetchImpl ?? fetch;
  const res = await f("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: req.maxTokens ?? 4096,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
    }),
  });
  // Deliberately do not include the response body: it can echo the prompt.
  if (!res.ok) throw new LlmError(res.status);
  const body = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  return (body.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
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
