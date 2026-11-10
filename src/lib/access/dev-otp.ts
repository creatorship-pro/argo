import { findStaff, parseAllowlist } from "./staff";

/**
 * Rehearsal only. When DEV_FIXED_OTP is set on a deployment, allowlisted staff
 * get that one code instead of a random one, so nobody has to dig a code out of
 * the Convex log to sign in. Everyone else still gets a random code, and the
 * code is only ever the fixed value for a sign-in request.
 *
 * Never set DEV_FIXED_OTP on the event deployment: anyone who knows the code
 * and an allowlisted email can sign in as that person.
 */
export function devFixedOtp(
  data: { email: string; type: string },
  env: Record<string, string | undefined>,
): string | undefined {
  const fixed = env.DEV_FIXED_OTP?.trim();
  if (!fixed || !/^\d{6}$/.test(fixed)) return undefined;
  if (data.type !== "sign-in") return undefined;
  if (!findStaff(parseAllowlist(env.STAFF_ALLOWLIST), data.email))
    return undefined;
  return fixed;
}
