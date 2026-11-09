"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@/lib/convex";
import {
  GROUP_STATUS_LABEL,
  formatClock,
  remainingMs,
  segmentState,
} from "@/lib/session/run";
import {
  GUEST_STATUS_LABEL,
  type GuestStatus,
} from "@/lib/session/guest-status";
import { useServerClock } from "@/lib/session/use-clock";
import { CHIP_STYLE } from "@/components/fde/GroupChips";

/**
 * The run board (ticket A7). A countdown from the server's end time, one status
 * chip per FDE group set by the FDE with a tap, and manual phase changes.
 * Nothing here advances the event on its own: the facilitator confirms each
 * phase change.
 */
export function FacilitatorBoard() {
  const current = useQuery(api.events.current);
  const eventId = current?.event._id;
  const groups = useQuery(api.groups.board, eventId ? { eventId } : "skip");
  const start = useMutation(api.events.startSegment);
  const adjust = useMutation(api.events.adjustSegment);
  const stop = useMutation(api.events.stop);
  const { offset, now } = useServerClock();
  const [confirming, setConfirming] = useState<number | null>(null);

  if (current === undefined) return <p className="p-10 text-3xl">Loading…</p>;
  if (current === null)
    return <p className="p-10 text-3xl">No event is set up yet.</p>;

  const { event, segments } = current;
  const running = event.currentOrder >= 0 ? segments[event.currentOrder] : null;
  const endsAt = event.segmentEndsAt ?? null;
  const state = running ? segmentState(endsAt, now, offset) : "idle";
  const left = endsAt != null ? remainingMs(endsAt, now, offset) : 0;
  const nextOrder =
    event.currentOrder + 1 < segments.length ? event.currentOrder + 1 : null;
  const anyHelp = groups?.some((g) => g.status === "needs_help") ?? false;

  return (
    <main
      className={`flex flex-1 flex-col gap-6 p-8 transition-colors ${state === "due" ? "bg-red-900" : anyHelp ? "bg-fuchsia-950" : "bg-zinc-950"}`}
    >
      <header>
        <p className="text-2xl text-zinc-400">{event.name}</p>
        <h1 className="mt-1 text-5xl font-bold">
          {running ? running.name : "Not started"}
        </h1>
        <p
          className={`mt-2 font-mono text-[9rem] font-bold leading-none tabular-nums ${state === "due" ? "text-red-200" : ""}`}
        >
          {running && endsAt != null ? formatClock(left) : "--:--"}
        </p>
        {state === "due" && (
          <p className="mt-2 text-4xl font-semibold text-red-100">
            Time is up for this segment.
          </p>
        )}
        {anyHelp && (
          <p className="mt-2 text-3xl font-semibold text-fuchsia-200">
            A group needs help.
          </p>
        )}
      </header>

      <section aria-label="FDE groups">
        <h2 className="text-3xl font-semibold">FDE groups</h2>
        <ul className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups?.map((g) => (
            <li
              key={g.fdeEmail}
              className="rounded-2xl bg-zinc-900 p-5 ring-1 ring-zinc-700"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-2xl font-semibold">
                  {g.fdeEmail}
                </span>
                <span
                  className={`shrink-0 rounded-full px-4 py-2 text-xl font-bold ${CHIP_STYLE[g.status]}`}
                >
                  {GROUP_STATUS_LABEL[g.status]}
                </span>
              </div>
              <p className="mt-2 text-xl text-zinc-400">
                {g.guests} guests ·{" "}
                {Object.entries(g.byStatus)
                  .map(
                    ([s, n]) =>
                      `${n} ${GUEST_STATUS_LABEL[s as GuestStatus].toLowerCase()}`,
                  )
                  .join(", ")}
              </p>
            </li>
          ))}
          {groups?.length === 0 && (
            <li className="text-2xl text-zinc-400">
              No guests are assigned yet.
            </li>
          )}
        </ul>
      </section>

      <section aria-label="Run of show">
        <h2 className="text-3xl font-semibold">Run of show</h2>
        <ol className="mt-3 flex flex-col gap-3">
          {segments.map((s) => {
            const active = s.order === event.currentOrder;
            return (
              <li
                key={s._id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 ${active ? "bg-blue-700" : "bg-zinc-900"}`}
              >
                <span className="text-2xl font-semibold">
                  {s.order + 1}. {s.name}{" "}
                  <span className="font-normal text-zinc-300">
                    ({s.minutes} min)
                  </span>
                </span>
                {!active && (
                  <button
                    onClick={() => {
                      if (confirming === s.order) {
                        setConfirming(null);
                        void start({
                          eventId: event._id as Id<"events">,
                          order: s.order,
                        });
                      } else setConfirming(s.order);
                    }}
                    className={`min-h-14 rounded-xl px-6 text-xl font-semibold ${confirming === s.order ? "bg-amber-400 text-zinc-900" : "bg-zinc-700"}`}
                  >
                    {confirming === s.order
                      ? "Tap again to confirm"
                      : s.order === nextOrder
                        ? "Start next"
                        : "Start"}
                  </button>
                )}
                {active && (
                  <span className="text-xl font-semibold">Running</span>
                )}
              </li>
            );
          })}
        </ol>
        {running && (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() =>
                void adjust({ eventId: event._id, deltaMinutes: 5 })
              }
              className="min-h-14 rounded-xl bg-zinc-700 px-6 text-xl font-semibold"
            >
              +5 min
            </button>
            <button
              onClick={() =>
                void adjust({ eventId: event._id, deltaMinutes: -5 })
              }
              className="min-h-14 rounded-xl bg-zinc-700 px-6 text-xl font-semibold"
            >
              −5 min
            </button>
            <button
              onClick={() => void stop({ eventId: event._id })}
              className="min-h-14 rounded-xl bg-zinc-700 px-6 text-xl font-semibold"
            >
              Stop the clock
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
