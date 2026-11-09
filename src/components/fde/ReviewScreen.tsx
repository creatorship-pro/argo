"use client";

import Link from "next/link";
import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api, type Id } from "@/lib/convex";
import { designBrief, evidenceFor } from "@/lib/blueprint/review";
import type { BlueprintSet } from "@/lib/blueprint/types";
import { ProvenanceTag } from "./ProvenanceTag";

export function ReviewScreen({ guestId }: { guestId: Id<"guests"> }) {
  const guest = useQuery(api.guests.get, { guestId });
  const row = useQuery(api.designs.forGuest, { guestId });
  const generate = useAction(api.designsNode.generate);
  const choose = useMutation(api.designs.choose);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!guest || row === undefined)
    return <p className="p-10 text-2xl">Loading…</p>;

  async function build() {
    setBusy(true);
    setError(null);
    try {
      const r = await generate({ guestId });
      if (!r.ok) setError(r.error);
    } catch {
      setError(
        "Could not build the designs. Try again, or carry on with the intake notes.",
      );
    } finally {
      setBusy(false);
    }
  }

  const set = row?.blueprint as BlueprintSet | undefined;

  return (
    <div className="flex flex-1 flex-col p-8">
      <Link href={`/fde/guest/${guestId}`} className="text-lg text-blue-700">
        ← Back to {guest.name}
      </Link>
      <h1 className="mt-1 text-4xl font-bold">Break review: {guest.name}</h1>

      {!set || !row ? (
        <div className="mt-8 rounded-2xl bg-white p-8 ring-1 ring-zinc-200">
          <p className="text-2xl">The three designs are not built yet.</p>
          <button
            disabled={busy}
            onClick={() => void build()}
            className="mt-5 min-h-16 rounded-xl bg-blue-700 px-8 text-2xl font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Building… about a minute" : "Build the three designs"}
          </button>
          {error && (
            <p role="alert" className="mt-4 text-xl text-red-700">
              {error}
            </p>
          )}
        </div>
      ) : (
        <>
          <ReviewBoard
            set={set}
            chosen={row.fdeChoice ?? null}
            onChoose={(designId, reason) =>
              void choose({ designSetId: row._id, designId, reason })
            }
          />
          {row.fdeChoice && (
            <Link
              href={`/fde/guest/${guestId}/present`}
              className="mt-6 flex min-h-16 items-center justify-center rounded-2xl bg-blue-700 text-2xl font-semibold text-white"
            >
              Open the proposal and QR code →
            </Link>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The three designs side by side with the system's recommendation and an
 * evidence panel, built to be read in two to three minutes per guest. It takes
 * plain props so it can be shown and tested without a database.
 */
export function ReviewBoard({
  set,
  chosen,
  onChoose,
}: {
  set: BlueprintSet;
  chosen: string | null;
  onChoose: (designId: string, reason: string) => void;
}) {
  const [viewing, setViewing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const focus =
    set.designs.find(
      (d) => d.id === (viewing ?? chosen ?? set.recommendation.designId),
    ) ?? null;

  return (
    <>
      {set.note && (
        <p
          role="note"
          className="mt-3 rounded-lg bg-amber-100 p-3 text-lg text-amber-900"
        >
          {set.note}
        </p>
      )}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {set.designs.map((d) => {
          const b = designBrief(set, d);
          const isChosen = chosen === d.id;
          return (
            <article
              key={d.id}
              className={`flex flex-col rounded-2xl bg-white p-6 ring-2 ${isChosen ? "ring-emerald-600" : b.recommended ? "ring-blue-600" : "ring-zinc-200"}`}
            >
              <div className="flex flex-wrap gap-2">
                {b.recommended && (
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-base font-semibold text-blue-900">
                    System recommends
                  </span>
                )}
                {isChosen && (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-base font-semibold text-emerald-900">
                    Your choice
                  </span>
                )}
                {!b.feasible && (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-base font-semibold text-red-900">
                    Blocked
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-3xl font-bold">{b.name}</h2>
              <p className="text-lg text-zinc-600">{b.level}</p>
              <p className="mt-3 text-xl">{b.scope}</p>
              <h3 className="mt-4 text-lg font-semibold">On its own</h3>
              <ul className="list-disc pl-6 text-lg">
                {b.alone.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <h3 className="mt-3 text-lg font-semibold">Needs a person</h3>
              <ul className="list-disc pl-6 text-lg">
                {b.approval.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <p className="mt-4 text-2xl font-bold">{b.estimate}</p>
              {!b.feasible && (
                <p className="mt-2 text-lg text-red-800">
                  Needs connections we have not vetted: {b.missing.join(", ")}.
                </p>
              )}
              <div className="mt-auto flex flex-col gap-2 pt-5">
                <button
                  onClick={() => setViewing(d.id)}
                  className="min-h-14 rounded-xl bg-zinc-200 text-xl font-semibold"
                >
                  Show evidence
                </button>
                <button
                  disabled={!b.feasible || isChosen}
                  onClick={() => onChoose(d.id, reason)}
                  className="min-h-14 rounded-xl bg-emerald-600 text-xl font-semibold text-white disabled:bg-zinc-300 disabled:text-zinc-500"
                >
                  {isChosen ? "Chosen" : "Choose this one"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <label className="mt-4 block text-xl">
        Why this one (optional)
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 p-3 text-xl"
        />
      </label>

      {focus && (
        <section className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-zinc-200">
          <h2 className="text-2xl font-semibold">
            Evidence for “{focus.name}”
          </h2>
          <ul className="mt-3 grid gap-3 lg:grid-cols-2">
            {evidenceFor(set, focus).map((e) => (
              <li key={e.id} className="rounded-xl bg-zinc-50 p-4">
                <ProvenanceTag p={e.provenance} />
                <p className="mt-2 text-xl">{e.fact}</p>
                {e.quote && (
                  <p className="mt-1 text-lg italic text-zinc-600">
                    “{e.quote}”
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-lg text-zinc-600">
            {set.valueAssessment.confidence}
          </p>
          {set.recommendation.designId === focus.id && (
            <ul className="mt-3 list-disc pl-6 text-lg">
              {set.recommendation.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
