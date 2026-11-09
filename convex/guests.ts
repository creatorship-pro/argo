import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { guestStatus } from "./lib/validators";
import { requireGuestAccess, requireStaff } from "./lib/staff";
import { canMove } from "../src/lib/session/guest-status";

/** The FDE's assigned guests. Facilitators and admins see everyone. */
export const mine = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const staff = await requireStaff(ctx);
    if (staff.role === "fde") {
      return ctx.db
        .query("guests")
        .withIndex("by_event_fde", (q) =>
          q.eq("eventId", eventId).eq("fdeEmail", staff.email),
        )
        .collect();
    }
    return ctx.db
      .query("guests")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();
  },
});

export const get = query({
  args: { guestId: v.id("guests") },
  handler: async (ctx, { guestId }) =>
    (await requireGuestAccess(ctx, guestId)).guest,
});

export const setStatus = mutation({
  args: { guestId: v.id("guests"), status: guestStatus },
  handler: async (ctx, { guestId, status }) => {
    const { guest } = await requireGuestAccess(ctx, guestId);
    if (!canMove(guest.status, status)) {
      throw new Error(`Cannot move a guest from ${guest.status} to ${status}.`);
    }
    await ctx.db.patch(guestId, { status });
  },
});

export const create = mutation({
  args: {
    eventId: v.id("events"),
    name: v.string(),
    business: v.string(),
    fdeEmail: v.string(),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, ["admin"]);
    return ctx.db.insert("guests", {
      ...args,
      fdeEmail: args.fdeEmail.trim().toLowerCase(),
      status: "confirmed",
      createdAt: Date.now(),
    });
  },
});
