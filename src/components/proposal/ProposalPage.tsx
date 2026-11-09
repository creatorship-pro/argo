import type { ReactNode } from "react";
import type { ProposalView } from "@/lib/proposal/view";
import { formatMoney, priceSummary, type Offer } from "@/lib/proposal/offer";

export interface ProposalPageProps {
  guestName: string;
  business?: string;
  view: ProposalView;
  offer: Offer & { purchasable: boolean };
  /** Rendered in the sticky bottom bar: the Buy button, or a paid notice. */
  action: ReactNode;
  downloads?: { json: string; readme: string } | null;
  /** When delivery is due, computed on the server from the offer's delivery days. */
  readyBy: number;
  standIn?: boolean;
  /** Extra content shown only to the FDE (talking points, evidence). */
  fdeExtras?: ReactNode;
}

const Section = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <section className="mt-10">
    <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
    <div className="mt-3 text-lg leading-relaxed text-zinc-700">{children}</div>
  </section>
);

const List = ({ items }: { items: string[] }) => (
  <ul className="list-disc space-y-2 pl-6">
    {items.map((t, i) => (
      <li key={i}>{t}</li>
    ))}
  </ul>
);

/**
 * The owner's proposal page: a scrollable page, like configuring a laptop.
 * It is the same component on the owner's phone and on the FDE's iPad.
 */
export function ProposalPage({
  guestName,
  business,
  view,
  offer,
  action,
  downloads,
  readyBy,
  standIn,
  fdeExtras,
}: ProposalPageProps) {
  const price = priceSummary(offer);
  const due = new Date(readyBy);
  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-48 pt-8 text-zinc-900">
      {standIn && (
        <p
          role="note"
          className="mb-4 rounded-lg bg-amber-100 p-3 text-base text-amber-900"
        >
          Rehearsal stand-in: this proposal is not about your business.
        </p>
      )}
      <p className="text-base font-medium text-blue-700">
        {business ?? "Your proposal"}
      </p>
      <h1 className="mt-1 text-4xl font-bold leading-tight tracking-tight">
        {guestName}, here is your {view.name.toLowerCase()}
      </h1>
      <p className="mt-3 text-xl text-zinc-600">
        A design for an AI employee. Nothing has been built or switched on yet.
      </p>

      {fdeExtras}

      <Section title="The problem, in your words">
        {view.problemInTheirWords.length > 0 ? (
          <ul className="space-y-3">
            {view.problemInTheirWords.map((p, i) => (
              <li key={i} className="rounded-xl bg-zinc-100 p-4">
                {p.quote ? <q className="block italic">{p.quote}</q> : null}
                <span
                  className={
                    p.quote ? "mt-1 block text-base text-zinc-600" : ""
                  }
                >
                  {p.text}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>{view.problemSummary}</p>
        )}
      </Section>

      <Section title="What it does on its own">
        <List items={view.alone} />
      </Section>
      <Section title="What it brings to you first">
        <List items={view.needsApproval} />
      </Section>
      <Section title="What it will never do">
        <List items={view.never} />
      </Section>

      <Section title="How it works, step by step">
        <ol className="list-decimal space-y-3 pl-6">
          {view.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </Section>

      <Section title="What it might save you">
        <p className="text-3xl font-bold text-zinc-900">
          {view.outcome.estimate}
        </p>
        <p className="mt-1">{view.outcome.metric}</p>
        <p className="mt-3 font-medium">This assumes:</p>
        <List items={view.outcome.assumptions} />
        <p className="mt-3 text-base text-zinc-600">{view.outcome.note}</p>
      </Section>

      <Section title="What we would need from you">
        <List
          items={view.needsFromYou.map((n) => `${n.system}: ${n.permission}`)}
        />
      </Section>

      {view.others.length > 0 && (
        <Section title="Other options we considered">
          <ul className="space-y-3">
            {view.others.map((o) => (
              <li key={o.id}>
                <span className="font-semibold">{o.name}.</span> {o.summary}
                {o.blocked
                  ? " It needs connections we do not support yet."
                  : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Yours to keep, free">
        <p>
          The design as a file you can hand to Claude, to pi or to us as the
          plan for building it, with a plain-words README. It does not switch
          anything on, and it holds no passwords.
        </p>
        {downloads ? (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <a
              href={downloads.json}
              download
              className="rounded-xl bg-zinc-900 px-5 py-4 text-center text-lg font-semibold text-white"
            >
              Download the design (JSON)
            </a>
            <a
              href={downloads.readme}
              download
              className="rounded-xl bg-zinc-200 px-5 py-4 text-center text-lg font-semibold"
            >
              Download the README
            </a>
          </div>
        ) : null}
      </Section>

      <Section title="Price and terms">
        {offer.placeholder && (
          <p className="mb-3 rounded-lg bg-amber-100 p-3 text-base text-amber-900">
            Placeholder prices and terms. The real ones are not set yet.
          </p>
        )}
        <dl className="space-y-4">
          <div>
            <dt className="font-semibold">{offer.implementation.name}</dt>
            <dd>{offer.implementation.description}</dd>
          </div>
          {offer.monitoring && (
            <div>
              <dt className="font-semibold">
                {offer.monitoring.name} (optional)
              </dt>
              <dd>{offer.monitoring.description}</dd>
            </div>
          )}
          {offer.conciergeBonus && (
            <div>
              <dt className="font-semibold">{offer.conciergeBonus.name}</dt>
              <dd>{offer.conciergeBonus.description}</dd>
            </div>
          )}
          <div>
            <dt className="font-semibold">Payment</dt>
            <dd>{offer.terms.paymentTiming}</dd>
          </div>
          <div>
            <dt className="font-semibold">Delivery</dt>
            <dd>{offer.terms.deliveryTimeline}</dd>
          </div>
          <div>
            <dt className="font-semibold">Support</dt>
            <dd>{offer.terms.supportCoverage}</dd>
          </div>
          <div>
            <dt className="font-semibold">Cancellation</dt>
            <dd>{offer.terms.cancellation}</dd>
          </div>
        </dl>
      </Section>

      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div>
            <p className="text-xl font-bold sm:text-2xl">
              {price.oneTime > 0
                ? formatMoney(price.oneTime, offer.currency)
                : "Price to be set"}
            </p>
            <p className="text-sm text-zinc-600">
              {price.recurring > 0 && offer.monitoring
                ? `+ ${formatMoney(price.recurring, offer.currency)}/${offer.monitoring.interval} · `
                : ""}
              Ready by{" "}
              {due.toLocaleDateString("en-CA", {
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          {action}
        </div>
      </div>
    </div>
  );
}
