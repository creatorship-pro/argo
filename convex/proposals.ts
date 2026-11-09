import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireGuestAccess } from "./lib/staff";
import { canMove } from "../src/lib/session/guest-status";
import {
  checkLink,
  DEFAULT_LINK_TTL_MS,
  generateToken,
  hashToken,
  looksLikeToken,
} from "../src/lib/access/tokens";
import { buildTakeaway } from "../src/lib/proposal/takeaway";
import { chosenDesign, proposalView } from "../src/lib/proposal/view";
import { OFFER, deliveryDate, isPurchasable } from "../src/lib/proposal/offer";
import type { BlueprintSet } from "../src/lib/blueprint/types";

/**
 * Creates the guest's private link and returns the raw token ONCE. Only its
 * hash is stored, so the QR code on the FDE's iPad is the only place it exists.
 * Any earlier link for this guest is revoked, so there is one live link each.
 */
export const createLink = mutation({
  args: { guestId: v.id("guests"), ttlDays: v.optional(v.number()) },
  handler: async (ctx, { guestId, ttlDays }) => {
    const { staff, guest } = await requireGuestAccess(ctx, guestId);
    const set = await ctx.db
      .query("designSets")
      .withIndex("by_guest", (q) => q.eq("guestId", guestId))
      .order("desc")
      .first();
    if (!set || !set.fdeChoice)
      throw new Error("Choose a design before opening the proposal.");
    const now = Date.now();
    const old = await ctx.db
      .query("proposalLinks")
      .withIndex("by_guest", (q) => q.eq("guestId", guestId))
      .collect();
    for (const l of old)
      if (l.revokedAt == null) await ctx.db.patch(l._id, { revokedAt: now });
    const token = generateToken();
    const expiresAt =
      ttlDays == null
        ? now + DEFAULT_LINK_TTL_MS
        : now + Math.min(Math.max(ttlDays, 1), 30) * 24 * 60 * 60 * 1000;
    await ctx.db.insert("proposalLinks", {
      guestId,
      designSetId: set._id,
      tokenHash: await hashToken(token),
      expiresAt,
      createdAt: now,
      createdBy: staff.email,
    });
    if (canMove(guest.status, "proposed"))
      await ctx.db.patch(guestId, { status: "proposed" });
    return { token, expiresAt };
  },
});

export const revoke = mutation({
  args: { guestId: v.id("guests") },
  handler: async (ctx, { guestId }) => {
    await requireGuestAccess(ctx, guestId);
    const now = Date.now();
    const links = await ctx.db
      .query("proposalLinks")
      .withIndex("by_guest", (q) => q.eq("guestId", guestId))
      .collect();
    let n = 0;
    for (const l of links) {
      if (l.revokedAt == null) {
        await ctx.db.patch(l._id, { revokedAt: now });
        n++;
      }
    }
    return n;
  },
});

export const linksForGuest = query({
  args: { guestId: v.id("guests") },
  handler: async (ctx, { guestId }) => {
    await requireGuestAccess(ctx, guestId);
    const links = await ctx.db
      .query("proposalLinks")
      .withIndex("by_guest", (q) => q.eq("guestId", guestId))
      .order("desc")
      .collect();
    const now = Date.now();
    return links.map((l) => ({
      id: l._id,
      createdAt: l.createdAt,
      expiresAt: l.expiresAt,
      state: checkLink(l, now),
    }));
  },
});

async function resolve(
  ctx: QueryCtx,
  token: string,
): Promise<
  | {
      state: "ok";
      link: Doc<"proposalLinks">;
      set: Doc<"designSets">;
      guest: Doc<"guests">;
    }
  | { state: "expired" | "revoked" | "unknown" }
> {
  if (!looksLikeToken(token)) return { state: "unknown" };
  const hash = await hashToken(token);
  const link = await ctx.db
    .query("proposalLinks")
    .withIndex("by_hash", (q) => q.eq("tokenHash", hash))
    .unique();
  const state = checkLink(link, Date.now());
  if (state !== "ok" || !link)
    return { state: state === "ok" ? "unknown" : state };
  const set = await ctx.db.get(link.designSetId);
  const guest = await ctx.db.get(link.guestId);
  if (!set || !guest) return { state: "unknown" };
  return { state: "ok", link, set, guest };
}

/** Public: what the guest's page needs, and nothing else. No evidence panel, no catalog. */
export const byToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const r = await resolve(ctx, token);
    if (r.state !== "ok") return { status: r.state } as const;
    const set = r.set.blueprint as BlueprintSet;
    const designId = r.set.fdeChoice ?? set.recommendation.designId;
    const view = proposalView(set, designId);
    if (!view) return { status: "unknown" } as const;
    const purchases = await ctx.db
      .query("purchases")
      .withIndex("by_guest", (q) => q.eq("guestId", r.guest._id))
      .collect();
    return {
      status: "ok",
      guestName: r.guest.name,
      business: r.guest.business,
      view,
      expiresAt: r.link.expiresAt,
      offer: { ...OFFER, purchasable: isPurchasable(OFFER) },
      readyBy: deliveryDate(Date.now(), OFFER.deliveryDays).getTime(),
      paid: purchases.some((p) => p.status === "paid"),
      stub: set.note?.startsWith("STAND-IN") ?? false,
    } as const;
  },
});

export const takeaway = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const r = await resolve(ctx, token);
    if (r.state !== "ok") return null;
    const set = r.set.blueprint as BlueprintSet;
    return buildTakeaway(set, r.set.fdeChoice ?? set.recommendation.designId);
  },
});

/** The FDE's full-screen view of the same page, with the evidence behind it. */
export const forFde = query({
  args: { guestId: v.id("guests") },
  handler: async (ctx, { guestId }) => {
    const { guest } = await requireGuestAccess(ctx, guestId);
    const row = await ctx.db
      .query("designSets")
      .withIndex("by_guest", (q) => q.eq("guestId", guestId))
      .order("desc")
      .first();
    if (!row) return null;
    const set = row.blueprint as BlueprintSet;
    const d = chosenDesign({
      ...set,
      fdeChoice: row.fdeChoice ?? set.fdeChoice,
    });
    if (!d) return null;
    return {
      guestName: guest.name,
      business: guest.business,
      designSetId: row._id,
      chosen: row.fdeChoice ?? null,
      view: proposalView(set, row.fdeChoice ?? set.recommendation.designId),
      set,
      offer: { ...OFFER, purchasable: isPurchasable(OFFER) },
      readyBy: deliveryDate(Date.now(), OFFER.deliveryDays).getTime(),
    };
  },
});
