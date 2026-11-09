import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/lib/convex";
import {
  assertTestKey,
  buildSessionParams,
  createCheckoutSession,
} from "@/lib/stripe/checkout";

/**
 * Called when the owner taps Buy. The token proves which proposal this is; the
 * amounts come from our own offer file. Stripe test mode only.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    token?: unknown;
  } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const ctx = await fetchQuery(api.purchases.checkoutContext, { token }).catch(
    () => null,
  );
  if (!ctx)
    return Response.json({ error: "This link is not valid." }, { status: 404 });
  if (ctx.alreadyPaid)
    return Response.json(
      { error: "This proposal is already paid." },
      { status: 409 },
    );
  if (!ctx.purchasable)
    return Response.json({ error: "Prices are not set yet." }, { status: 409 });

  try {
    const secret = process.env.STRIPE_SECRET_KEY ?? "";
    assertTestKey(secret, process.env.STRIPE_ALLOW_LIVE === "1");
    const origin = process.env.SITE_URL ?? new URL(req.url).origin;
    const session = await createCheckoutSession(
      secret,
      buildSessionParams({
        offer: ctx.offer,
        designName: ctx.designName,
        designSetId: ctx.designSetId,
        guestId: ctx.guestId,
        designId: ctx.designId,
        returnUrl: `${origin}/p/${token}?checkout=return&session_id={CHECKOUT_SESSION_ID}`,
        tax: process.env.STRIPE_TAX === "1",
        requireTerms: process.env.STRIPE_REQUIRE_TERMS !== "0",
      }),
    );
    await fetchMutation(api.purchases.recordPending, {
      token,
      sessionId: session.id,
    });
    return Response.json({ clientSecret: session.clientSecret });
  } catch (e) {
    // No card data or keys in logs: only the kind of failure.
    console.error("checkout failed:", e instanceof Error ? e.name : "unknown");
    return Response.json(
      { error: "Payments are not available right now." },
      { status: 502 },
    );
  }
}
