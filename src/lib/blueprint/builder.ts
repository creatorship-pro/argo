import schema from "../../../docs/blueprint/schema.json";
import { complete, extractJson, type LlmConfig } from "../llm";
import { CATALOG, isUsable } from "./catalog";
import { confidenceFrom, confidenceLabel } from "./value";
import {
  checkBlueprintSet,
  checkDesign,
  checkRecommendation,
  type CheckResult,
} from "./validate";
import type {
  AutonomyLevel,
  BlueprintSet,
  Capability,
  Design,
  EvidenceItem,
  Provenance,
} from "./types";

export const VARIANTS: { id: string; level: AutonomyLevel; brief: string }[] = [
  {
    id: "d1",
    level: "low",
    brief:
      "Prepares everything as drafts and sends nothing. A person approves every action.",
  },
  {
    id: "d2",
    level: "medium",
    brief:
      "Acts alone on routine work inside hard limits, and asks a person for the rest.",
  },
  {
    id: "d3",
    level: "high",
    brief:
      "Runs a whole function end to end, with a person alerted only on exceptions.",
  },
];

export interface GuestProfile {
  guest: BlueprintSet["guest"];
  facts: {
    id: string;
    text: string;
    provenance: Provenance;
    quote: string | null;
  }[];
}

export const evidenceFrom = (p: GuestProfile): EvidenceItem[] =>
  p.facts.map((f, i) => ({
    id: `e${i + 1}`,
    fact: f.text,
    provenance: f.provenance,
    quote: f.quote,
  }));

const defs = (schema as { $defs: Record<string, unknown> }).$defs;
const DESIGN_SCHEMA = JSON.stringify({ $defs: defs, $ref: "#/$defs/design" });

const SYSTEM = `You design an AI employee for a small business owner. The employee runs on pi (a coding-agent harness), on a server, started by system timers. It is DESIGNED, not deployed: you write a blueprint only.

Hard rules:
- Build the design only from the capabilities in the catalog you are given. Refer to tools by capability id (for example "email.drafts"), never by vendor. If the job needs a connection that is not in the catalog, still design what is needed, list that capability id in "tools", and the fit check will mark the design blocked.
- Every choice carries a "why" that cites evidence ids (for example ["e1","e3"]) from the guest's profile. Use only those ids.
- Limits must be enforced in code (a script or a capability's access level), not only in the prompt. List them in autonomyAndApprovals.enforcedInCode.
- Schedules use systemd OnCalendar syntax with a separate time zone.
- Never put credentials in the blueprint. Never promise results: expectedOutcome.notAGuarantee must be true and every estimate needs stated assumptions.
- Numbers shown to the guest are estimates, never guarantees. Do not invent facts about the guest.
- Set fitCheck to {"status":"feasible","gaps":[]}; it is recomputed afterwards.

Reply with ONE JSON object that validates against this JSON Schema, and nothing else:
`;

export function designPrompt(
  profile: GuestProfile,
  catalog: Capability[],
  variant: (typeof VARIANTS)[number],
  problem: string,
  hoursLostPerWeek: number,
  previousErrors?: string[],
): { system: string; user: string } {
  const cat = catalog.map((c) => ({
    id: c.id,
    kind: c.kind,
    access: c.access,
    risk: c.risk,
    usable: c.vetted,
  }));
  const lines = [
    `Design id: "${variant.id}". Autonomy level: "${variant.level}". ${variant.brief}`,
    `Problem to solve: ${problem} (about ${hoursLostPerWeek} hours a week).`,
    `Guest: ${profile.guest.name}, ${profile.guest.business}.`,
    "Evidence:",
    ...evidenceFrom(profile).map(
      (e) =>
        `- ${e.id} [${e.provenance}] ${e.fact}${e.quote ? ` ("${e.quote}")` : ""}`,
    ),
    "Capability catalog:",
    JSON.stringify(cat),
  ];
  if (previousErrors?.length)
    lines.push(
      "Your last attempt failed validation. Fix these:",
      ...previousErrors.slice(0, 12),
    );
  return { system: SYSTEM + DESIGN_SCHEMA, user: lines.join("\n") };
}

