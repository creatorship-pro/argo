import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";
import {
  paidSessionFrom,
  verifyStripeSignature,
} from "../src/lib/stripe/webhook";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

/**
 * Stripe tells us a checkout was paid. The signature is checked against the
 * raw body first; anything that fails is refused. Point the Stripe webhook (or
 * `stripe listen --forward-to`) at <convex site url>/stripe/webhook.
 */
http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const payload = await req.text();
    const verified = await verifyStripeSignature({
      payload,
      header: req.headers.get("stripe-signature"),
      secret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
      nowSeconds: Math.floor(Date.now() / 1000),
    });
    if (!verified.ok) return new Response("Bad signature", { status: 400 });

    const paid = paidSessionFrom(verified.event);
    if (paid) {
      await ctx.runMutation(internal.purchases.markPaid, paid);
    } else if (verified.event.type === "checkout.session.expired") {
      const id = verified.event.data.object.id;
      if (typeof id === "string")
        await ctx.runMutation(internal.purchases.markExpired, {
          sessionId: id,
        });
    }
    // Always answer 200 to a verified event, so Stripe does not keep retrying events we ignore.
    return new Response("ok", { status: 200 });
  }),
});

export default http;
