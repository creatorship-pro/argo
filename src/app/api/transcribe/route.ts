import { api } from "@/lib/convex";
import { fetchAuthQuery } from "@/lib/auth-server";
import { transcriberFromEnv } from "@/lib/transcribe/client";

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * The iPad posts one short audio segment; this passes it to the transcription
 * server and returns the text. Staff only. Audio and text are never logged,
 * and audio is never written to disk or to the database.
 */
export async function POST(req: Request) {
  const staff = await fetchAuthQuery(api.staff.me, {}).catch(() => null);
  if (!staff)
    return Response.json({ error: "Not signed in." }, { status: 401 });
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES)
    return Response.json({ error: "Segment too large." }, { status: 413 });
  const audio = await req.arrayBuffer();
  if (audio.byteLength === 0 || audio.byteLength > MAX_BYTES) {
    return Response.json({ error: "Bad segment." }, { status: 400 });
  }
  try {
    const text = await transcriberFromEnv(process.env).transcribe(
      audio,
      req.headers.get("content-type") ?? "",
    );
    return Response.json({ text });
  } catch {
    return Response.json({ error: "Transcription failed." }, { status: 502 });
  }
}
