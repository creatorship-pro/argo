import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkBlueprintSet, checkVettedCapability } from "./validate";

const root = path.resolve(__dirname, "../../..");
const capabilityDir = path.join(root, "docs/capabilities");
const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));

const files = readdirSync(capabilityDir).filter((f) => f.endsWith(".json"));
const entries = files.map((f) => ({
  file: f,
  data: readJson(path.join(capabilityDir, f)),
}));

const example = readJson(
  path.join(root, "docs/examples/hvac-followup/blueprints.json"),
);

describe("vetted capability list (event one: the first six entries)", () => {
  it("has exactly the six entries the ticket names", () => {
    expect(entries.map((e) => e.data.id).sort()).toEqual(
      [
        "accounting.read",
        "calendar.book",
        "crm.read",
        "email.drafts",
        "email.send",
        "ledger.touch",
      ].sort(),
    );
  });

  it.each(entries)(
    "$file validates against the capability definition",
    ({ data }) => {
      const result = checkVettedCapability(data);
      expect(result).toEqual({ ok: true, value: expect.anything() });
    },
  );

  it.each(entries)("$file is named after its id", ({ file, data }) => {
    expect(file).toBe(`${data.id}.json`);
  });

  it.each(entries)(
    "$file leaves the human review fields empty until a person reviews it",
    ({ data }) => {
      // An agent writes drafts; only a human may mark an entry vetted.
      expect(data.status).toBe("draft");
      expect(data.vetted).toBe(false);
      expect(data.reviewedBy).toBeNull();
      expect(data.reviewedOn).toBeNull();
    },
  );

  it.each(entries)(
    "$file contains no credential-looking values",
    ({ file }) => {
      const text = readFileSync(path.join(capabilityDir, file), "utf8");
      expect(text).not.toMatch(
        /(sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN)/,
      );
    },
  );
});

describe("the worked example and the capability list agree", () => {
  it("still validates after pointing at the list", () => {
    expect(checkBlueprintSet(example).ok).toBe(true);
  });

  it("every capability the example's feasible designs use has an entry", () => {
    const listed = new Set(entries.map((e) => e.data.id));
    for (const design of example.designs) {
      if (design.fitCheck.status !== "feasible") continue;
      for (const tool of design.tools) {
        expect(listed.has(tool.capability), tool.capability).toBe(true);
      }
    }
  });

  it("the capabilities that block the third design are not on the list", () => {
    const listed = new Set(entries.map((e) => e.data.id));
    const blocked = example.designs.find(
      (d: { fitCheck: { status: string } }) => d.fitCheck.status === "blocked",
    );
    for (const gap of blocked.fitCheck.gaps) {
      expect(listed.has(gap.capability), gap.capability).toBe(false);
    }
  });
});
