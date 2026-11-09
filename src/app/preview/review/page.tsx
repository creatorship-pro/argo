"use client";

import example from "../../../../docs/examples/hvac-followup/blueprints.json";
import { ReviewBoard } from "@/components/fde/ReviewScreen";
import type { BlueprintSet } from "@/lib/blueprint/types";

export default function PreviewReview() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 p-8 text-zinc-900">
      <h1 className="mt-1 text-4xl font-bold">Break review: Dana</h1>
      <ReviewBoard
        set={example as unknown as BlueprintSet}
        chosen={null}
        onChoose={() => {}}
      />
    </div>
  );
}
