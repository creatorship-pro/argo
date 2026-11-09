// Devices ask the server what time it is, once, to count timers down from
// server end times. Nothing is stored.

export function GET() {
  return Response.json(
    { now: Date.now() },
    { headers: { "cache-control": "no-store" } },
  );
}
