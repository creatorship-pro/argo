/**
 * One small set of guest states feeds the FDE and facilitator views
 * (ticket A2, "shared guest state"). Moves are forward by one step, or back by
 * one step to fix a mistake. Nothing skips ahead.
 */
export const GUEST_STATUSES = [
  "confirmed",
  "arrived",
  "intake",
  "breakout",
  "reviewed",
  "proposed",
  "closed",
] as const;

export type GuestStatus = (typeof GUEST_STATUSES)[number];

export const GUEST_STATUS_LABEL: Record<GuestStatus, string> = {
  confirmed: "Confirmed",
  arrived: "Arrived",
  intake: "Intake",
  breakout: "Breakout",
  reviewed: "Design reviewed",
  proposed: "Proposal shown",
  closed: "Closed",
};

export function canMove(from: GuestStatus, to: GuestStatus): boolean {
  const a = GUEST_STATUSES.indexOf(from);
  const b = GUEST_STATUSES.indexOf(to);
  return a >= 0 && b >= 0 && Math.abs(a - b) === 1;
}

export function nextStatus(s: GuestStatus): GuestStatus | null {
  const i = GUEST_STATUSES.indexOf(s);
  return GUEST_STATUSES[i + 1] ?? null;
}

/** What the FDE should do next, in plain words, for the big "next step" line. */
export function nextStepText(
  status: GuestStatus,
  opts: {
    hasConsent: boolean;
    hasUnlockedDraft: boolean;
    hasDesigns: boolean;
    hasChoice: boolean;
  },
): string {
  switch (status) {
    case "confirmed":
      return "Greet the guest and mark them arrived.";
    case "arrived":
      return "Start intake. Explain the recording and ask for consent.";
    case "intake":
    case "breakout":
      if (!opts.hasConsent) return "Ask for consent before you record.";
      if (opts.hasUnlockedDraft)
        return "Read the problem back to the guest, then lock it.";
      return "Listen. Ask the next suggested question at a pause.";
    case "reviewed":
      if (!opts.hasDesigns) return "Waiting for the three designs.";
      if (!opts.hasChoice)
        return "Choose the design this guest is most likely to pick.";
      return "Open the proposal page and show the QR code.";
    case "proposed":
      return "Walk the guest through the proposal. Show the QR code.";
    case "closed":
      return "Done. Wrap up with the guest.";
  }
}
