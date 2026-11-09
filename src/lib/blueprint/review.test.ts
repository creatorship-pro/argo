import { describe, expect, it } from "vitest";
import example from "../../../docs/examples/hvac-followup/blueprints.json";
import { canChoose, designBrief, evidenceFor, recordChoice } from "./review";
import type { BlueprintSet } from "./types";

const set = example as unknown as BlueprintSet;

describe("choosing among the three designs", () => {
  it("lets the FDE pick a feasible design, even against the recommendation", () => {
    const c = recordChoice(set, "d1-drafter");
    expect(c).toEqual({
      designId: "d1-drafter",
      recommendedId: "d2-coordinator",
      differs: true,
    });
  });
  it("marks agreement with the recommendation", () => {
    expect(recordChoice(set, "d2-coordinator")?.differs).toBe(false);
  });
  it("refuses a blocked design and an unknown one", () => {
    expect(canChoose(set.designs[2])).toBe(false);
    expect(recordChoice(set, "d3-lead")).toBeNull();
    expect(recordChoice(set, "nope")).toBeNull();
  });
});

describe("review screen content", () => {
  it("flags the recommended design and lists what a blocked one is missing", () => {
    const briefs = set.designs.map((d) => designBrief(set, d));
    expect(briefs.filter((b) => b.recommended).map((b) => b.id)).toEqual([
      "d2-coordinator",
    ]);
    expect(briefs[2].missing.sort()).toEqual([
      "accounting.paylinks",
      "crm.write",
    ]);
  });
  it("is short enough to compare quickly", () => {
    for (const d of set.designs) {
      const b = designBrief(set, d);
      expect(b.alone.length).toBeLessThanOrEqual(3);
      expect(b.approval.length).toBeLessThanOrEqual(2);
    }
  });
  it("shows the evidence a design cites, with whether it was said, inferred or confirmed", () => {
    const ev = evidenceFor(set, set.designs[1]);
    expect(ev.length).toBeGreaterThan(0);
    for (const e of ev)
      expect([
        "said",
        "inferred",
        "read-back-confirmed",
        "fde-approved",
      ]).toContain(e.provenance);
  });
});
