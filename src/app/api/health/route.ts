import { connection } from "next/server";

// With cacheComponents on, a route handler is prerendered unless it touches a
// runtime API. connection() makes sure the health check runs on every request.
export async function GET() {
  await connection();
  return Response.json({ ok: true, service: "argo" });
}
