"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * After Stripe returns the owner here, the webhook may take a moment to mark the
 * purchase paid. Check a few times, then stop.
 */
export function PaymentStatus({
  returning,
  paid,
}: {
  returning: boolean;
  paid: boolean;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!returning || paid) return;
    let n = 0;
    const id = setInterval(() => {
      router.refresh();
      if (++n >= 10) clearInterval(id);
    }, 3000);
    return () => clearInterval(id);
  }, [returning, paid, router]);
  if (!returning) return null;
  return (
    <p
      role="status"
      className="mx-auto mt-4 max-w-2xl rounded-xl bg-emerald-50 p-4 text-lg text-emerald-900"
    >
      {paid
        ? "Payment received. Thank you. We will be in touch about the next step."
        : "Confirming your payment… this can take a few seconds."}
    </p>
  );
}
