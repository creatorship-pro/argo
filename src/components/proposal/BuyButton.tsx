"use client";

/** E1 placeholder. E2 replaces this with Stripe's embedded Checkout. */
export function BuyButton({ purchasable }: { purchasable: boolean }) {
  return (
    <button
      disabled
      className="rounded-xl bg-blue-600 px-8 py-4 text-xl font-semibold text-white disabled:bg-zinc-300 disabled:text-zinc-600"
    >
      {purchasable ? "Buy" : "Not open yet"}
    </button>
  );
}
