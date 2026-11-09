import offerJson from "../../../content/offer.json";

export interface Offer {
  placeholder: boolean;
  currency: string;
  implementation: { name: string; amountCents: number; description: string };
  monitoring: {
    name: string;
    amountCents: number;
    interval: "month" | "year";
    description: string;
  } | null;
  deliveryDays: number;
  terms: {
    paymentTiming: string;
    deliveryTimeline: string;
    supportCoverage: string;
    cancellation: string;
  };
  conciergeBonus: { name: string; description: string } | null;
}

export const OFFER = offerJson as unknown as Offer;

export const formatMoney = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);

export function deliveryDate(from: number, days: number): Date {
  return new Date(from + days * 24 * 60 * 60 * 1000);
}

/** What the Buy button shows: the one-time total and any monthly charge. */
export function priceSummary(o: Offer) {
  return {
    oneTime: o.implementation.amountCents,
    recurring:
      o.monitoring && o.monitoring.amountCents > 0
        ? o.monitoring.amountCents
        : 0,
  };
}

/** A zero price means the offer has not been filled in yet (D4/E4/E5). */
export const isPurchasable = (o: Offer) =>
  !o.placeholder && o.implementation.amountCents > 0;
