import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { DEFAULT_RUN_OF_SHOW } from "../src/lib/session/run";

/**
 * Sets up a rehearsal event with test guests. Run it once:
 *   npx convex run seed:rehearsal '{"fdeEmails":["fde1@example.com"]}'
 * Guests are fictional. The run of show is a placeholder until D3 is decided.
 */
export const rehearsal = internalMutation({
  args: {
    fdeEmails: v.array(v.string()),
    guestsPerFde: v.optional(v.number()),
  },
  handler: async (ctx, { fdeEmails, guestsPerFde }) => {
    const eventId = await ctx.db.insert("events", {
      name: "Build a Bot (rehearsal)",
      currentOrder: -1,
    });
    for (const [order, s] of DEFAULT_RUN_OF_SHOW.entries()) {
      await ctx.db.insert("segments", {
        eventId,
        order,
        name: s.name,
        minutes: s.minutes,
      });
    }
    const first = [
      "Dana",
      "Priya",
      "Marcus",
      "Lena",
      "Omar",
      "Jo",
      "Tess",
      "Raj",
    ];
    let n = 0;
    for (const email of fdeEmails) {
      for (let i = 0; i < (guestsPerFde ?? 5); i++) {
        const name = first[n % first.length];
        await ctx.db.insert("guests", {
          eventId,
          name: `${name} (test)`,
          business: `Test Business ${n + 1}`,
          fdeEmail: email.trim().toLowerCase(),
          status: "confirmed",
          createdAt: Date.now(),
        });
        n++;
      }
    }
    return { eventId, guests: n };
  },
});
