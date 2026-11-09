"use client";

import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@/lib/convex";
import {
  GROUP_STATUSES,
  GROUP_STATUS_LABEL,
  type GroupStatus,
} from "@/lib/session/run";

export const CHIP_STYLE: Record<GroupStatus, string> = {
  idle: "bg-zinc-200 text-zinc-800",
  recording: "bg-red-600 text-white",
  awaiting_review: "bg-amber-400 text-zinc-900",
  ready: "bg-emerald-600 text-white",
  needs_help: "bg-fuchsia-700 text-white",
};

/** The FDE taps to tell the facilitator what their group is doing. */
export function GroupChips({ eventId }: { eventId: Id<"events"> }) {
  const mine = useQuery(api.groups.mine, { eventId });
  const set = useMutation(api.groups.setMine);
  const current = mine?.status ?? "idle";
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Group status"
    >
      <span className="text-lg text-zinc-600">My group:</span>
      {GROUP_STATUSES.filter((s) => s !== "idle").map((s) => (
        <button
          key={s}
          onClick={() => void set({ eventId, status: s })}
          aria-pressed={current === s}
          className={`min-h-14 rounded-full px-5 text-lg font-semibold ${current === s ? CHIP_STYLE[s] + " ring-4 ring-zinc-900/30" : "bg-white text-zinc-700 ring-1 ring-zinc-300"}`}
        >
          {GROUP_STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  );
}
