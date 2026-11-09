import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { groupStatus } from "./lib/validators";
import { requireStaff } from "./lib/staff";

/** The FDE taps a chip to say what their group is doing. */
export const setMine = mutation({
  args: { eventId: v.id("events"), status: groupStatus },
  handler: async (ctx, { eventId, status }) => {
    const staff = await requireStaff(ctx, ["fde"]);
    const existing = await ctx.db
      .query("groupStatus")
      .withIndex("by_event_fde", (q) =>
        q.eq("eventId", eventId).eq("fdeEmail", staff.email),
      )
      .unique();
    const row = {
      eventId,
      fdeEmail: staff.email,
      status,
      updatedAt: Date.now(),
    };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("groupStatus", row);
  },
});

export const mine = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const staff = await requireStaff(ctx, ["fde"]);
    return ctx.db
      .query("groupStatus")
      .withIndex("by_event_fde", (q) =>
        q.eq("eventId", eventId).eq("fdeEmail", staff.email),
      )
      .unique();
  },
});

/** One chip per FDE group, with how many guests each has and where they are. */
export const board = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    await requireStaff(ctx, ["facilitator"]);
    const guests = await ctx.db
      .query("guests")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();
    const statuses = await ctx.db
      .query("groupStatus")
      .withIndex("by_event_fde", (q) => q.eq("eventId", eventId))
      .collect();
    const byFde = new Map<
      string,
      { fdeEmail: string; guests: number; byStatus: Record<string, number> }
    >();
    for (const g of guests) {
      const row = byFde.get(g.fdeEmail) ?? {
        fdeEmail: g.fdeEmail,
        guests: 0,
        byStatus: {},
      };
      row.guests += 1;
      row.byStatus[g.status] = (row.byStatus[g.status] ?? 0) + 1;
      byFde.set(g.fdeEmail, row);
    }
    return [...byFde.values()]
      .sort((a, b) => a.fdeEmail.localeCompare(b.fdeEmail))
      .map((row) => {
        const s = statuses.find((x) => x.fdeEmail === row.fdeEmail);
        return {
          ...row,
          status: s?.status ?? ("idle" as const),
          updatedAt: s?.updatedAt ?? null,
        };
      });
  },
});
