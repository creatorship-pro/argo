import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { checkLink, hashToken, looksLikeToken } from "../src/lib/access/tokens";
import { OFFER, isPurchasable } from "../src/lib/proposal/offer";
import type { BlueprintSet } from "../src/lib/blueprint/types";
import { findDesign } from "../src/lib/proposal/view";

async function linkFor(ctx: QueryCtx, token: string) {
  if (!looksLikeToken(token)) return null;
  const hash = await hashToken(token);
  const link = await ctx.db
    .query("proposalLinks")
    .withIndex("by_hash", (q) => q.eq("tokenHash", hash))
    .unique();
  return checkLink(link, Date.now()) === "ok" ? link : null;
}

/**
 * What the checkout route needs, for a live token. The amounts come from the
 * offer file on the server, never from the browser.
 */
export const checkoutContext = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const link = await linkFor(ctx, token);
    if (!link) return null;
    const set = await ctx.db.get(link.designSetId);
    if (!set) return null;
    const bp = set.blueprint as BlueprintSet;
    const designId = set.fdeChoice ?? bp.recommendation.designId;
    const design = findDesign(bp, designId);
    if (!design) return null;
    const paid = (
      await ctx.db
        .query("purchases")
        .withIndex("by_guest", (q) => q.eq("guestId", link.guestId))
        .collect()
    ).some((p) => p.status === "paid");
    return {
      guestId: link.guestId as string,
      designSetId: set._id as string,
      designId,
      designName: design.name,
      offer: OFFER,
      purchasable: isPurchasable(OFFER),
      alreadyPaid: paid,
    };
  },
});

export const recordPending = mutation({
  args: { token: v.string(), sessionId: v.string() },
  handler: async (ctx, { token, sessionId }) => {
    const link = await linkFor(ctx, token);
    if (!link) throw new Error("This link is not valid.");
    const set = await ctx.db.get(link.designSetId);
    if (!set) throw new Error("This link is not valid.");
    const designId =
      set.fdeChoice ?? (set.blueprint as BlueprintSet).recommendation.designId;
    await ctx.db.insert("purchases", {
      guestId: link.guestId,
      designSetId: link.designSetId,
      designId,
      stripeSessionId: sessionId,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

/** Called only by the verified Stripe webhook. Safe to repeat: Stripe may send an event twice. */
export const markPaid = internalMutation({
  args: {
    sessionId: v.string(),
    amountTotal: v.union(v.number(), v.null()),
    currency: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { sessionId, amountTotal, currency }) => {
    const row = await ctx.db
      .query("purchases")
      .withIndex("by_session", (q) => q.eq("stripeSessionId", sessionId))
      .unique();
    if (!row) return "unknown" as const;
    if (row.status === "paid") return "already" as const;
    await ctx.db.patch(row._id, {
      status: "paid",
      paidAt: Date.now(),
      amountTotal: amountTotal ?? undefined,
      currency: currency ?? undefined,
    });
    return "paid" as const;
  },
});

export const markExpired = internalMutation({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const row = await ctx.db
      .query("purchases")
      .withIndex("by_session", (q) => q.eq("stripeSessionId", sessionId))
      .unique();
    if (row && row.status === "pending")
      await ctx.db.patch(row._id, { status: "expired" });
  },
});
