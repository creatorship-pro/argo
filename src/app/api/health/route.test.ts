import { describe, expect, it, vi } from "vitest";

// connection() only works inside a Next.js request, so stand it in for the test.
vi.mock("next/server", () => ({ connection: async () => {} }));

import { GET } from "./route";

describe("GET /api/health", () => {
  it("reports that the service is up", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, service: "argo" });
  });
});
