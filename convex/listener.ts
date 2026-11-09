import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { checklistKey } from "./lib/validators";
import { complete, extractJson, llmConfigFromEnv } from "../src/lib/llm";
import {
  buildListenerPrompt,
  parseAnalysis,
  stubAnalysis,
  type AnalysisInput,
} from "../src/lib/listener/analyze";
import type { ProfileFact } from "../src/lib/profile/facts";

/** How much recent transcript the agent reads each time, in characters. */
const WINDOW_CHARS = 6000;

export const context = internalQuery({
  args: { guestId: v.id("guests") },
  handler: async (ctx, { guestId }): Promise<AnalysisInput> => {
    const rows = await ctx.db
      .query("transcripts")
      .withIndex("by_guest", (q) => q.eq("guestId", guestId))
      .collect();
    rows.sort((a, b) => a.createdAt - b.createdAt || a.index - b.index);
    const transcript: string[] = [];
    let size = 0;
    for (const r of rows.reverse()) {
      size += r.text.length;
      if (size > WINDOW_CHARS && transcript.length > 0) break;
      transcript.unshift(r.text);
    }
    const facts = await ctx.db
      .query("profileFacts")
      .withIndex("by_guest", (q) => q.eq("guestId", guestId))
      .collect();
    const open = (
      await ctx.db
        .query("suggestions")
        .withIndex("by_guest", (q) => q.eq("guestId", guestId))
        .collect()
    ).filter((s) => s.status === "open");
    return {
      transcript,
      facts: facts.map((d): ProfileFact => ({
        id: d._id,
        text: d.text,
        provenance: d.provenance,
        quote: d.quote ?? null,
        checklistKey: d.checklistKey ?? null,
        lockedAt: d.lockedAt ?? null,
      })),
      openQuestions: open.map((s) => s.text),
    };
  },
});

export const apply = internalMutation({
  args: {
    guestId: v.id("guests"),
    suggestions: v.array(
      v.object({
        text: v.string(),
        checklistKey: v.union(checklistKey, v.null()),
      }),
    ),
    facts: v.array(
      v.object({
        text: v.string(),
        provenance: v.union(v.literal("said"), v.literal("inferred")),
        quote: v.union(v.string(), v.null()),
        checklistKey: v.union(checklistKey, v.null()),
      }),
    ),
  },
  handler: async (ctx, { guestId, suggestions, facts }) => {
    const now = Date.now();
    for (const s of suggestions) {
      await ctx.db.insert("suggestions", {
        guestId,
        text: s.text,
        checklistKey: s.checklistKey ?? undefined,
        status: "open",
        createdAt: now,
      });
    }
    for (const f of facts) {
      await ctx.db.insert("profileFacts", {
        guestId,
        text: f.text,
        provenance: f.provenance,
        quote: f.quote ?? undefined,
        checklistKey: f.checklistKey ?? undefined,
        createdAt: now,
      });
    }
  },
});

/**
 * Runs after each new transcript segment. One model call reads the recent
 * transcript, the profile and the checklist, and returns suggested questions
 * and proposed profile updates. Nothing it proposes is confirmed. If the call
 * fails, the FDE carries on with the intake script, so errors are swallowed
 * here and only the error kind is logged, never the content.
 */
export const analyze = internalAction({
  args: { guestId: v.id("guests") },
  handler: async (ctx, { guestId }) => {
    const input = await ctx.runQuery(internal.listener.context, { guestId });
    if (input.transcript.length === 0) return;
    const cfg = llmConfigFromEnv(process.env);
    try {
      const analysis = cfg
        ? parseAnalysis(
            extractJson(
              await complete(
                { ...buildListenerPrompt(input), maxTokens: 1500 },
                cfg,
              ),
            ),
            input,
          )
        : stubAnalysis(input);
      await ctx.runMutation(internal.listener.apply, {
        guestId,
        suggestions: analysis.suggestions,
        facts: analysis.facts.map((f) => ({
          text: f.text,
          provenance:
            f.provenance === "said" ? ("said" as const) : ("inferred" as const),
          quote: f.quote,
          checklistKey: f.checklistKey,
        })),
      });
    } catch (e) {
      console.error(
        "listener analysis failed:",
        e instanceof Error ? e.name : "unknown",
      );
    }
  },
});
