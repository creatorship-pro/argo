/**
 * Client for the Parakeet transcription server. The contract this app
 * expects (also written in the README so the server can be built to match):
 *
 *   POST {PARAKEET_URL}/transcribe
 *   Authorization: Bearer {PARAKEET_TOKEN}
 *   Content-Type: the audio's own type (for example audio/mp4)
 *   body: the audio bytes
 *   -> 200 {"text": "..."}
 *
 * Audio and text are never logged.
 */
export interface Transcriber {
  transcribe(audio: ArrayBuffer, contentType: string): Promise<string>;
}

export class ParakeetTranscriber implements Transcriber {
  constructor(
    private url: string,
    private token: string | undefined,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  async transcribe(audio: ArrayBuffer, contentType: string): Promise<string> {
    const res = await this.fetchImpl(
      `${this.url.replace(/\/$/, "")}/transcribe`,
      {
        method: "POST",
        headers: {
          "content-type": contentType || "application/octet-stream",
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        },
        body: audio,
      },
    );
    if (!res.ok)
      throw new Error(`Transcription failed with status ${res.status}.`);
    const body = (await res.json()) as { text?: unknown };
    if (typeof body.text !== "string")
      throw new Error("Transcription reply had no text.");
    return body.text;
  }
}

/** Stands in until the Parakeet server exists. Obviously fake, on purpose. */
export class StubTranscriber implements Transcriber {
  private n = 0;
  async transcribe(): Promise<string> {
    this.n += 1;
    return `[stub transcript ${this.n}: the transcription server is not set up yet]`;
  }
}

export function transcriberFromEnv(
  env: Record<string, string | undefined>,
  fetchImpl?: typeof fetch,
): Transcriber {
  const url = env.PARAKEET_URL?.trim();
  if (!url) return new StubTranscriber();
  return new ParakeetTranscriber(
    url,
    env.PARAKEET_TOKEN?.trim() || undefined,
    fetchImpl,
  );
}
