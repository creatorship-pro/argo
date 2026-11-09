import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { emailOTP } from "better-auth/plugins";
import { v } from "convex/values";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import { findStaff, parseAllowlist } from "../src/lib/access/staff";

export const authComponent = createClient<DataModel>(components.betterAuth);

// Staff sign in with a one-time code sent to their email (ticket E3 builds the
// real flow). The real email sender comes later from Mezie. Until
// EMAIL_API_KEY is set, the code is logged to the Convex dev log instead of
// being emailed. Once a key is set but no sender is wired, sending fails
// loudly rather than silently logging a code in production.
async function sendSignInCode(email: string, otp: string) {
  // Codes go only to allowlisted staff. Anyone else gets the same quiet
  // response, so the form does not reveal who is on the list.
  if (!findStaff(parseAllowlist(process.env.STAFF_ALLOWLIST), email)) return;
  if (process.env.EMAIL_API_KEY) {
    throw new Error("Email sender is not implemented yet (ticket E3).");
  }
  console.log(`[dev only] sign-in code for ${email}: ${otp}`);
}

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: process.env.SITE_URL,
    database: authComponent.adapter(ctx),
    plugins: [
      emailOTP({
        async sendVerificationOTP({ email, otp, type }) {
          if (type === "sign-in") await sendSignInCode(email, otp);
        },
      }),
      // Required for Convex compatibility.
      convex({ authConfig }),
    ],
  });

export const getCurrentUser = query({
  args: {},
  // The component returns its own user document type; E3 can tighten this.
  returns: v.any(),
  handler: async (ctx) => authComponent.getAuthUser(ctx),
});
