import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireGuestAccess } from "./lib/staff";
import { canMove } from "../src/lib/session/guest-status";
import { isConfirmed } from "../src/lib/profile/facts";

/** The latest design set for a guest: three designs, the recommendation, the choice. */
export const forGuest = query({
  args: { guestId: v.id("guests") },
  handler: async (ctx, { guestId }) => {
    await requireGuestAccess(ctx, guestId);
    return ctx.db
      .query("designSets")
      .withIndex("by_guest", (q) => q.eq("guestId", guestId))
      .order("desc")
      .first();
  },
});

export const profile = internalQuery({
  args: { guestId: v.id("guests") },
  handler: async (ctx, { guestId }) => {
    const guest = await ctx.db.get(guestId);
    if (!guest) throw new Error("Guest not found.");
    const facts = await ctx.db
      .query("profileFacts")
      .withIndex("by_guest", (q) => q.eq("guestId", guestId))
      .collect();
    return {
      guest: {
        id: guest._id as string,
        name: guest.name,
        business: guest.business,
      },
      facts: facts.map((f) => ({
        id: f._id as string,
        text: f.text,
        provenance: f.provenance,
        quote: f.quote ?? null,
      })),
      hasConfirmed: facts.some((f) => isConfirmed(f.provenance)),
    };
  },
});

export const save = internalMutation({
  args: {
    guestId: v.id("guests"),
    blueprint: v.any(),
    generatedBy: v.union(v.literal("model"), v.literal("stub")),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("designSets", { ...args, createdAt: Date.now() });
  },
});

/**
 * The FDE picks the design they think the guest is most likely to choose.
 * It need not match the system's recommendation; both are stored so accuracy
 * can be measured later.
 */
export const choose = mutation({
  args: {
    designSetId: v.id("designSets"),
    designId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { designSetId, designId, reason }) => {
    const set = await ctx.db.get(designSetId);
    if (!set) throw new Error("Design set not found.");
    const { staff, guest } = await requireGuestAccess(ctx, set.guestId);
    const designs: { id: string; fitCheck?: { status?: string } }[] =
      set.blueprint?.designs ?? [];
    const chosen = designs.find((d) => d.id === designId);
    if (!chosen) throw new Error("That design is not in this set.");
    if (chosen.fitCheck?.status === "blocked") {
      throw new Error(
        "That design is blocked: it needs a capability that is not vetted yet.",
      );
    }
    await ctx.db.patch(designSetId, {
      fdeChoice: designId,
      fdeChoiceReason: reason?.trim() || undefined,
      chosenBy: staff.email,
      chosenAt: Date.now(),
      blueprint: {
        ...set.blueprint,
        fdeChoice: designId,
        fdeChoiceReason: reason?.trim() || null,
      },
    });
    if (canMove(guest.status, "reviewed"))
      await ctx.db.patch(guest._id, { status: "reviewed" });
  },
});
