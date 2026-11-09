import type { Offer } from "../proposal/offer";

/**
 * Stripe Checkout, without Stripe's SDK: the REST API takes form-encoded
 * parameters, so a small encoder and fetch are enough. Test mode only until
 * Mezie says otherwise (AGENTS.md).
 */
export function encodeForm(
  value: unknown,
  prefix = "",
  out: [string, string][] = [],
): [string, string][] {
  if (value === undefined || value === null) return out;
  if (Array.isArray(value)) {
    value.forEach((v, i) => encodeForm(v, `${prefix}[${i}]`, out));
  } else if (typeof value === "object") {
    for (const [k, v] of Object.entries(value))
      encodeForm(v, prefix ? `${prefix}[${k}]` : k, out);
  } else {
    out.push([prefix, String(value)]);
  }
  return out;
}

export const toBody = (params: unknown) =>
  new URLSearchParams(encodeForm(params)).toString();

export interface SessionOptions {
  offer: Offer;
  designName: string;
  designSetId: string;
  guestId: string;
  designId: string;
  returnUrl: string;
  /** Stripe Tax needs the account's tax settings, so it is opt-in. */
  tax?: boolean;
  /** Needs a terms URL set in the Stripe Dashboard. */
  requireTerms?: boolean;
}

/**
 * Prices are ad hoc (`price_data`), built on the server from our own offer
 * file: nothing the browser sends can change an amount. A one-time fee alone
 * is `payment` mode; adding the monthly service makes it a `subscription`,
 * which Checkout allows to mix one-time and recurring items.
 */
export function buildSessionParams(o: SessionOptions) {
  const currency = o.offer.currency;
  const lineItems: unknown[] = [
    {
      quantity: 1,
      price_data: {
        currency,
        unit_amount: o.offer.implementation.amountCents,
        product_data: {
          name: `${o.offer.implementation.name}: ${o.designName}`,
          description: o.offer.implementation.description,
        },
        ...(o.tax ? { tax_behavior: "exclusive" } : {}),
      },
    },
  ];
  const recurring =
    o.offer.monitoring && o.offer.monitoring.amountCents > 0
      ? o.offer.monitoring
      : null;
  if (recurring) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency,
        unit_amount: recurring.amountCents,
        recurring: { interval: recurring.interval },
        product_data: {
          name: recurring.name,
          description: recurring.description,
        },
        ...(o.tax ? { tax_behavior: "exclusive" } : {}),
      },
    });
  }
  return {
    ui_mode: "embedded_page",
    mode: recurring ? "subscription" : "payment",
    line_items: lineItems,
    return_url: o.returnUrl,
    client_reference_id: o.guestId,
    metadata: {
      designSetId: o.designSetId,
      designId: o.designId,
      guestId: o.guestId,
    },
    ...(o.requireTerms
      ? { consent_collection: { terms_of_service: "required" } }
      : {}),
    ...(o.tax ? { automatic_tax: { enabled: true } } : {}),
  };
}

export class StripeError extends Error {
  constructor(public status: number) {
    super(`Stripe returned ${status}.`);
    this.name = "StripeError";
  }
}

/** Refuses a live key unless live mode was switched on on purpose. */
export function assertTestKey(secretKey: string, allowLive: boolean) {
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not set.");
  if (secretKey.startsWith("sk_live_") && !allowLive) {
    throw new Error(
      "A live Stripe key is set, but this app is in test mode until Mezie says otherwise.",
    );
  }
}

export async function createCheckoutSession(
  secretKey: string,
  params: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<{ id: string; clientSecret: string }> {
  const res = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: toBody(params),
  });
  if (!res.ok) throw new StripeError(res.status);
  const body = (await res.json()) as { id?: string; client_secret?: string };
  if (!body.id || !body.client_secret)
    throw new Error("Stripe reply had no session.");
  return { id: body.id, clientSecret: body.client_secret };
}