/** Checks each tool against the catalog. This overrides whatever the model claimed. */
export function fitCheck(
  design: Design,
  catalog: Capability[],
  allowUnvetted = false,
): Design["fitCheck"] {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const gaps: Design["fitCheck"]["gaps"] = [];
  for (const t of Array.isArray(design.tools) ? design.tools : []) {
    const c = byId.get(t.capability);
    if (!isUsable(c, allowUnvetted)) {
      gaps.push({
        capability: t.capability,
        need: t.why,
        vetted: c?.vetted ?? false,
      });
    }
  }
  if (gaps.length === 0) return { status: "feasible", gaps: [] };
  const fallback =
    design.autonomyLevel === "low"
      ? "Not possible with vetted parts today. Offer a manual checklist instead."
      : "Offer the lower-autonomy design, which needs fewer connections.";
  return { status: "blocked", gaps, fallback, gapsLoggedForB1: true };
}

export type Complete = (system: string, user: string) => Promise<string>;

export const completeWith =
  (cfg: LlmConfig, maxTokens = 8000): Complete =>
  (system, user) =>
    complete({ system, user, maxTokens }, cfg);

/** One design, generated on its own. Retries once with the validation errors. */
export async function generateDesign(
  llm: Complete,
  profile: GuestProfile,
  catalog: Capability[],
  variant: (typeof VARIANTS)[number],
  problem: string,
  hours: number,
  allowUnvetted: boolean,
): Promise<CheckResult<Design>> {
  let errors: string[] | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const p = designPrompt(profile, catalog, variant, problem, hours, errors);
    let parsed: unknown;
    try {
      parsed = extractJson(await llm(p.system, p.user));
    } catch (e) {
      errors = [e instanceof Error ? e.message : "unreadable reply"];
      continue;
    }
    if (parsed && typeof parsed === "object") {
      const d = parsed as Design;
      d.id = variant.id;
      d.autonomyLevel = variant.level;
      const known = new Set(evidenceFrom(profile).map((e) => e.id));
      const badRefs = collectEvidenceRefs(d).filter((r) => !known.has(r));
      d.fitCheck = fitCheck(d, catalog, allowUnvetted);
      const r = checkDesign(d);
      if (r.ok && badRefs.length === 0) return r;
      errors = [
        ...(r.ok ? [] : r.errors),
        ...(badRefs.length
          ? [`unknown evidence ids: ${[...new Set(badRefs)].join(", ")}`]
          : []),
      ];
    }
  }
  return { ok: false, errors: errors ?? ["no valid design"] };
}

function collectEvidenceRefs(d: Design): string[] {
  return [
    ...(d.model?.evidence ?? []),
    ...(d.skills ?? []).flatMap((s) => s.evidence ?? []),
    ...(d.tools ?? []).flatMap((t) => t.evidence ?? []),
  ];
}

const RECOMMEND_SYSTEM = `You read three independent AI employee designs for one guest and recommend the one most likely to serve them. You see all three; the designers did not.
Prefer a design that is feasible. Tie every reason to the guest's evidence (cite ids like e1). Say honestly what is still unknown.
Reply with JSON only: {"designId":"...","madeBy":"system, after reading all three designs","reasons":["..."],"caveats":["..."]}`;

export async function recommend(
  llm: Complete,
  profile: GuestProfile,
  designs: Design[],
): Promise<BlueprintSet["recommendation"]> {
  const feasible = designs.filter((d) => d.fitCheck.status === "feasible");
  const fallback = fallbackRecommendation(designs);
  try {
    const user = [
      "Evidence:",
      ...evidenceFrom(profile).map(
        (e) => `- ${e.id} [${e.provenance}] ${e.fact}`,
      ),
      "Designs:",
      JSON.stringify(
        designs.map((d) => ({
          id: d.id,
          name: d.name,
          autonomy: d.autonomyLevel,
          scope: d.scope,
          fit: d.fitCheck.status,
          gaps: d.fitCheck.gaps,
          alone: d.autonomyAndApprovals.alone,
          needsApproval: d.autonomyAndApprovals.needsApproval,
          expected: d.expectedOutcome.estimate,
          risks: d.risks,
        })),
      ),
    ].join("\n");
    const r = checkRecommendation(
      extractJson(await llm(RECOMMEND_SYSTEM, user)),
    );
    if (!r.ok) return fallback;
    const chosen = designs.find((d) => d.id === r.value.designId);
    // The recommendation must be a real design, and feasible when one exists.
    if (
      !chosen ||
      (feasible.length > 0 && chosen.fitCheck.status !== "feasible")
    )
      return fallback;
    return r.value;
  } catch {
    return fallback;
  }
}

