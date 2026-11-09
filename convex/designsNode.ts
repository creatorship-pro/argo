"use node";

import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";
import { completeWith, buildBlueprintSet } from "../src/lib/blueprint/builder";
import { chooseProblem } from "../src/lib/blueprint/problem";
import { stubBlueprintSet } from "../src/lib/blueprint/stub";
import { llmConfigFromEnv } from "../src/lib/llm";

/**
 * Builds three designs and a recommendation for a guest (ticket A4). Without a
 * model key it saves a clearly labeled stub so the rest of the app can be
 * tried end to end.
 */
export const generate = action({
  args: { guestId: v.id("guests") },
  handler: async (
    ctx,
    { guestId },
  ): Promise<
    { ok: true; designSetId: string } | { ok: false; error: string }
  > => {
    // Enforces that the caller is staff and may touch this guest.
    await ctx.runQuery(api.guests.get, { guestId });
    const profile = await ctx.runQuery(internal.designs.profile, { guestId });
    if (!profile.hasConfirmed) {
      return {
        ok: false,
        error: "Lock at least one read-back problem before designing.",
      };
    }
    const cfg = llmConfigFromEnv(process.env);
    const allowUnvetted = process.env.ARGO_ALLOW_UNVETTED === "1";
    if (!cfg) {
      const designSetId = await ctx.runMutation(internal.designs.save, {
        guestId,
        blueprint: stubBlueprintSet(profile.guest),
        generatedBy: "stub",
      });
      return { ok: true, designSetId };
    }
    const llm = completeWith(cfg);
    const problem = await chooseProblem(llm, profile, undefined, allowUnvetted);
    if (!problem) {
      return {
        ok: false,
        error:
          "No problem from this profile can be designed with vetted capabilities. The gap is for the capability list (B1).",
      };
    }
    const built = await buildBlueprintSet(llm, {
      profile,
      problem: problem.title,
      hoursLostPerWeek: problem.hoursLostPerWeek,
      allowUnvetted,
    });
    if (!built.ok)
      return {
        ok: false,
        error: `The designs did not validate: ${built.errors.join(" | ")}`,
      };
    const designSetId = await ctx.runMutation(internal.designs.save, {
      guestId,
      blueprint: built.set,
      generatedBy: "model",
    });
    return { ok: true, designSetId };
  },
});
