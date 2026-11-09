import { findStaff, parseAllowlist } from "./staff";

export type DeliveryResult = "sent" | "logged" | "skipped";

export interface DeliveryDeps {
  env: Record<string, string | undefined>;
  send: (msg: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }) => Promise<void>;
  log: (line: string) => void;
}

/**
 * Sends a staff sign-in code. Only allowlisted emails get one: anyone else
 * gets the same quiet outcome, so the form does not reveal who is on the list.
 * With no email key set (development) the code is logged instead, and with a
 * key but no sender address it fails loudly rather than silently logging a
 * code in production.
 */
export async function deliverSignInCode(
  email: string,
  otp: string,
  deps: DeliveryDeps,
): Promise<DeliveryResult> {
  if (!findStaff(parseAllowlist(deps.env.STAFF_ALLOWLIST), email))
    return "skipped";
  if (!deps.env.EMAIL_API_KEY) {
    deps.log(`[dev only] sign-in code for ${email}: ${otp}`);
    return "logged";
  }
  const from = deps.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is not set.");
  await deps.send({
    from,
    to: email,
    subject: "Your Argo sign-in code",
    text: `Your sign-in code is ${otp}. It expires in 5 minutes. If you did not ask for it, ignore this email.`,
  });
  return "sent";
}

/**
 * Sends through Resend's HTTP API. This is an ASSUMPTION about the provider
 * (the ticket says the sender comes from Mezie); swap this one function if a
 * different provider is chosen.
 */
export function resendSender(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): DeliveryDeps["send"] {
  return async (msg) => {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(msg),
    });
    if (!res.ok) throw new Error(`Email provider returned ${res.status}.`);
  };
}
