import { describe, expect, it } from "vitest";
import {
  approveFact,
  confirmedAnchors,
  isConfirmed,
  lockReadBack,
  normalizeProposal,
  readiness,
  type ProfileFact,
} from "./facts";

const fact = (over: Partial<ProfileFact> = {}): ProfileFact => ({
  id: "f1",
  text: "Chases invoices about ten hours a week",
  provenance: "inferred",
  quote: null,
  checklistKey: "duration",
  lockedAt: null,
  ...over,
});

describe("agent proposals", () => {
  it("never arrive confirmed", () => {
    for (const label of ["read-back-confirmed", "fde-approved", "bogus"]) {
      expect(
        normalizeProposal({ text: "x", provenance: label })?.provenance,
      ).toBe("inferred");
    }
  });
  it("keep `said` only with a quote", () => {
    expect(
      normalizeProposal({ text: "x", provenance: "said", quote: "I said so" })
        ?.provenance,
    ).toBe("said");
    expect(
      normalizeProposal({ text: "x", provenance: "said", quote: "  " })
        ?.provenance,
    ).toBe("inferred");
  });
  it("drop empty text and unknown checklist keys", () => {
    expect(
      normalizeProposal({ text: "  ", provenance: "said", quote: "q" }),
    ).toBeNull();
    expect(
      normalizeProposal({
        text: "x",
        provenance: "said",
        quote: "q",
        checklistKey: "nope",
      })?.checklistKey,
    ).toBeNull();
  });
});

describe("read-back lock", () => {
  it("turns an inferred draft into a confirmed fact in the FDE's wording", () => {
    const r = lockReadBack(fact(), "About ten hours a week on follow-ups", 100);
    expect(r.ok && r.fact.provenance).toBe("read-back-confirmed");
    expect(r.ok && r.fact.text).toBe("About ten hours a week on follow-ups");
    expect(r.ok && r.fact.lockedAt).toBe(100);
  });
  it("keeps the draft wording when the FDE does not edit it", () => {
    const r = lockReadBack(fact(), undefined, 5);
    expect(r.ok && r.fact.text).toBe("Chases invoices about ten hours a week");
  });
  it("refuses an empty read-back", () => {
    expect(lockReadBack(fact(), "   ", 5).ok).toBe(false);
  });
});

describe("what counts as confirmed", () => {
  it("excludes inferred and said, includes locked and approved", () => {
    expect(isConfirmed("inferred")).toBe(false);
    expect(isConfirmed("said")).toBe(false);
    expect(isConfirmed("read-back-confirmed")).toBe(true);
    expect(isConfirmed("fde-approved")).toBe(true);
  });
  it("shows only confirmed facts as anchors", () => {
    const facts = [
      fact({ id: "a" }),
      approveFact(fact({ id: "b" }), 1),
      fact({ id: "c", provenance: "said", quote: "q" }),
    ];
    expect(confirmedAnchors(facts).map((f) => f.id)).toEqual(["b"]);
  });
});

describe("deck readiness", () => {
  it("is not ready while items are only inferred", () => {
    const r = readiness([fact({ checklistKey: "problem" })]);
    expect(r.ready).toBe(false);
    expect(r.missing).toContain("problem");
  });
  it("is ready when every item has a said or confirmed fact", () => {
    const keys = [
      "problem",
      "frequency",
      "duration",
      "who",
      "cost",
      "tools",
      "constraints",
      "success",
    ] as const;
    const facts = keys.map((k, i) =>
      fact({ id: String(i), checklistKey: k, provenance: "said", quote: "q" }),
    );
    expect(readiness(facts).ready).toBe(true);
  });
});
