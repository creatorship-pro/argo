import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { checklistKey } from "./lib/validators";
import { requireGuestAccess } from "./lib/staff";
import {
  lockReadBack,
  approveFact,
  type ProfileFact,
} from "../src/lib/profile/facts";
import type { Doc } from "./_generated/dataModel";

export function toFact(d: Doc<"profileFacts">): ProfileFact {
  return {
    id: d._id,
    text: d.text,
    provenance: d.provenance,
    quote: d.quote ?? null,
    checklistKey: d.checklistKey ?? null,
    lockedAt: d.lockedAt ?? null,
  };
}

export const facts = query({
  args: { guestId: v.id("guests") },
  handler: async (ctx, { guestId }) => {
    await requireGuestAccess(ctx, guestId);
    return ctx.db
      .query("profileFacts")
      .withIndex("by_guest", (q) => q.eq("guestId", guestId))
      .collect();
  },
});

export const suggestions = query({
  args: { guestId: v.id("guests") },
  handler: async (ctx, { guestId }) => {
    await requireGuestAccess(ctx, guestId);
    const rows = await ctx.db
      .query("suggestions")
      .withIndex("by_guest", (q) => q.eq("guestId", guestId))
      .collect();
    return rows.filter((r) => r.status === "open");
  },
});

/** The one-tap read-back lock. The FDE may reword the entry first. */
export const lock = mutation({
  args: { factId: v.id("profileFacts"), wording: v.optional(v.string()) },
  handler: async (ctx, { factId, wording }) => {
    const row = await ctx.db.get(factId);
    if (!row) throw new Error("Fact not found.");
    const { staff } = await requireGuestAccess(ctx, row.guestId);
    const now = Date.now();
    const result = lockReadBack(toFact(row), wording, now);
    if (!result.ok) throw new Error(result.reason);
    await ctx.db.patch(factId, {
      text: result.fact.text,
      provenance: result.fact.provenance,
      lockedAt: now,
      lockedBy: staff.email,
    });
  },
});

export const approve = mutation({
  args: { factId: v.id("profileFacts") },
  handler: async (ctx, { factId }) => {
    const row = await ctx.db.get(factId);
    if (!row) throw new Error("Fact not found.");
    const { staff } = await requireGuestAccess(ctx, row.guestId);
    const now = Date.now();
    const next = approveFact(toFact(row), now);
    await ctx.db.patch(factId, {
      provenance: next.provenance,
      lockedAt: now,
      lockedBy: staff.email,
    });
  },
});

/** The FDE writes their own entry, as a Genius writes a note into a customer's profile. */
export const addByFde = mutation({
  args: {
    guestId: v.id("guests"),
    text: v.string(),
    checklistKey: v.optional(checklistKey),
  },
  handler: async (ctx, { guestId, text, checklistKey }) => {
    const { staff } = await requireGuestAccess(ctx, guestId);
    const clean = text.trim();
    if (!clean) throw new Error("Write something first.");
    const now = Date.now();
    return ctx.db.insert("profileFacts", {
      guestId,
      text: clean,
      provenance: "fde-approved",
      checklistKey,
      createdAt: now,
      lockedAt: now,
      lockedBy: staff.email,
    });
  },
});

export const markAsked = mutation({
  args: { suggestionId: v.id("suggestions") },
  handler: async (ctx, { suggestionId }) => {
    const row = await ctx.db.get(suggestionId);
    if (!row) throw new Error("Suggestion not found.");
    await requireGuestAccess(ctx, row.guestId);
    await ctx.db.patch(suggestionId, { status: "asked" });
  },
});

export const dismiss = mutation({
  args: { suggestionId: v.id("suggestions") },
  handler: async (ctx, { suggestionId }) => {
    const row = await ctx.db.get(suggestionId);
    if (!row) throw new Error("Suggestion not found.");
    await requireGuestAccess(ctx, row.guestId);
    await ctx.db.patch(suggestionId, { status: "dismissed" });
  },
});
