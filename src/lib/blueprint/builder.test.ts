import { describe, expect, it } from "vitest";
import example from "../../../docs/examples/hvac-followup/blueprints.json";
import {
  buildBlueprintSet,
  fitCheck,
  VARIANTS,
  type Complete,
  type GuestProfile,
} from "./builder";
import { CATALOG } from "./catalog";
import { chooseProblem } from "./problem";
import { checkBlueprintSet } from "./validate";
import { confidenceFrom, pickProblem } from "./value";
import { stubBlueprintSet } from "./stub";
import type { BlueprintSet, Capability, Design } from "./types";

const ex = example as unknown as BlueprintSet;
const profile: GuestProfile = {
  guest: { id: "g1", name: "Dana", business: "Eastgate Heating & Air" },
  facts: ex.evidence.map((e) => ({
    id: e.id,
    text: e.fact,
    provenance: e.provenance,
    quote: e.quote,
  })),
};

/** A fake model: answers each step from the worked example. */
function fakeLlm(log: { system: string; user: string }[] = []): Complete {
  return async (system, user) => {
    log.push({ system, user });
    const m = user.match(/Design id: "(d\d)"/);
    if (m) {
      const design = ex.designs.find((d) => d.id.startsWith(m[1]))!;
      return "```json\n" + JSON.stringify(design) + "\n```";
    }
    return JSON.stringify(ex.recommendation);
  };
}

// The example's catalog marks six entries vetted and two not.
const exampleCatalog = ex.capabilityCatalog as Capability[];

describe("fit check", () => {
  const d3 = ex.designs[2] as Design;
  it("flags a capability that is not on the vetted list", () => {
    const fit = fitCheck(d3, exampleCatalog);
    expect(fit.status).toBe("blocked");
    expect(fit.gaps.map((g) => g.capability).sort()).toEqual([
      "accounting.paylinks",
      "crm.write",
    ]);
    expect(fit.gapsLoggedForB1).toBe(true);
  });
  it("flags an id that is missing from the list altogether", () => {
    const d = {
      ...ex.designs[0],
      tools: [{ capability: "nope.thing", why: "needed" }],
    } as Design;
    expect(fitCheck(d, exampleCatalog).gaps[0]).toMatchObject({
      capability: "nope.thing",
      vetted: false,
    });
  });
  it("passes a design that uses only vetted capabilities", () => {
    expect(fitCheck(ex.designs[0] as Design, exampleCatalog).status).toBe(
      "feasible",
    );
  });
  it("blocks everything while the real six are still unreviewed drafts", () => {
    expect(CATALOG.every((c) => !c.vetted)).toBe(true);
    expect(fitCheck(ex.designs[0] as Design, CATALOG).status).toBe("blocked");
  });
  it("can allow drafts for a rehearsal, and only then", () => {
    expect(fitCheck(ex.designs[0] as Design, CATALOG, true).status).toBe(
      "feasible",
    );
  });
});

