import { describe, expect, it } from "vitest";
import example from "../../../docs/examples/hvac-followup/blueprints.json";
import { describeCalendar } from "./calendar";
import { buildTakeaway } from "./takeaway";
import { chosenDesign, proposalView, talkingPoints } from "./view";
import { OFFER, isPurchasable, priceSummary } from "./offer";
import { checkDesign } from "../blueprint/validate";
import type { BlueprintSet } from "../blueprint/types";

const set = example as unknown as BlueprintSet;

describe("plain-words schedules", () => {
  it.each([
    ["*-*-* 08:00:00", "every day at 8:00 am"],
    ["Mon..Fri *-*-* 17:30:00", "weekdays at 5:30 pm"],
    ["Fri *-*-* 16:00:00", "Friday at 4:00 pm"],
    ["Mon..Fri *-*-* *:0/15:00", "every 15 minutes on weekdays"],
    ["weird thing", "on a schedule"],
  ])("%s -> %s", (expr, words) => {
    expect(describeCalendar(expr)).toBe(words);
  });
  it("describes every routine in the example without falling back", () => {
    for (const d of set.designs)
      for (const r of d.routines)
        expect(describeCalendar(r.schedule.calendar)).not.toBe("on a schedule");
  });
});

describe("which design the guest sees", () => {
  it("is the recommendation until the FDE chooses", () => {
    expect(chosenDesign(set)?.id).toBe(set.recommendation.designId);
  });
  it("is the FDE's choice once made, even if it differs", () => {
    expect(chosenDesign({ ...set, fdeChoice: "d1-drafter" })?.id).toBe(
      "d1-drafter",
    );
  });
});

describe("proposal view", () => {
  const v = proposalView(set)!;
  it("shows what it does alone, what needs approval, and the estimate as an estimate", () => {
    expect(v.alone.length).toBeGreaterThan(0);
    expect(v.needsApproval.length).toBeGreaterThan(0);
    expect(v.outcome.note).toMatch(/not a promise/);
    expect(v.outcome.assumptions.length).toBeGreaterThan(0);
  });
  it("gives a numbered-list worth of steps, ending in the outcome", () => {
    expect(v.steps.length).toBeGreaterThanOrEqual(3);
    expect(v.steps.at(-1)).toMatch(/estimate/);
  });
  it("quotes the owner only from facts they said or confirmed", () => {
    expect(v.problemInTheirWords.length).toBeGreaterThan(0);
    const inferred = new Set(
      set.evidence
        .filter((e) => e.provenance === "inferred")
        .map((e) => e.fact),
    );
    for (const p of v.problemInTheirWords)
      expect(inferred.has(p.text)).toBe(false);
  });
  it("lists the other designs and marks blocked ones", () => {
    expect(v.others.find((o) => o.id === "d3-lead")?.blocked).toBe(true);
  });
  it("gives talking points as guidance for the FDE", () => {
    expect(talkingPoints(set)).toHaveLength(4);
  });
});

describe("free takeaway", () => {
  const t = buildTakeaway(set)!;
  const file = JSON.parse(t.json);
  it("exports one design that validates against the blueprint format", () => {
    expect(checkDesign(file.design).ok).toBe(true);
  });
  it("is labeled as a design, never a deployment", () => {
    expect(file.status).toBe("designed-not-deployed");
    expect(file.notice).toMatch(/does not deploy/);
    expect(t.readme).toMatch(/nothing has been built or switched on/i);
  });
  it("carries no credentials", () => {
    expect(t.json).not.toMatch(
      /sk_(live|test)_|api[_-]?key"\s*:\s*"[A-Za-z0-9]{12,}|Bearer /i,
    );
    expect(file.credentials).toMatch(/never stored/);
  });
  it("has a README a non-technical owner can follow", () => {
    for (const h of [
      "What it would do",
      "What it will never do",
      "How much time it might save",
      "What it would need from you",
      "Intended runtime",
    ]) {
      expect(t.readme).toContain(h);
    }
    expect(t.readme).toMatch(/not a promise/);
  });
  it("lists only capabilities the design actually uses", () => {
    const ids = file.capabilitiesUsed.map((c: { id: string }) => c.id);
    const d = chosenDesign(set)!;
    expect(ids.sort()).toEqual(
      d.tools
        .map((x) => x.capability)
        .filter((id) => set.capabilityCatalog.some((c) => c.id === id))
        .sort(),
    );
  });
});

describe("offer", () => {
  it("is a placeholder until D4, E4 and E5 land, and cannot be bought", () => {
    expect(OFFER.placeholder).toBe(true);
    expect(isPurchasable(OFFER)).toBe(false);
  });
  it("sums one-time and recurring separately", () => {
    expect(
      priceSummary({
        ...OFFER,
        implementation: { ...OFFER.implementation, amountCents: 100 },
        monitoring: {
          name: "m",
          amountCents: 50,
          interval: "month",
          description: "",
        },
      }),
    ).toEqual({ oneTime: 100, recurring: 50 });
  });
});
