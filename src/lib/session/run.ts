/**
 * Timers use server end times. The server stores when a segment ends; each
 * device counts down locally. Clock ticks are never written to the database.
 */

export interface RunSegment {
  name: string;
  minutes: number;
}

/** Placeholder run of show. The real one is decided in D3 and replaces this. */
export const DEFAULT_RUN_OF_SHOW: RunSegment[] = [
  { name: "Arrival and check-in", minutes: 20 },
  { name: "Welcome", minutes: 10 },
  { name: "Intake with your FDE", minutes: 30 },
  { name: "Discovery breakout", minutes: 30 },
  { name: "Networking break", minutes: 20 },
  { name: "Proposal round", minutes: 30 },
  { name: "Wrap-up", minutes: 10 },
];

/** The offset to add to this device's clock to get server time. */
export function clockOffset(serverNow: number, deviceNow: number): number {
  return serverNow - deviceNow;
}

export function remainingMs(
  endsAt: number,
  deviceNow: number,
  offset: number,
): number {
  return endsAt - (deviceNow + offset);
}

/** "12:05", or "-0:42" once the time is up. */
export function formatClock(ms: number): string {
  const sign = ms < 0 ? "-" : "";
  const total = Math.floor(Math.abs(ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
}

export type SegmentState = "idle" | "running" | "due";

/** The board turns a different color when the active timer reaches zero. */
export function segmentState(
  endsAt: number | null,
  deviceNow: number,
  offset: number,
): SegmentState {
  if (endsAt == null) return "idle";
  return remainingMs(endsAt, deviceNow, offset) <= 0 ? "due" : "running";
}

export const GROUP_STATUSES = [
  "idle",
  "recording",
  "awaiting_review",
  "ready",
  "needs_help",
] as const;
export type GroupStatus = (typeof GROUP_STATUSES)[number];

export const GROUP_STATUS_LABEL: Record<GroupStatus, string> = {
  idle: "Not started",
  recording: "Recording",
  awaiting_review: "Awaiting review",
  ready: "Ready",
  needs_help: "Needs help",
};

/** The FDE's personal five-minute turn, counted down locally with a soft cue. */
export const TURN_MS = 5 * 60 * 1000;
export const SOFT_CUE_MS = 30 * 1000;

export type TurnCue = "ok" | "wrap-up" | "over";

export function turnCue(elapsedMs: number): TurnCue {
  if (elapsedMs >= TURN_MS) return "over";
  if (elapsedMs >= TURN_MS - SOFT_CUE_MS) return "wrap-up";
  return "ok";
}