/** Used when the recommending step fails or picks something unusable. */
export function fallbackRecommendation(
  designs: Design[],
): BlueprintSet["recommendation"] {
  const feasible = designs.filter((d) => d.fitCheck.status === "feasible");
  const rank = { medium: 0, low: 1, high: 2 } as const;
  const pool = feasible.length ? feasible : designs;
  const pick = [...pool].sort(
    (a, b) => rank[a.autonomyLevel] - rank[b.autonomyLevel],
  )[0];
  return {
    designId: pick.id,
    madeBy:
      "system, rule-based fallback (the recommending step was unavailable)",
    reasons: [
      feasible.length
        ? "It can be built from vetted capabilities and balances time saved against risk."
        : "No design is fully feasible with vetted capabilities today; this is the closest.",
    ],
    caveats: [
      "Chosen by a simple rule, not by reading the guest's evidence. The FDE should check it.",
    ],
  };
}

export interface BuildInput {
  profile: GuestProfile;
  problem: string;
  hoursLostPerWeek: number;
  catalog?: Capability[];
  allowUnvetted?: boolean;
}

export type BuildResult =
  { ok: true; set: BlueprintSet } | { ok: false; errors: string[] };

/**
 * Three designs generated in parallel and independently, then a separate step
 * that reads all three and flags a recommendation (ticket A4).
 */
export async function buildBlueprintSet(
  llm: Complete,
  input: BuildInput,
): Promise<BuildResult> {
  const catalog = input.catalog ?? CATALOG;
  const allow = input.allowUnvetted ?? false;
  const results = await Promise.all(
    VARIANTS.map((v) =>
      generateDesign(
        llm,
        input.profile,
        catalog,
        v,
        input.problem,
        input.hoursLostPerWeek,
        allow,
      ),
    ),
  );
  const failures = results.flatMap((r, i) =>
    r.ok ? [] : [`${VARIANTS[i].id}: ${r.errors.slice(0, 3).join("; ")}`],
  );
  if (failures.length) return { ok: false, errors: failures };
  const designs = results.map((r) => (r as { ok: true; value: Design }).value);
  const recommendation = await recommend(llm, input.profile, designs);
  const evidence = evidenceFrom(input.profile);
  const conf = confidenceFrom(input.profile.facts.map((f) => f.provenance));
  const set: BlueprintSet = {
    blueprintVersion: "0.2-draft",
    status: "designed-not-deployed",
    guest: input.profile.guest,
    evidence,
    valueAssessment: {
      problem: input.problem,
      hoursLostPerWeek: input.hoursLostPerWeek,
      rule: "estimated hours lost multiplied by confidence in the facts behind them",
      confidence: `${confidenceLabel(conf)} (${conf}) from how well the facts are backed`,
      dollarEstimate: null,
      dollarEstimateReason:
        "No hourly value or conversion rate was confirmed, so no dollar figure is claimed.",
    },
    runtimeDefaults: {
      harness: "pi",
      host: "the employee runtime machine, kept separate from the event app",
      runMode:
        "one headless pi run per routine (pi -p), started by a systemd timer",
      isolation: "one unix user per employee",
      secrets: "environment file on the host; never stored in this file",
      toolAllowlist: "set per routine with --tools",
    },
    designs,
    recommendation,
    fdeChoice: null,
    fdeChoiceReason: null,
    capabilityCatalog: catalog,
  };
  const check = checkBlueprintSet(set);
  return check.ok
    ? { ok: true, set }
    : { ok: false, errors: check.errors.slice(0, 5) };
}
