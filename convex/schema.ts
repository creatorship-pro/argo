import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Placeholder tables so the schema file exists and codegen has something to
// type. The real shapes arrive with the build tickets (guest record and the
// shared guest-status model, A1/A7/E3). Do not build on these as they stand.
export default defineSchema({
  events: defineTable({
    name: v.string(),
    startsAt: v.optional(v.number()),
  }),
  guests: defineTable({
    eventId: v.id("events"),
    name: v.string(),
  }).index("by_event", ["eventId"]),
});
