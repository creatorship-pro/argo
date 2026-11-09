import { fetchQuery } from "convex/nextjs";
import { api } from "@/lib/convex";

/** The free takeaway: the design as JSON, and a plain-words README. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string; file: string }> },
) {
  const { token, file } = await params;
  const t = await fetchQuery(api.proposals.takeaway, { token }).catch(
    () => null,
  );
  if (!t || (file !== "ai-employee.json" && file !== "README.md")) {
    return new Response("Not found", { status: 404 });
  }
  const isJson = file === "ai-employee.json";
  return new Response(isJson ? t.json : t.readme, {
    headers: {
      "content-type": isJson
        ? "application/json; charset=utf-8"
        : "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${isJson ? t.jsonFilename : t.readmeFilename}"`,
      "cache-control": "private, no-store",
      "referrer-policy": "no-referrer",
    },
  });
}
