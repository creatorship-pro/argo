import { extractJson } from "../llm";
import type { Complete, GuestProfile } from "./builder";
import { evidenceFrom } from "./builder";
import { CATALOG, isUsable } from "./catalog";
import { pickProblem, type Candidate } from "./value";
import type { Capability } from "./types";

const SYSTEM = `You read what a business owner told an FDE and list the problems an AI employee could take on.
For each: a short title in the owner's words, estimated hours lost per week (use only numbers in the evidence; 0 if none), the evidence ids that support it, and the capability ids it would need from the catalog (use a plausible id such as "crm.write" if the catalog lacks it).
Reply with JSON only: [{"title":"...","hoursLostPerWeek":0,"evidence":["e1"],"capabilities":["email.drafts"]}]`;

export interface ChosenProblem {
  title: string;
  hoursLostPerWeek: number;
  /** Everything considered, with whether it passed the gate. */
  considered: { title: string; hoursLostPerWeek: number; feasible: boolean }[];
}

/** Gate on vetted capabilities, then rank by hours times confidence (A4). */
export async function chooseProblem(
  llm: Complete,
  profile: GuestProfile,
  catalog: Capability[] = CATALOG,
  allowUnvetted = false,
): Promise<ChosenProblem | null> {
  const evidence = evidenceFrom(profile);
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const user = [
    "Evidence:",
    ...evidence.map((e) => `- ${e.id} [${e.provenance}] ${e.fact}`),
    "Catalog ids: " + catalog.map((c) => c.id).join(", "),
  ].join("\n");
  const raw = extractJson(await llm(SYSTEM, user));
  if (!Array.isArray(raw)) return null;
  const usable = new Map(catalog.map((c) => [c.id, c]));
  const cands: (Candidate & { hours: number })[] = [];
  for (const item of raw) {
    if (!item || typeof item.title !== "string") continue;
    const refs: string[] = Array.isArray(item.evidence)
      ? item.evidence.filter((r: unknown) => typeof r === "string")
      : [];
    const prov = refs
      .map((r) => byId.get(r)?.provenance)
      .filter((p): p is NonNullable<typeof p> => !!p);
    const caps: string[] = Array.isArray(item.capabilities)
      ? item.capabilities
      : [];
    const hours = Number(item.hoursLostPerWeek);
    cands.push({
      title: item.title.trim(),
      hoursLostPerWeek: Number.isFinite(hours) && hours > 0 ? hours : 0,
      hours,
      evidenceProvenance: prov,
      feasible: caps.every((id) => isUsable(usable.get(id), allowUnvetted)),
    });
  }
  const best = pickProblem(cands);
  if (!best) return null;
  return {
    title: best.title,
    hoursLostPerWeek: best.hoursLostPerWeek,
    considered: cands.map((c) => ({
      title: c.title,
      hoursLostPerWeek: c.hoursLostPerWeek,
      feasible: c.feasible,
    })),
  };
}
