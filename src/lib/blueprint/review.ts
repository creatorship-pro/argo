import type { BlueprintSet, Design, EvidenceItem } from "./types";

export const LEVEL_LABEL = {
  low: "Low autonomy",
  medium: "Medium autonomy",
  high: "High autonomy",
} as const;

/** A blocked design needs something that is not vetted, so it cannot be chosen. */
export const canChoose = (d: Design) => d.fitCheck.status === "feasible";

export interface DesignBrief {
  id: string;
  name: string;
  level: string;
  scope: string;
  alone: string[];
  approval: string[];
  estimate: string;
  feasible: boolean;
  missing: string[];
  recommended: boolean;
}

/** The short form of a design, so three can be compared in two to three minutes. */
export function designBrief(set: BlueprintSet, d: Design): DesignBrief {
  return {
    id: d.id,
    name: d.name,
    level: LEVEL_LABEL[d.autonomyLevel],
    scope: d.scope,
    alone: d.autonomyAndApprovals.alone.slice(0, 3),
    approval: d.autonomyAndApprovals.needsApproval.slice(0, 2),
    estimate: d.expectedOutcome.estimate,
    feasible: canChoose(d),
    missing: d.fitCheck.gaps.map((g) => g.capability),
    recommended: set.recommendation.designId === d.id,
  };
}

/** The evidence a design cites: supporting quotes and whether each fact was said, inferred or confirmed. */
export function evidenceFor(set: BlueprintSet, d: Design): EvidenceItem[] {
  const ids = new Set([
    ...d.model.evidence,
    ...d.skills.flatMap((s) => s.evidence),
    ...d.tools.flatMap((t) => t.evidence ?? []),
  ]);
  return set.evidence.filter((e) => ids.has(e.id));
}

export interface Choice {
  designId: string;
  recommendedId: string;
  /** True when the FDE chose something other than the system's recommendation. */
  differs: boolean;
}

/** The choice is stored next to the recommendation, so accuracy can be measured later. */
export function recordChoice(
  set: BlueprintSet,
  designId: string,
): Choice | null {
  const d = set.designs.find((x) => x.id === designId);
  if (!d || !canChoose(d)) return null;
  return {
    designId,
    recommendedId: set.recommendation.designId,
    differs: set.recommendation.designId !== designId,
  };
}
