import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import example from "../../../docs/examples/hvac-followup/blueprints.json";
import { OFFER } from "@/lib/proposal/offer";
import { proposalView } from "@/lib/proposal/view";
import type { BlueprintSet } from "@/lib/blueprint/types";
import { ProposalPage } from "./ProposalPage";

const set = example as unknown as BlueprintSet;

function render(extra: Partial<Parameters<typeof ProposalPage>[0]> = {}) {
  return renderToStaticMarkup(
    <ProposalPage
      guestName="Dana"
      business="Eastgate Heating & Air"
      view={proposalView(set)!}
      offer={{ ...OFFER, purchasable: false }}
      readyBy={Date.UTC(2026, 11, 17)}
      downloads={{
        json: "/p/t/takeaway/ai-employee.json",
        readme: "/p/t/takeaway/README.md",
      }}
      action={<button>Buy</button>}
      {...extra}
    />,
  );
}

describe("proposal page (what the owner sees on their phone)", () => {
  const html = render();
  it("has every section the ticket asks for", () => {
    for (const h of [
      "The problem, in your words",
      "What it does on its own",
      "What it brings to you first",
      "What it will never do",
      "How it works, step by step",
      "What it might save you",
      "What we would need from you",
      "Other options we considered",
      "Yours to keep, free",
      "Price and terms",
    ]) {
      expect(html).toContain(h);
    }
  });
  it("shows the problem in the owner's own words", () => {
    expect(html).toContain("ten hours a week, easy");
  });
  it("shows the estimate as an estimate, with assumptions", () => {
    expect(html).toMatch(/not a promise/);
    expect(html).toContain("This assumes:");
  });
  it("carries the free downloads and the buy action in a bar at the bottom", () => {
    expect(html).toContain("/p/t/takeaway/ai-employee.json");
    expect(html).toContain("/p/t/takeaway/README.md");
    expect(html).toContain("Buy");
  });
  it("says plainly when the prices are placeholders", () => {
    expect(html).toContain("Placeholder prices and terms");
    expect(html).toContain("Price to be set");
  });
  it("never shows the FDE's evidence panel or talking points to the owner", () => {
    expect(html).not.toMatch(/the guest does not see this/i);
    expect(html).not.toMatch(/inferred by the agent/i);
  });
  it("shows the FDE extras only when they are passed in", () => {
    expect(render({ fdeExtras: <aside>FDE ONLY</aside> })).toContain(
      "FDE ONLY",
    );
  });
});
