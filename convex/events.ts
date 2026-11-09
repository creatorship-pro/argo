import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaff } from "./lib/staff";

/** The event staff are working on: the most recently created one. */
export const current = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const event = await ctx.db.query("events").order("desc").first();
    if (!event) return null;
    const segments = await ctx.db
      .query("segments")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .collect();
    return { event, segments };
  },
});

/**
 * Starts a segment and stamps its server end time. The facilitator confirms
 * each phase change by hand: nothing here advances on its own.
 */
export const startSegment = mutation({
  args: { eventId: v.id("events"), order: v.number() },
  handler: async (ctx, { eventId, order }) => {
    await requireStaff(ctx, ["facilitator"]);
    const segment = await ctx.db
      .query("segments")
      .withIndex("by_event", (q) => q.eq("eventId", eventId).eq("order", order))
      .unique();
    if (!segment) throw new Error("No such segment.");
    await ctx.db.patch(eventId, {
      currentOrder: order,
      segmentEndsAt: Date.now() + segment.minutes * 60_000,
    });
  },
});

/** Adds or removes minutes on the running segment. */
export const adjustSegment = mutation({
  args: { eventId: v.id("events"), deltaMinutes: v.number() },
  handler: async (ctx, { eventId, deltaMinutes }) => {
    await requireStaff(ctx, ["facilitator"]);
    const event = await ctx.db.get(eventId);
    if (!event || event.segmentEndsAt == null)
      throw new Error("No segment is running.");
    await ctx.db.patch(eventId, {
      segmentEndsAt: event.segmentEndsAt + deltaMinutes * 60_000,
    });
  },
});

export const stop = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await requireStaff(ctx, ["facilitator"]);
    await ctx.db.patch(eventId, { currentOrder: -1, segmentEndsAt: undefined });
  },
});
