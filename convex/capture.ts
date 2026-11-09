import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { requireGuestAccess } from "./lib/staff";

/**
 * Starting a turn is refused until consent is on record. That is the rule
 * that matters: nothing is recorded or transcribed without it.
 */
export const startTurn = mutation({
  args: { guestId: v.id("guests") },
  handler: async (ctx, { guestId }) => {
    const { staff, guest } = await requireGuestAccess(ctx, guestId);
    if (guest.consentRecordedAt == null) {
      throw new Error("Consent has not been recorded for this guest.");
    }
    return ctx.db.insert("turns", {
      guestId,
      startedAt: Date.now(),
      startedBy: staff.email,
    });
  },
});

export const endTurn = mutation({
  args: { turnId: v.id("turns") },
  handler: async (ctx, { turnId }) => {
    const turn = await ctx.db.get(turnId);
    if (!turn) throw new Error("Turn not found.");
    await requireGuestAccess(ctx, turn.guestId);
    if (turn.endedAt == null)
      await ctx.db.patch(turnId, { endedAt: Date.now() });
  },
});

/**
 * Stores one segment's transcript text. Segment indexes make a retry safe:
 * sending the same index twice does not create a second row.
 */
export const addTranscript = mutation({
  args: { turnId: v.id("turns"), index: v.number(), text: v.string() },
  handler: async (ctx, { turnId, index, text }) => {
    const turn = await ctx.db.get(turnId);
    if (!turn) throw new Error("Turn not found.");
    const { guest } = await requireGuestAccess(ctx, turn.guestId);
    if (guest.consentRecordedAt == null)
      throw new Error("Consent has not been recorded for this guest.");
    const clean = text.trim();
    if (!clean) return null;
    const dupe = await ctx.db
      .query("transcripts")
      .withIndex("by_turn", (q) => q.eq("turnId", turnId).eq("index", index))
      .first();
    if (dupe) return dupe._id;
    const id = await ctx.db.insert("transcripts", {
      guestId: turn.guestId,
      turnId,
      index,
      text: clean,
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.listener.analyze, {
      guestId: turn.guestId,
    });
    return id;
  },
});

export const transcriptCount = query({
  args: { guestId: v.id("guests") },
  handler: async (ctx, { guestId }) => {
    await requireGuestAccess(ctx, guestId);
    const rows = await ctx.db
      .query("transcripts")
      .withIndex("by_guest", (q) => q.eq("guestId", guestId))
      .collect();
    return rows.length;
  },
});
