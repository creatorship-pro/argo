import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import schema from "../../../docs/blueprint/schema.json";
import { checkBlueprintSet, checkVettedCapability } from "./validate";

const exampleDir = path.resolve(
  __dirname,
  "../../../docs/examples/hvac-followup",
);
// Loosely typed on purpose: the tests corrupt a copy of the example to check
// that the schema rejects it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadExample = (): Record<string, any> =>
  JSON.parse(readFileSync(path.join(exampleDir, "blueprints.json"), "utf8"));

const topRequired = schema.required;
const designRequired = schema.$defs.design.required;

describe("blueprint schema: the worked example", () => {
  it("validates, including the feasible designs and the blocked one", () => {
    const result = checkBlueprintSet(loadExample());
    expect(result).toEqual({ ok: true, value: expect.anything() });
    if (result.ok) {
      const statuses = result.value.designs.map((d) => d.fitCheck.status);
      expect(statuses).toEqual(["feasible", "feasible", "blocked"]);
    }
  });
});

describe("blueprint schema: required sections", () => {
  it.each(topRequired)("fails when top-level section %s is missing", (key) => {
    const doc = loadExample();
    delete doc[key];
    expect(checkBlueprintSet(doc).ok).toBe(false);
  });

  it.each(designRequired)("fails when a design is missing %s", (key) => {
    const doc = loadExample();
    delete doc.designs[0][key];
    expect(checkBlueprintSet(doc).ok).toBe(false);
  });

  it("fails when a typo adds an unknown section", () => {
    const doc = loadExample();
    doc.designs[0].autonomyAndApproval = {};
    expect(checkBlueprintSet(doc).ok).toBe(false);
  });
});

describe("blueprint schema: the rules that matter", () => {
  it("requires a why and evidence on the model choice", () => {
    const noWhy = loadExample();
    delete noWhy.designs[0].model.why;
    expect(checkBlueprintSet(noWhy).ok).toBe(false);

    const noEvidence = loadExample();
    noEvidence.designs[0].model.evidence = [];
    expect(checkBlueprintSet(noEvidence).ok).toBe(false);
  });

  it("never allows an outcome to be a guarantee", () => {
    const doc = loadExample();
    doc.designs[1].expectedOutcome.notAGuarantee = false;
    expect(checkBlueprintSet(doc).ok).toBe(false);
  });

  it("rejects a made-up provenance", () => {
    const doc = loadExample();
    doc.evidence[0].provenance = "guest-confirmed";
    expect(checkBlueprintSet(doc).ok).toBe(false);
  });

  it("requires a blocked design to name its gaps and a fallback", () => {
    const noGaps = loadExample();
    noGaps.designs[2].fitCheck.gaps = [];
    expect(checkBlueprintSet(noGaps).ok).toBe(false);

    const noFallback = loadExample();
    delete noFallback.designs[2].fitCheck.fallback;
    expect(checkBlueprintSet(noFallback).ok).toBe(false);
  });

  it("does not let a feasible design list gaps", () => {
    const doc = loadExample();
    doc.designs[0].fitCheck.gaps = [
      { capability: "crm.write", need: "x", vetted: false },
    ];
    expect(checkBlueprintSet(doc).ok).toBe(false);
  });

  it("only allows a monthly cost once it has been measured", () => {
    const guessed = loadExample();
    guessed.designs[0].costEstimate.monthly = 40;
    expect(checkBlueprintSet(guessed).ok).toBe(false);

    const measured = loadExample();
    measured.designs[0].costEstimate.monthly = 40;
    measured.designs[0].costEstimate.status = "measured";
    expect(checkBlueprintSet(measured).ok).toBe(true);
  });

  it("explains a missing dollar estimate instead of leaving it blank", () => {
    const doc = loadExample();
    doc.valueAssessment.dollarEstimateReason = null;
    expect(checkBlueprintSet(doc).ok).toBe(false);
  });

  it("refers to tools by capability id, not vendor name", () => {
    const doc = loadExample();
    doc.designs[0].tools[0].capability = "Gmail";
    expect(checkBlueprintSet(doc).ok).toBe(false);
  });
});

describe("capability entries (the shape B1 writes)", () => {
  const draft = {
    id: "email.drafts",
    vendor: "Gmail",
    kind: "mcp",
    access: "create drafts only",
    connectsTo: "The owner's Gmail account",
    permissions: ["gmail.compose"],
    risk: "low",
    license: "MIT",
    vetted: false,
    pinnedVersion: null,
    reviewedBy: null,
    reviewedOn: null,
    status: "draft",
  };

  it("accepts an agent-written draft with the reviewer left empty", () => {
    expect(checkVettedCapability(draft).ok).toBe(true);
  });

  it("requires a reviewer, date and pinned version once marked vetted", () => {
    expect(checkVettedCapability({ ...draft, status: "vetted" }).ok).toBe(
      false,
    );
    expect(
      checkVettedCapability({
        ...draft,
        status: "vetted",
        vetted: true,
        pinnedVersion: "1.2.0",
        reviewedBy: "Mezie",
        reviewedOn: "2026-11-12",
      }).ok,
    ).toBe(true);
  });

  it("requires permissions, risk and a license on a B1 entry", () => {
    for (const key of ["connectsTo", "permissions", "risk", "license"]) {
      const entry: Record<string, unknown> = { ...draft };
      delete entry[key];
      expect(checkVettedCapability(entry).ok).toBe(false);
    }
  });
});
