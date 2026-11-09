import { describeCalendar } from "./calendar";
import type { BlueprintSet, Design, EvidenceItem } from "../blueprint/types";

export interface ProposalView {
  designId: string;
  name: string;
  role: string;
  /** The problem in the owner's words, from facts the owner said or confirmed. */
  problemInTheirWords: { text: string; quote: string | null }[];
  problemSummary: string;
  alone: string[];
  needsApproval: string[];
  never: string[];
  /** A simple numbered list of how it works, from input to outcome. */
  steps: string[];
  outcome: {
    metric: string;
    estimate: string;
    assumptions: string[];
    note: string;
  };
  needsFromYou: { system: string; permission: string }[];
  others: { id: string; name: string; summary: string; blocked: boolean }[];
}

export function findDesign(
  set: BlueprintSet,
  designId: string | null | undefined,
): Design | null {
  if (!designId) return null;
  return set.designs.find((d) => d.id === designId) ?? null;
}

/** Which design the guest sees: the FDE's choice, else the recommendation. */
export function chosenDesign(set: BlueprintSet): Design | null {
  return (
    findDesign(set, set.fdeChoice) ??
    findDesign(set, set.recommendation.designId)
  );
}

function usedEvidence(set: BlueprintSet, d: Design): EvidenceItem[] {
  const ids = new Set([
    ...d.model.evidence,
    ...d.skills.flatMap((s) => s.evidence),
    ...d.tools.flatMap((t) => t.evidence ?? []),
  ]);
  return set.evidence.filter((e) => ids.has(e.id));
}

export function buildSteps(d: Design): string[] {
  const steps: string[] = [];
  for (const r of d.routines) {
    steps.push(
      `${describeCalendar(r.schedule.calendar)}: ${r.name}. ${firstSentence(r.prompt)}`,
    );
  }
  if (d.autonomyAndApprovals.needsApproval.length) {
    steps.push(
      `Anything that needs your decision waits for you: ${d.autonomyAndApprovals.needsApproval[0].replace(/\.$/, "")}.`,
    );
  }
  steps.push(
    `The result: ${d.expectedOutcome.metric}. ${d.expectedOutcome.estimate} (an estimate).`,
  );
  return steps;
}

function firstSentence(s: string): string {
  const m = s.trim().match(/^[^.!?]+[.!?]?/);
  const out = (m ? m[0] : s).trim();
  return out.endsWith(".") || out.endsWith("!") || out.endsWith("?")
    ? out
    : out + ".";
}

export function proposalView(
  set: BlueprintSet,
  designId?: string | null,
): ProposalView | null {
  const d = findDesign(set, designId) ?? chosenDesign(set);
  if (!d) return null;
  const confirmedOrSaid = usedEvidence(set, d).filter(
    (e) => e.provenance !== "inferred",
  );
  return {
    designId: d.id,
    name: d.name,
    role: d.role.title,
    problemInTheirWords: confirmedOrSaid
      .slice(0, 4)
      .map((e) => ({ text: e.fact, quote: e.quote })),
    problemSummary: set.valueAssessment.problem,
    alone: d.autonomyAndApprovals.alone,
    needsApproval: d.autonomyAndApprovals.needsApproval,
    never: d.autonomyAndApprovals.never,
    steps: buildSteps(d),
    outcome: {
      metric: d.expectedOutcome.metric,
      estimate: d.expectedOutcome.estimate,
      assumptions: d.expectedOutcome.assumptions,
      note: "This is an estimate, not a promise. We check these numbers with you after the first month.",
    },
    needsFromYou: d.accessNeeded.map((a) => ({
      system: a.system,
      permission: a.permission,
    })),
    others: set.designs
      .filter((x) => x.id !== d.id)
      .map((x) => ({
        id: x.id,
        name: x.name,
        summary: x.scope,
        blocked: x.fitCheck.status === "blocked",
      })),
  };
}

/** Talking points for the FDE: guidance, not a script (the four-step pattern). */
export function talkingPoints(
  set: BlueprintSet,
  designId?: string | null,
): string[] {
  const d = findDesign(set, designId) ?? chosenDesign(set);
  if (!d) return [];
  return [
    `Probe: "${set.valueAssessment.problem}" Is that still the thing that costs you the most?`,
    `Feel: ask how this problem has felt lately, in their own words.`,
    `Felt: others in this spot have felt the same. This design keeps you in control: ${d.autonomyAndApprovals.needsApproval[0] ?? "you approve what matters"}.`,
    `Found: walk the numbered list, then the estimate and its assumptions: ${d.expectedOutcome.estimate}.`,
  ];
}
