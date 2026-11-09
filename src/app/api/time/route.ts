import { connection } from "next/server";

// Devices ask the server what time it is, once, to count timers down from
// server end times. Nothing is stored. connection() keeps it from being
// prerendered, which would freeze the time at build.
export async function GET() {
  await connection();
  return Response.json(
    { now: Date.now() },
    { headers: { "cache-control": "no-store" } },
  );
}
