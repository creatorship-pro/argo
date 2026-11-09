"use client";

import { useCallback, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";

// Called once, outside render, as Stripe asks.
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

/**
 * Opens Stripe's embedded Checkout inside the page, so the owner pays without
 * leaving the app. Confirming a direction is not a purchase: only this button is.
 */
export function BuyButton({
  token,
  purchasable,
}: {
  token: string;
  purchasable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = (await res.json()) as {
      clientSecret?: string;
      error?: string;
    };
    if (!res.ok || !data.clientSecret) {
      setError(data.error ?? "Payments are not available right now.");
      throw new Error("checkout");
    }
    return data.clientSecret;
  }, [token]);

  if (!purchasable) {
    return (
      <button
        disabled
        className="rounded-xl bg-zinc-300 px-8 py-4 text-xl font-semibold text-zinc-600"
      >
        Not open yet
      </button>
    );
  }
  if (!stripePromise) {
    return (
      <button
        disabled
        className="rounded-xl bg-zinc-300 px-8 py-4 text-xl font-semibold text-zinc-600"
      >
        Payments not set up
      </button>
    );
  }
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl bg-blue-600 px-8 py-4 text-xl font-semibold text-white active:bg-blue-700"
      >
        Buy
      </button>
      {open && (
        <div className="fixed inset-0 z-30 overflow-y-auto bg-white">
          <div className="mx-auto max-w-2xl p-4">
            <button
              onClick={() => setOpen(false)}
              className="mb-3 min-h-12 text-lg text-blue-700 underline"
            >
              ← Back to the proposal
            </button>
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-lg text-red-800"
              >
                {error}
              </p>
            )}
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{ fetchClientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        </div>
      )}
    </>
  );
}
