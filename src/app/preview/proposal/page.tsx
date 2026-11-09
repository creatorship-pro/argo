import example from "../../../../docs/examples/hvac-followup/blueprints.json";
import { ProposalPage } from "@/components/proposal/ProposalPage";
import { BuyButton } from "@/components/proposal/BuyButton";
import { OFFER } from "@/lib/proposal/offer";
import { proposalView } from "@/lib/proposal/view";
import type { BlueprintSet } from "@/lib/blueprint/types";

export default function PreviewProposal() {
  const set = example as unknown as BlueprintSet;
  return (
    <ProposalPage
      guestName="Dana"
      business="Eastgate Heating & Air"
      view={proposalView(set)!}
      offer={{ ...OFFER, purchasable: false }}
      readyBy={Date.UTC(2026, 11, 17)}
      downloads={{ json: "#", readme: "#" }}
      action={<BuyButton token="preview" purchasable={false} />}
    />
  );
}
