"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { GUEST_STATUS_LABEL } from "@/lib/session/guest-status";
import { GroupChips } from "@/components/fde/GroupChips";

export default function FdeHome() {
  const current = useQuery(api.events.current);
  const eventId = current?.event._id;
  const guests = useQuery(api.guests.mine, eventId ? { eventId } : "skip");

  if (current === undefined) return <p className="p-10 text-2xl">Loading…</p>;
  if (current === null)
    return (
      <p className="p-10 text-2xl">
        No event is set up yet. Ask Mezie to run the seed.
      </p>
    );

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-8">
      <h1 className="text-4xl font-bold">{current.event.name}</h1>
      <p className="mt-2 text-2xl text-zinc-600">
        {current.event.currentOrder >= 0
          ? `Now: ${current.segments[current.event.currentOrder]?.name}`
          : "The event has not started."}
      </p>
      <div className="mt-6">
        <GroupChips eventId={current.event._id} />
      </div>
      <h2 className="mt-10 text-3xl font-semibold">My guests</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {guests?.map((g) => (
          <li key={g._id}>
            <Link
              href={`/fde/guest/${g._id}`}
              className="flex min-h-28 flex-col justify-center rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 active:bg-zinc-100"
            >
              <span className="text-3xl font-semibold">{g.name}</span>
              <span className="text-xl text-zinc-600">{g.business}</span>
              <span className="mt-2 text-lg font-medium text-blue-700">
                {GUEST_STATUS_LABEL[g.status]}
              </span>
            </Link>
          </li>
        ))}
        {guests?.length === 0 && (
          <li className="text-xl text-zinc-600">
            No guests are assigned to you yet.
          </li>
        )}
      </ul>
    </main>
  );
}
