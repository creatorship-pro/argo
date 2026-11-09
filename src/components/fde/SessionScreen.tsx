"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@/lib/convex";
import {
  CHECKLIST,
  PROVENANCE_LABEL,
  readiness,
  type ProfileFact,
} from "@/lib/profile/facts";
import { partitionFacts } from "@/lib/profile/view";
import { CONSENT_SCRIPT } from "@/lib/session/consent";
import {
  GUEST_STATUS_LABEL,
  nextStatus,
  nextStepText,
} from "@/lib/session/guest-status";
import { SOFT_CUE_MS, TURN_MS, formatClock, turnCue } from "@/lib/session/run";
import { GroupChips } from "./GroupChips";
import { useTurnRecorder } from "./useTurnRecorder";

const PROV_STYLE: Record<string, string> = {
  inferred: "bg-amber-100 text-amber-900 ring-amber-400",
  said: "bg-sky-100 text-sky-900 ring-sky-400",
  "read-back-confirmed": "bg-emerald-100 text-emerald-900 ring-emerald-500",
  "fde-approved": "bg-emerald-100 text-emerald-900 ring-emerald-500",
};

export function ProvenanceTag({ p }: { p: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-base font-semibold ring-1 ${PROV_STYLE[p]}`}
    >
      {PROVENANCE_LABEL[p as keyof typeof PROVENANCE_LABEL]}
    </span>
  );
}

export function SessionScreen({ guestId }: { guestId: Id<"guests"> }) {
  const guest = useQuery(api.guests.get, { guestId });
  const current = useQuery(api.events.current);
  const rows = useQuery(api.profile.facts, { guestId });
  const suggestions = useQuery(api.profile.suggestions, { guestId });
  const designs = useQuery(api.designs.forGuest, { guestId });
  const setStatus = useMutation(api.guests.setStatus);
  const setGroup = useMutation(api.groups.setMine);
  const [showAll, setShowAll] = useState(false);

  if (!guest || !rows || !suggestions || current === undefined)
    return <p className="p-10 text-2xl">Loading…</p>;

  const facts: ProfileFact[] = rows.map((d) => ({
    id: d._id,
    text: d.text,
    provenance: d.provenance,
    quote: d.quote ?? null,
    checklistKey: d.checklistKey ?? null,
    lockedAt: d.lockedAt ?? null,
  }));
  const { anchors, drafts } = partitionFacts(facts);
  const ready = readiness(facts);
  const next = nextStatus(guest.status);
  const hasConsent = guest.consentRecordedAt != null;
  const eventId = current?.event._id;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white px-8 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/fde" className="text-lg text-blue-700">
              ← My guests
            </Link>
            <h1 className="text-4xl font-bold">{guest.name}</h1>
            <p className="text-xl text-zinc-600">{guest.business}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-blue-100 px-5 py-3 text-xl font-semibold text-blue-900">
              {GUEST_STATUS_LABEL[guest.status]}
            </span>
            {next && (
              <button
                onClick={() => void setStatus({ guestId, status: next })}
                className="min-h-14 rounded-xl bg-zinc-900 px-6 text-xl font-semibold text-white"
              >
                Move to: {GUEST_STATUS_LABEL[next]}
              </button>
            )}
            {eventId && (
              <button
                onClick={() => void setGroup({ eventId, status: "needs_help" })}
                className="min-h-14 rounded-xl bg-fuchsia-700 px-6 text-xl font-semibold text-white"
              >
                Need help
              </button>
            )}
          </div>
        </div>
        {eventId && (
          <div className="mt-3">
            <GroupChips eventId={eventId} />
          </div>
        )}
        {/* Confirmed facts only. */}
        <nav aria-label="Confirmed facts" className="mt-3 flex flex-wrap gap-2">
          {anchors.length === 0 ? (
            <span className="text-lg text-zinc-500">
              Nothing confirmed yet.
            </span>
          ) : (
            anchors.map((a) => (
              <span
                key={a.id}
                className="rounded-full bg-emerald-100 px-4 py-2 text-lg font-medium text-emerald-900 ring-1 ring-emerald-500"
              >
                ✓ {a.text}
              </span>
            ))
          )}
        </nav>
      </header>

      <main className="grid flex-1 grid-cols-1 gap-6 p-8 lg:grid-cols-5">
        <section className="flex flex-col gap-6 lg:col-span-3">
          <div className="rounded-2xl bg-zinc-900 p-8 text-white">
            <p className="text-lg uppercase tracking-wide text-zinc-400">
              Next
            </p>
            <p className="mt-2 text-4xl font-bold leading-tight">
              {nextStepText(guest.status, {
                hasConsent,
                hasUnlockedDraft: drafts.length > 0,
                hasDesigns: !!designs,
                hasChoice: !!designs?.fdeChoice,
              })}
            </p>
          </div>

          <Suggestions guestId={guestId} items={suggestions} />

          {(guest.status === "reviewed" ||
            guest.status === "breakout" ||
            guest.status === "intake") && (
            <Link
              href={`/fde/guest/${guestId}/review`}
              className="flex min-h-16 items-center justify-center rounded-2xl bg-blue-700 px-6 text-2xl font-semibold text-white"
            >
              Break review: three designs →
            </Link>
          )}

          <div>
            <button
              onClick={() => setShowAll((s) => !s)}
              className="min-h-14 text-xl text-blue-700 underline"
            >
              {showAll ? "Hide" : "Show"} everything on the profile (
              {facts.length})
            </button>
            {showAll && (
              <ul className="mt-2 flex flex-col gap-2">
                {facts.map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 text-xl ring-1 ring-zinc-200"
                  >
                    <ProvenanceTag p={f.provenance} />
                    <span>{f.text}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-lg text-zinc-500">
              Still missing for the proposal:{" "}
              {ready.missing.length
                ? ready.missing
                    .map((k) => CHECKLIST.find((c) => c.key === k)?.label)
                    .join("; ")
                : "nothing — the profile is deck-ready."}
            </p>
          </div>
        </section>

        <aside className="flex flex-col gap-6 lg:col-span-2">
          <RecordPanel
            guestId={guestId}
            hasConsent={hasConsent}
            eventId={eventId}
          />
          <ReadBack guestId={guestId} drafts={drafts} />
          <OwnNote guestId={guestId} />
          <p className="rounded-xl bg-zinc-100 p-4 text-lg text-zinc-700">
            If the recording or the suggestions stop working, carry on with the
            intake script and your own notes. Nothing is lost: audio uploads
            when the connection returns.
          </p>
        </aside>
      </main>
    </div>
  );
}

function Suggestions({
  guestId,
  items,
}: {
  guestId: Id<"guests">;
  items: { _id: Id<"suggestions">; text: string }[];
}) {
  const asked = useMutation(api.profile.markAsked);
  const dismiss = useMutation(api.profile.dismiss);
  void guestId;
  // One or two at a time, at natural pauses, not a running feed.
  const shown = items.slice(0, 2);
  return (
    <div>
      <h2 className="text-2xl font-semibold">Suggested questions</h2>
      {shown.length === 0 ? (
        <p className="mt-2 text-xl text-zinc-500">
          None right now. Keep listening.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {shown.map((s) => (
            <li
              key={s._id}
              className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200"
            >
              <p className="text-3xl leading-snug">{s.text}</p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => void asked({ suggestionId: s._id })}
                  className="min-h-14 flex-1 rounded-xl bg-emerald-600 text-xl font-semibold text-white"
                >
                  Asked it
                </button>
                <button
                  onClick={() => void dismiss({ suggestionId: s._id })}
                  className="min-h-14 flex-1 rounded-xl bg-zinc-200 text-xl font-semibold"
                >
                  Skip
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecordPanel({
  guestId,
  hasConsent,
  eventId,
}: {
  guestId: Id<"guests">;
  hasConsent: boolean;
  eventId?: Id<"events">;
}) {
  const record = useMutation(api.consent.record);
  const setGroup = useMutation(api.groups.setMine);
  const rec = useTurnRecorder(guestId, (on) => {
    if (eventId)
      void setGroup({ eventId, status: on ? "recording" : "awaiting_review" });
  });
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!rec.recording) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [rec.recording]);

  if (!hasConsent) {
    return (
      <div className="rounded-2xl bg-white p-6 ring-2 ring-amber-400">
        <h2 className="text-2xl font-semibold">Consent first</h2>
        <p className="mt-3 text-xl leading-relaxed text-zinc-700">
          {CONSENT_SCRIPT}
        </p>
        <button
          onClick={() => void record({ guestId })}
          className="mt-5 min-h-16 w-full rounded-xl bg-emerald-600 text-2xl font-semibold text-white"
        >
          Guest agreed
        </button>
        <p className="mt-3 text-lg text-zinc-500">
          Recording stays off until you tap this.
        </p>
      </div>
    );
  }

  const elapsed =
    rec.startedAt && now > rec.startedAt ? now - rec.startedAt : 0;
  const cue = turnCue(elapsed);
  return (
    <div
      className={`rounded-2xl p-6 ring-2 ${cue === "over" ? "bg-red-50 ring-red-500" : cue === "wrap-up" ? "bg-amber-50 ring-amber-500" : "bg-white ring-zinc-200"}`}
    >
      <h2 className="text-2xl font-semibold">Guest turn</h2>
      <p
        className="mt-2 font-mono text-7xl font-bold tabular-nums"
        aria-live="off"
      >
        {formatClock(rec.recording ? TURN_MS - elapsed : TURN_MS)}
      </p>
      {rec.recording && cue === "wrap-up" && (
        <p className="mt-1 text-2xl font-semibold text-amber-800">
          About {Math.round(SOFT_CUE_MS / 1000)} seconds left. Start wrapping
          up.
        </p>
      )}
      {rec.recording && cue === "over" && (
        <p className="mt-1 text-2xl font-semibold text-red-700">
          Five minutes are up. Bring it to a close.
        </p>
      )}
      {!rec.recording ? (
        <button
          onClick={() => void rec.start()}
          className="mt-4 min-h-16 w-full rounded-xl bg-red-600 text-2xl font-semibold text-white"
        >
          ● Start recording
        </button>
      ) : (
        <button
          onClick={() => void rec.stop()}
          className="mt-4 min-h-16 w-full rounded-xl bg-zinc-900 text-2xl font-semibold text-white"
        >
          ■ End turn
        </button>
      )}
      {rec.pending > 0 && (
        <p className="mt-3 text-lg text-zinc-600">
          {rec.pending} segment{rec.pending > 1 ? "s" : ""} waiting to upload.
          They are kept on this iPad and will go when the connection returns.
        </p>
      )}
      {rec.error && (
        <p role="alert" className="mt-3 text-lg text-red-700">
          {rec.error}
        </p>
      )}
    </div>
  );
}

/** The read-back lock: the FDE restates it in their own words and locks it with one tap. */
function ReadBack({
  guestId,
  drafts,
}: {
  guestId: Id<"guests">;
  drafts: ProfileFact[];
}) {
  void guestId;
  return (
    <div className="rounded-2xl bg-white p-6 ring-1 ring-zinc-200">
      <h2 className="text-2xl font-semibold">Read back</h2>
      <p className="mt-1 text-lg text-zinc-600">
        Say it back to the guest in your own words, fix the wording here, then
        lock it.
      </p>
      {drafts.length === 0 ? (
        <p className="mt-3 text-xl text-zinc-500">
          Nothing waiting to be read back.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-4">
          {drafts.map((d) => (
            <DraftRow key={d.id} fact={d} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DraftRow({ fact }: { fact: ProfileFact }) {
  const lock = useMutation(api.profile.lock);
  const [text, setText] = useState(fact.text);
  return (
    <li className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-300">
      <ProvenanceTag p={fact.provenance} />
      {fact.quote && (
        <p className="mt-2 text-lg italic text-zinc-600">“{fact.quote}”</p>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="mt-2 w-full rounded-lg border border-zinc-300 p-3 text-xl"
        aria-label="Read-back wording"
      />
      <button
        onClick={() =>
          void lock({ factId: fact.id as Id<"profileFacts">, wording: text })
        }
        className="mt-2 min-h-14 w-full rounded-xl bg-emerald-600 text-xl font-semibold text-white"
      >
        🔒 Lock it
      </button>
    </li>
  );
}

function OwnNote({ guestId }: { guestId: Id<"guests"> }) {
  const add = useMutation(api.profile.addByFde);
  const [text, setText] = useState("");
  return (
    <form
      className="rounded-2xl bg-white p-6 ring-1 ring-zinc-200"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        void add({ guestId, text }).then(() => setText(""));
      }}
    >
      <h2 className="text-2xl font-semibold">Add my own note</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="mt-2 w-full rounded-lg border border-zinc-300 p-3 text-xl"
        aria-label="Your note"
      />
      <button
        type="submit"
        className="mt-2 min-h-14 w-full rounded-xl bg-zinc-900 text-xl font-semibold text-white"
      >
        Save note
      </button>
    </form>
  );
}
