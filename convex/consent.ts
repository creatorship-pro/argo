import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireGuestAccess } from "./lib/staff";

/** What the FDE reads out. Bump the version if the words change. */
export const CONSENT_WORDING = "consent-v1";

export const record = mutation({
  args: { guestId: v.id("guests") },
  handler: async (ctx, { guestId }) => {
    const { staff, guest } = await requireGuestAccess(ctx, guestId);
    if (guest.consentRecordedAt != null) return guest.consentRecordedAt;
    const now = Date.now();
    await ctx.db.insert("consents", {
      guestId,
      recordedAt: now,
      recordedBy: staff.email,
      wording: CONSENT_WORDING,
    });
    await ctx.db.patch(guestId, { consentRecordedAt: now });
    return now;
  },
});

export const forGuest = query({
  args: { guestId: v.id("guests") },
  handler: async (ctx, { guestId }) => {
    await requireGuestAccess(ctx, guestId);
    return ctx.db
      .query("consents")
      .withIndex("by_guest", (q) => q.eq("guestId", guestId))
      .first();
  },
});
