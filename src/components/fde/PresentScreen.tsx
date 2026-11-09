"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import QRCode from "qrcode";
import { api, type Id } from "@/lib/convex";
import { ProposalPage } from "@/components/proposal/ProposalPage";
import { talkingPoints } from "@/lib/proposal/view";
import { evidenceFor } from "@/lib/blueprint/review";
import { ProvenanceTag } from "./SessionScreen";

/**
 * Full-screen proposal for the FDE to walk the owner through, with the QR code
 * that opens the same page on the owner's phone. The link's token exists only
 * in this browser tab, because the server keeps just its hash.
 */
export function PresentScreen({ guestId }: { guestId: Id<"guests"> }) {
  const data = useQuery(api.proposals.forFde, { guestId });
  const links = useQuery(api.proposals.linksForGuest, { guestId });
  const create = useMutation(api.proposals.createLink);
  const revoke = useMutation(api.proposals.revoke);
  const [qr, setQr] = useState<{ svg: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  async function open() {
    setError(null);
    try {
      const { token } = await create({ guestId });
      const url = `${window.location.origin}/p/${token}`;
      const svg = await QRCode.toString(url, {
        type: "svg",
        margin: 1,
        width: 480,
      });
      setQr({ svg, url });
      setShowQr(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not make the link.");
    }
  }

  if (data === undefined) return <p className="p-10 text-2xl">Loading…</p>;
  if (data === null || !data.view)
    return (
      <p className="p-10 text-2xl">
        Choose a design first.{" "}
        <Link
          className="text-blue-700 underline"
          href={`/fde/guest/${guestId}/review`}
        >
          Go to the review
        </Link>
      </p>
    );

  const chosen = data.set.designs.find((d) => d.id === data.chosen);
  const live = links?.find((l) => l.state === "ok");

  return (
    <div className="flex-1 bg-white">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-6 py-3">
        <Link href={`/fde/guest/${guestId}`} className="text-xl text-blue-700">
          ← Back
        </Link>
        <div className="flex gap-3">
          <button
            onClick={() => void open()}
            className="min-h-14 rounded-xl bg-blue-700 px-6 text-xl font-semibold text-white"
          >
            {qr ? "New QR code" : "Show QR code"}
          </button>
          {live && (
            <button
              onClick={() => void revoke({ guestId }).then(() => setQr(null))}
              className="min-h-14 rounded-xl bg-red-100 px-6 text-xl font-semibold text-red-900"
            >
              Turn the link off
            </button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="p-4 text-xl text-red-700">
          {error}
        </p>
      )}
      {showQr && qr && (
        <div
          className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/80 p-8"
          onClick={() => setShowQr(false)}
        >
          <div
            className="rounded-3xl bg-white p-6"
            dangerouslySetInnerHTML={{ __html: qr.svg }}
          />
          <p className="text-2xl text-white">
            Ask the owner to scan this with their phone camera.
          </p>
          <button className="min-h-14 rounded-xl bg-white px-8 text-xl font-semibold">
            Close
          </button>
        </div>
      )}
      <ProposalPage
        guestName={data.guestName}
        business={data.business}
        view={data.view}
        offer={data.offer}
        readyBy={data.readyBy}
        standIn={data.set.note?.startsWith("STAND-IN")}
        action={
          <span className="rounded-xl bg-zinc-200 px-5 py-4 text-lg font-semibold text-zinc-600">
            Owner buys on their phone
          </span>
        }
        fdeExtras={
          <aside className="mt-8 rounded-2xl bg-zinc-900 p-6 text-white">
            <h2 className="text-2xl font-bold">
              For you, the FDE (the guest does not see this)
            </h2>
            <p className="mt-1 text-lg text-zinc-300">
              Guidance, not a script.
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-6 text-xl">
              {talkingPoints(data.set, data.chosen).map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
            {chosen && (
              <>
                <h3 className="mt-5 text-xl font-semibold">Evidence</h3>
                <ul className="mt-2 space-y-2">
                  {evidenceFor(data.set, chosen).map((e) => (
                    <li
                      key={e.id}
                      className="rounded-xl bg-zinc-800 p-3 text-lg"
                    >
                      <ProvenanceTag p={e.provenance} />{" "}
                      <span className="ml-2">{e.fact}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        }
      />
    </div>
  );
}
