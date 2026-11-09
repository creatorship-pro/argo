/**
 * Verifies a Stripe webhook the way Stripe documents it: the header holds a
 * timestamp and one or more v1 signatures, each an HMAC-SHA256 (keyed with the
 * endpoint secret) of "{timestamp}.{raw body}". Uses Web Crypto so it runs in
 * Convex, Node and browsers.
 */
export const TOLERANCE_SECONDS = 300;

export type Verified =
  { ok: true; event: StripeEvent } | { ok: false; reason: string };

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)),
  );
}

/** Compares without stopping at the first difference. */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyStripeSignature(opts: {
  payload: string;
  header: string | null;
  secret: string;
  nowSeconds: number;
  toleranceSeconds?: number;
}): Promise<Verified> {
  if (!opts.secret) return { ok: false, reason: "no secret" };
  if (!opts.header) return { ok: false, reason: "no signature" };
  const parts = opts.header.split(",").map((p) => p.trim().split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  const ts = Number(t);
  if (!t || !Number.isFinite(ts) || sigs.length === 0)
    return { ok: false, reason: "malformed header" };
  if (
    Math.abs(opts.nowSeconds - ts) >
    (opts.toleranceSeconds ?? TOLERANCE_SECONDS)
  )
    return { ok: false, reason: "timestamp outside tolerance" };
  const expected = await hmacHex(opts.secret, `${t}.${opts.payload}`);
  if (!sigs.some((s) => sameSecret(s, expected)))
    return { ok: false, reason: "signature mismatch" };
  try {
    return { ok: true, event: JSON.parse(opts.payload) as StripeEvent };
  } catch {
    return { ok: false, reason: "bad json" };
  }
}

/** Test helper and local tool: builds a valid header for a payload. */
export async function signStripePayload(
  payload: string,
  secret: string,
  tSeconds: number,
): Promise<string> {
  return `t=${tSeconds},v1=${await hmacHex(secret, `${tSeconds}.${payload}`)}`;
}

export interface PaidSession {
  sessionId: string;
  amountTotal: number | null;
  currency: string | null;
}

/** Returns the session only for events that mean "this checkout is paid". */
export function paidSessionFrom(event: StripeEvent): PaidSession | null {
  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  )
    return null;
  const o = event.data.object;
  // A completed session can still be unpaid (a delayed payment method); wait for the later event.
  if (o.payment_status !== "paid" && o.payment_status !== "no_payment_required")
    return null;
  if (typeof o.id !== "string") return null;
  return {
    sessionId: o.id,
    amountTotal: typeof o.amount_total === "number" ? o.amount_total : null,
    currency: typeof o.currency === "string" ? o.currency : null,
  };
}
