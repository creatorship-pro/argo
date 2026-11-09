import { confirmedAnchors, isConfirmed, type ProfileFact } from "./facts";

/**
 * How the FDE screen groups the profile:
 * - anchors: confirmed facts only (the breadcrumb at the top)
 * - drafts: what the agent proposed or the guest said, not yet read back.
 *   Each stays visibly marked as inferred or said.
 * - locked: the confirmed list, for "earlier context on demand".
 */
export function partitionFacts(facts: ProfileFact[]) {
  const anchors = confirmedAnchors(facts);
  const drafts = facts.filter((f) => !isConfirmed(f.provenance));
  // Said facts are the best candidates for a read-back, so they come first.
  drafts.sort(
    (a, b) => Number(b.provenance === "said") - Number(a.provenance === "said"),
  );
  return { anchors, drafts, locked: anchors };
}
