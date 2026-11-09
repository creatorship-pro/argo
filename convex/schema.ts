import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  groupStatus,
  guestStatus,
  provenance,
  checklistKey,
} from "./lib/validators";

// Audio is never stored here. Only transcript text goes into Convex (see A3).
export default defineSchema({
  events: defineTable({
    name: v.string(),
    startsAt: v.optional(v.number()),
    /** Index into this event's segments, or -1 before the event starts. */
    currentOrder: v.number(),
    /** Server end time of the running segment. Clock ticks are never stored. */
    segmentEndsAt: v.optional(v.number()),
  }),

  segments: defineTable({
    eventId: v.id("events"),
    order: v.number(),
    name: v.string(),
    minutes: v.number(),
  }).index("by_event", ["eventId", "order"]),

  guests: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    business: v.string(),
    /** Lowercase email of the assigned FDE. */
    fdeEmail: v.string(),
    status: guestStatus,
    consentRecordedAt: v.optional(v.number()),
    /** The FDE's own words for the confirmed problem (facilitator summary). */
    createdAt: v.number(),
  })
    .index("by_event", ["eventId"])
    .index("by_event_fde", ["eventId", "fdeEmail"]),

  /** One status chip per FDE group, set by the FDE with a tap (A7). */
  groupStatus: defineTable({
    eventId: v.id("events"),
    fdeEmail: v.string(),
    status: groupStatus,
    updatedAt: v.number(),
  }).index("by_event_fde", ["eventId", "fdeEmail"]),

  consents: defineTable({
    guestId: v.id("guests"),
    recordedAt: v.number(),
    recordedBy: v.string(),
    /** Version of the words the FDE read out, so we know what was agreed to. */
    wording: v.string(),
  }).index("by_guest", ["guestId"]),

  turns: defineTable({
    guestId: v.id("guests"),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    startedBy: v.string(),
  }).index("by_guest", ["guestId"]),

  /** Transcript text only. Never log it. */
  transcripts: defineTable({
    guestId: v.id("guests"),
    turnId: v.id("turns"),
    index: v.number(),
    text: v.string(),
    createdAt: v.number(),
  })
    .index("by_guest", ["guestId"])
    .index("by_turn", ["turnId", "index"]),

  profileFacts: defineTable({
    guestId: v.id("guests"),
    text: v.string(),
    provenance,
    quote: v.optional(v.string()),
    checklistKey: v.optional(checklistKey),
    createdAt: v.number(),
    lockedAt: v.optional(v.number()),
    lockedBy: v.optional(v.string()),
  }).index("by_guest", ["guestId"]),

  suggestions: defineTable({
    guestId: v.id("guests"),
    text: v.string(),
    checklistKey: v.optional(checklistKey),
    status: v.union(
      v.literal("open"),
      v.literal("asked"),
      v.literal("dismissed"),
    ),
    createdAt: v.number(),
  }).index("by_guest", ["guestId"]),

  /** One run of the blueprint builder: three designs and a recommendation. */
  designSets: defineTable({
    guestId: v.id("guests"),
    createdAt: v.number(),
    /** The blueprint set, in the B2 format. */
    blueprint: v.any(),
    generatedBy: v.union(v.literal("model"), v.literal("stub")),
    fdeChoice: v.optional(v.string()),
    fdeChoiceReason: v.optional(v.string()),
    chosenBy: v.optional(v.string()),
    chosenAt: v.optional(v.number()),
  }).index("by_guest", ["guestId"]),

  /** A guest's private link. Only a hash of the token is stored. */
  proposalLinks: defineTable({
    guestId: v.id("guests"),
    designSetId: v.id("designSets"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
    createdBy: v.string(),
  })
    .index("by_hash", ["tokenHash"])
    .index("by_guest", ["guestId"]),

  purchases: defineTable({
    guestId: v.id("guests"),
    designSetId: v.id("designSets"),
    designId: v.string(),
    stripeSessionId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("expired"),
    ),
    amountTotal: v.optional(v.number()),
    currency: v.optional(v.string()),
    createdAt: v.number(),
    paidAt: v.optional(v.number()),
  })
    .index("by_session", ["stripeSessionId"])
    .index("by_guest", ["guestId"]),
});
