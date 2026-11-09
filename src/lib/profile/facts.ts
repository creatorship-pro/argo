import type { Provenance } from "../blueprint/types";

export type { Provenance };

/** What the proposal needs before a profile is "deck-ready" (ticket A3). */
export const CHECKLIST = [
  { key: "problem", label: "The problem in the owner's words" },
  { key: "frequency", label: "How often it happens" },
  { key: "duration", label: "How long it takes" },
  { key: "who", label: "Who does it" },
  { key: "cost", label: "What it costs" },
  { key: "tools", label: "Tools they use today" },
  { key: "constraints", label: "Constraints and habits" },
  { key: "success", label: "What success looks like" },
] as const;

export type ChecklistKey = (typeof CHECKLIST)[number]["key"];

export const CHECKLIST_KEYS: readonly string[] = CHECKLIST.map((c) => c.key);

export interface ProfileFact {
  id: string;
  text: string;
  provenance: Provenance;
  /** The words the guest actually used. Required for `said`. */
  quote: string | null;
  checklistKey: ChecklistKey | null;
  lockedAt: number | null;
}

/** A fact the agent proposes. It is never confirmed on arrival. */
export interface ProposedFact {
  text: string;
  provenance: string;
  quote?: string | null;
  checklistKey?: string | null;
}

/**
 * Anything the agent proposes arrives as `said` (with a supporting quote) or
 * `inferred`. The agent can never create a confirmed fact: a claim of `said`
 * with no quote is downgraded to `inferred`, and any other label is ignored.
 */
export function normalizeProposal(
  p: ProposedFact,
): Pick<ProfileFact, "text" | "provenance" | "quote" | "checklistKey"> | null {
  const text = typeof p.text === "string" ? p.text.trim() : "";
  if (!text) return null;
  const quote =
    typeof p.quote === "string" && p.quote.trim() ? p.quote.trim() : null;
  const provenance: Provenance =
    p.provenance === "said" && quote ? "said" : "inferred";
  const checklistKey = CHECKLIST_KEYS.includes(p.checklistKey ?? "")
    ? (p.checklistKey as ChecklistKey)
    : null;
  return { text, provenance, quote, checklistKey };
}

/** A fact counts as confirmed only after the guest or the FDE stood behind it. */
export function isConfirmed(p: Provenance): boolean {
  return p === "read-back-confirmed" || p === "fde-approved";
}

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  said: "Guest said it",
  "read-back-confirmed": "Read back and confirmed",
  inferred: "Inferred by the agent",
  "fde-approved": "Approved by the FDE",
};

export type LockResult =
  { ok: true; fact: ProfileFact } | { ok: false; reason: string };

/**
 * The read-back lock (ticket A1). The FDE restates the problem in their own
 * words and locks it with one tap. Only this step creates a
 * `read-back-confirmed` fact.
 */
export function lockReadBack(
  fact: ProfileFact,
  fdeWording: string | undefined,
  now: number,
): LockResult {
  const text = (fdeWording ?? fact.text).trim();
  if (!text) return { ok: false, reason: "The read-back wording is empty." };
  return {
    ok: true,
    fact: {
      ...fact,
      text,
      provenance: "read-back-confirmed",
      lockedAt: now,
    },
  };
}

/** The FDE approves an inferred fact without a read-back (a lighter step). */
export function approveFact(fact: ProfileFact, now: number): ProfileFact {
  if (isConfirmed(fact.provenance)) return fact;
  return { ...fact, provenance: "fde-approved", lockedAt: now };
}

/** The breadcrumb at the top of the FDE screen: confirmed facts only. */
export function confirmedAnchors(facts: ProfileFact[]): ProfileFact[] {
  return facts.filter((f) => isConfirmed(f.provenance));
}

export interface Readiness {
  covered: ChecklistKey[];
  missing: ChecklistKey[];
  ready: boolean;
}

/** Deck-ready when every checklist item has at least one confirmed or said fact. */
export function readiness(facts: ProfileFact[]): Readiness {
  const covered = new Set<ChecklistKey>();
  for (const f of facts) {
    if (f.checklistKey && f.provenance !== "inferred")
      covered.add(f.checklistKey);
  }
  const keys = CHECKLIST.map((c) => c.key);
  const missing = keys.filter((k) => !covered.has(k));
  return {
    covered: keys.filter((k) => covered.has(k)),
    missing,
    ready: missing.length === 0,
  };
}
