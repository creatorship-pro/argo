import example from "../../../docs/examples/hvac-followup/blueprints.json";
import type { BlueprintSet } from "./types";

/**
 * Stands in for the model when no key is set: the worked example from
 * docs/examples, relabeled for the real guest. Its content is about a
 * fictional heating company, so the note says plainly that it is a stand-in.
 */
export function stubBlueprintSet(guest: {
  id: string;
  name: string;
  business: string;
}): BlueprintSet {
  const base = JSON.parse(JSON.stringify(example)) as BlueprintSet;
  return {
    ...base,
    note: "STAND-IN: generated without a model key from the worked example. Not about this guest's business.",
    guest: { id: guest.id, name: guest.name, business: guest.business },
  };
}
