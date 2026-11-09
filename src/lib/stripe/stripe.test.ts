import { describe, expect, it } from "vitest";
import { OFFER, type Offer } from "../proposal/offer";
import {
  assertTestKey,
  buildSessionParams,
  createCheckoutSession,
  encodeForm,
  StripeError,
  toBody,
} from "./checkout";
import {
  paidSessionFrom,
  signStripePayload,
  verifyStripeSignature,
} from "./webhook";

const offer: Offer = {
  ...OFFER,
  placeholder: false,
  implementation: {
    name: "Build",
    amountCents: 150000,
    description: "one-time",
  },
  monitoring: {
    name: "Monitor",
    amountCents: 20000,
    interval: "month",
    description: "monthly",
  },
};
const base = {
  offer,
  designName: "Coordinator",
  designSetId: "ds1",
  guestId: "g1",
  designId: "d2",
  returnUrl: "https://x/p/t?session_id={CHECKOUT_SESSION_ID}",
};

describe("form encoding", () => {
  it("nests objects and arrays the way Stripe expects", () => {
    expect(
      decodeURIComponent(toBody({ a: { b: 1 }, c: [{ d: "x" }, { d: "y" }] })),
    ).toBe("a[b]=1&c[0][d]=x&c[1][d]=y");
    expect(encodeForm({ skip: undefined, no: null })).toEqual([]);
  });
});

describe("checkout session", () => {
  it("is embedded, with ad hoc prices built on the server", () => {
    const p = buildSessionParams({
      ...base,
      offer: { ...offer, monitoring: null },
    });
    expect(p.ui_mode).toBe("embedded_page");
    expect(p.mode).toBe("payment");
    expect(p.line_items).toHaveLength(1);
    expect(p.line_items[0]).toMatchObject({
      price_data: { currency: "cad", unit_amount: 150000 },
    });
    expect(p.return_url).toContain("{CHECKOUT_SESSION_ID}");
  });
  it("mixes a one-time fee and a monthly service in one subscription cart", () => {
    const p = buildSessionParams(base);
    expect(p.mode).toBe("subscription");
    expect(p.line_items).toHaveLength(2);
    expect(p.line_items[1]).toMatchObject({
      price_data: { unit_amount: 20000, recurring: { interval: "month" } },
    });
  });
  it("can require the terms checkbox and turn on tax", () => {
    const p = buildSessionParams({ ...base, requireTerms: true, tax: true });
    expect(p.consent_collection).toEqual({ terms_of_service: "required" });
    expect(p.automatic_tax).toEqual({ enabled: true });
    expect(buildSessionParams(base).consent_collection).toBeUndefined();
  });
  it("tags the session so a payment can be matched to a guest and design", () => {
    expect(buildSessionParams(base).metadata).toEqual({
      designSetId: "ds1",
      designId: "d2",
      guestId: "g1",
    });
  });
  it("refuses a live key unless live mode is on", () => {
    expect(() => assertTestKey("sk_live_abc", false)).toThrow(/test mode/);
    expect(() => assertTestKey("sk_live_abc", true)).not.toThrow();
    expect(() => assertTestKey("sk_test_abc", false)).not.toThrow();
    expect(() => assertTestKey("", false)).toThrow(/not set/);
  });
  it("posts with the secret key and returns the client secret", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const f = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return Response.json({ id: "cs_1", client_secret: "cs_1_secret" });
    }) as unknown as typeof fetch;
    expect(
      await createCheckoutSession("sk_test_1", buildSessionParams(base), f),
    ).toEqual({ id: "cs_1", clientSecret: "cs_1_secret" });
    expect(seen?.url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect((seen?.init.headers as Record<string, string>).authorization).toBe(
      "Bearer sk_test_1",
    );
  });
  it("reports a Stripe failure without leaking the body", async () => {
    await expect(
      createCheckoutSession(
        "k",
        {},
        (async () =>
          new Response("secret detail", { status: 400 })) as typeof fetch,
      ),
    ).rejects.toThrow(StripeError);
  });
});

describe("webhook signature", () => {
  const secret = "whsec_test";
  const payload = JSON.stringify({
    id: "evt_1",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_1",
        payment_status: "paid",
        amount_total: 170000,
        currency: "cad",
      },
    },
  });
  const now = 1_800_000_000;
  it("accepts a correctly signed payload", async () => {
    const header = await signStripePayload(payload, secret, now);
    const r = await verifyStripeSignature({
      payload,
      header,
      secret,
      nowSeconds: now,
    });
    expect(r.ok && r.event.id).toBe("evt_1");
  });
  it("rejects a wrong secret, a changed body and a missing header", async () => {
    const header = await signStripePayload(payload, secret, now);
    expect(
      (
        await verifyStripeSignature({
          payload,
          header,
          secret: "whsec_other",
          nowSeconds: now,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await verifyStripeSignature({
          payload: payload + " ",
          header,
          secret,
          nowSeconds: now,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await verifyStripeSignature({
          payload,
          header: null,
          secret,
          nowSeconds: now,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await verifyStripeSignature({
          payload,
          header: "garbage",
          secret,
          nowSeconds: now,
        })
      ).ok,
    ).toBe(false);
  });
  it("rejects an old timestamp (replay)", async () => {
    const header = await signStripePayload(payload, secret, now - 3600);
    expect(
      await verifyStripeSignature({ payload, header, secret, nowSeconds: now }),
    ).toEqual({ ok: false, reason: "timestamp outside tolerance" });
  });
  it("accepts any one valid v1 while a secret is being rolled, and ignores v0", async () => {
    const good = (await signStripePayload(payload, secret, now)).split(
      ",v1=",
    )[1];
    const header = `t=${now},v0=ffff,v1=bad,v1=${good}`;
    expect(
      (
        await verifyStripeSignature({
          payload,
          header,
          secret,
          nowSeconds: now,
        })
      ).ok,
    ).toBe(true);
  });
  it("marks a purchase paid only for paid sessions", () => {
    const ev = (
      o: Record<string, unknown>,
      type = "checkout.session.completed",
    ) => ({ id: "e", type, data: { object: o } });
    expect(
      paidSessionFrom(
        ev({
          id: "cs_1",
          payment_status: "paid",
          amount_total: 5,
          currency: "cad",
        }),
      ),
    ).toEqual({ sessionId: "cs_1", amountTotal: 5, currency: "cad" });
    expect(
      paidSessionFrom(ev({ id: "cs_1", payment_status: "unpaid" })),
    ).toBeNull();
    expect(
      paidSessionFrom(
        ev({ id: "cs_1", payment_status: "paid" }, "checkout.session.expired"),
      ),
    ).toBeNull();
    expect(
      paidSessionFrom(
        ev(
          { id: "cs_1", payment_status: "paid" },
          "checkout.session.async_payment_succeeded",
        ),
      )?.sessionId,
    ).toBe("cs_1");
  });
});
