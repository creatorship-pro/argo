import type { Provenance } from "./types";

/**
 * Event one's value rule: hours lost times confidence (ticket A4). The
 * confidence comes from how well the facts behind the number are backed, so it
 * is computed here rather than left to the model.
 */
export const PROVENANCE_WEIGHT: Record<Provenance, number> = {
  "read-back-confirmed": 1,
  "fde-approved": 0.9,
  said: 0.7,
  inferred: 0.3,
};

export function confidenceFrom(provenances: Provenance[]): number {
  if (provenances.length === 0) return 0;
  const sum = provenances.reduce((a, p) => a + PROVENANCE_WEIGHT[p], 0);
  return Math.round((sum / provenances.length) * 100) / 100;
}

export function confidenceLabel(c: number): "high" | "medium" | "low" {
  return c >= 0.8 ? "high" : c >= 0.5 ? "medium" : "low";
}

export interface Candidate {
  title: string;
  hoursLostPerWeek: number;
  evidenceProvenance: Provenance[];
  /** False when the problem cannot be designed from vetted capabilities. */
  feasible: boolean;
}

export const valueScore = (c: Candidate) =>
  c.hoursLostPerWeek * confidenceFrom(c.evidenceProvenance);

/** Gate, then rank: drop what cannot be designed, then take the highest value. */
export function pickProblem(cands: Candidate[]): Candidate | null {
  const ok = cands.filter((c) => c.feasible && c.hoursLostPerWeek > 0);
  if (ok.length === 0) return null;
  return [...ok].sort((a, b) => valueScore(b) - valueScore(a))[0];
}
