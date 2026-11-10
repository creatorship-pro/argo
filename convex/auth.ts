import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { emailOTP } from "better-auth/plugins";
import { v } from "convex/values";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import {
  deliverSignInCode,
  resendSender,
} from "../src/lib/access/sign-in-code";

export const authComponent = createClient<DataModel>(components.betterAuth);

// Staff sign in with a one-time code sent to their email, only if they are on
// the STAFF_ALLOWLIST (ticket E3). See src/lib/access/sign-in-code.ts.
async function sendSignInCode(email: string, otp: string) {
  await deliverSignInCode(email, otp, {
    env: process.env,
    send: resendSender(process.env.EMAIL_API_KEY ?? ""),
    log: console.log,
  });
}

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: process.env.SITE_URL,
    // Staff open the app by hostname and by IP, so every address the event uses
    // has to be trusted or sign-in fails with an invalid-origin error (and the
    // page just looks hung). Set TRUSTED_ORIGINS as comma separated origins,
    // for example http://100.64.0.2:3100,http://ipad-host:3100 .
    trustedOrigins: (process.env.TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
    database: authComponent.adapter(ctx),
    // Long sessions, so an FDE stays signed in on the iPad all evening.
    session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
    plugins: [
      emailOTP({
        // Better Auth's own defaults, stated so they are not a surprise:
        // six digits, five minutes, three tries. Codes, not links, because
        // email security scanners can use up a one-time link.
        otpLength: 6,
        // Five minutes by default. In rehearsal the code is read out of the
        // Convex log by hand, which can take longer, so it can be raised with
        // OTP_EXPIRES_SECONDS (capped at an hour). Leave it unset for the event.
        expiresIn: Math.min(
          Math.max(Number(process.env.OTP_EXPIRES_SECONDS) || 300, 60),
          3600,
        ),
        allowedAttempts: 3,
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