describe("blueprint builder", () => {
  it("makes three independent designs that validate, then a recommendation", async () => {
    const log: { system: string; user: string }[] = [];
    const r = await buildBlueprintSet(fakeLlm(log), {
      profile,
      problem: "Chasing quotes",
      hoursLostPerWeek: 10,
      catalog: exampleCatalog,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.set.designs.map((d) => d.autonomyLevel)).toEqual([
      "low",
      "medium",
      "high",
    ]);
    expect(checkBlueprintSet(r.set).ok).toBe(true);
    // Independence: each design prompt names only its own variant.
    const designPrompts = log.filter((l) => /Design id:/.test(l.user));
    expect(designPrompts).toHaveLength(3);
    for (const [i, p] of designPrompts.entries()) {
      for (const other of VARIANTS.filter((_, j) => j !== i)) {
        expect(p.user).not.toContain(`Design id: "${other.id}"`);
      }
    }
    // The recommending step runs separately and sees all three.
    const rec = log.find((l) => l.system.includes("three independent"))!;
    for (const d of r.set.designs) expect(rec.user).toContain(d.id);
  });
  it("starts with the FDE choice empty", async () => {
    const r = await buildBlueprintSet(fakeLlm(), {
      profile,
      problem: "p",
      hoursLostPerWeek: 10,
      catalog: exampleCatalog,
    });
    expect(r.ok && r.set.fdeChoice).toBeNull();
  });
  it("marks a design with a missing connection as no good fit", async () => {
    const r = await buildBlueprintSet(fakeLlm(), {
      profile,
      problem: "p",
      hoursLostPerWeek: 10,
      catalog: exampleCatalog,
    });
    expect(r.ok && r.set.designs[2].fitCheck.status).toBe("blocked");
  });
  it("overrules a model that claims a blocked design is feasible", async () => {
    const lying: Complete = async (s, u) => {
      const m = u.match(/Design id: "(d\d)"/);
      if (m) {
        const d = JSON.parse(
          JSON.stringify(ex.designs.find((x) => x.id.startsWith(m[1]))),
        );
        d.fitCheck = { status: "feasible", gaps: [] };
        return JSON.stringify(d);
      }
      return JSON.stringify(ex.recommendation);
    };
    const r = await buildBlueprintSet(lying, {
      profile,
      problem: "p",
      hoursLostPerWeek: 10,
      catalog: exampleCatalog,
    });
    expect(r.ok && r.set.designs[2].fitCheck.status).toBe("blocked");
  });
  it("falls back to a rule when the recommending step picks a blocked design", async () => {
    const llm: Complete = async (s, u) => {
      const m = u.match(/Design id: "(d\d)"/);
      if (m)
        return JSON.stringify(ex.designs.find((x) => x.id.startsWith(m[1])));
      return JSON.stringify({ ...ex.recommendation, designId: "d3-lead" });
    };
    const r = await buildBlueprintSet(llm, {
      profile,
      problem: "p",
      hoursLostPerWeek: 10,
      catalog: exampleCatalog,
    });
    expect(r.ok && r.set.recommendation.designId).not.toBe("d3-lead");
    expect(r.ok && r.set.recommendation.madeBy).toMatch(/fallback/);
  });
  it("retries once with the errors, then gives up cleanly", async () => {
    let calls = 0;
    const bad: Complete = async (s, u) => {
      if (u.includes('Design id: "d1"')) {
        calls += 1;
        return '{"nope":true}';
      }
      const m = u.match(/Design id: "(d\d)"/);
      return m
        ? JSON.stringify(ex.designs.find((x) => x.id.startsWith(m[1])))
        : JSON.stringify(ex.recommendation);
    };
    const r = await buildBlueprintSet(bad, {
      profile,
      problem: "p",
      hoursLostPerWeek: 10,
      catalog: exampleCatalog,
    });
    expect(r.ok).toBe(false);
    expect(calls).toBe(2);
  });
  it("rejects a design that cites evidence the guest never gave", async () => {
    const llm: Complete = async (s, u) => {
      const m = u.match(/Design id: "(d\d)"/);
      if (!m) return JSON.stringify(ex.recommendation);
      const d = JSON.parse(
        JSON.stringify(ex.designs.find((x) => x.id.startsWith(m[1]))),
      );
      d.model.evidence = ["e99"];
      return JSON.stringify(d);
    };
    const r = await buildBlueprintSet(llm, {
      profile,
      problem: "p",
      hoursLostPerWeek: 10,
      catalog: exampleCatalog,
    });
    expect(r.ok).toBe(false);
  });
});

describe("value rule: hours times confidence", () => {
  it("scores backed facts above guesses", () => {
    expect(confidenceFrom(["read-back-confirmed"])).toBe(1);
    expect(confidenceFrom(["inferred"])).toBeLessThan(confidenceFrom(["said"]));
    expect(confidenceFrom([])).toBe(0);
  });
  it("gates out infeasible problems, then takes the highest value", () => {
    const pick = pickProblem([
      {
        title: "big but impossible",
        hoursLostPerWeek: 40,
        evidenceProvenance: ["read-back-confirmed"],
        feasible: false,
      },
      {
        title: "guess",
        hoursLostPerWeek: 12,
        evidenceProvenance: ["inferred"],
        feasible: true,
      },
      {
        title: "solid",
        hoursLostPerWeek: 6,
        evidenceProvenance: ["read-back-confirmed"],
        feasible: true,
      },
    ]);
    expect(pick?.title).toBe("solid");
  });
  it("returns nothing when no problem can be designed", () => {
    expect(
      pickProblem([
        {
          title: "x",
          hoursLostPerWeek: 5,
          evidenceProvenance: ["said"],
          feasible: false,
        },
      ]),
    ).toBeNull();
  });
  it("picks the problem through the model, with the gate applied", async () => {
    const llm: Complete = async () =>
      JSON.stringify([
        {
          title: "Needs an unvetted tool",
          hoursLostPerWeek: 30,
          evidence: ["e1"],
          capabilities: ["crm.write"],
        },
        {
          title: "Chasing quotes",
          hoursLostPerWeek: 10,
          evidence: ["e1"],
          capabilities: ["email.drafts"],
        },
      ]);
    const p = await chooseProblem(llm, profile, exampleCatalog);
    expect(p?.title).toBe("Chasing quotes");
    expect(
      p?.considered.find((c) => c.title.startsWith("Needs"))?.feasible,
    ).toBe(false);
  });
});

describe("stand-in set (no model key)", () => {
  it("validates, is labeled, and carries the real guest", () => {
    const s = stubBlueprintSet({
      id: "g9",
      name: "Sam",
      business: "Sam's Shop",
    });
    expect(checkBlueprintSet(s).ok).toBe(true);
    expect(s.note).toMatch(/STAND-IN/);
    expect(s.guest.name).toBe("Sam");
  });
});
