import { query } from "./_generated/server";
import { getStaff } from "./lib/staff";

/** Who am I? `null` means signed out or not on the staff allowlist. */
export const me = query({
  args: {},
  handler: async (ctx) => getStaff(ctx),
});
