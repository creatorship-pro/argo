import { describeCalendar } from "./calendar";
import { findDesign, chosenDesign } from "./view";
import type { BlueprintSet, Capability, Design } from "../blueprint/types";

export interface Takeaway {
  /** `ai-employee.json`. A single design plus what it needs. No credentials. */
  json: string;
  /** `README.md`. Plain words for the owner. */
  readme: string;
  jsonFilename: string;
  readmeFilename: string;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "ai-employee";

export function buildTakeaway(
  set: BlueprintSet,
  designId?: string | null,
): Takeaway | null {
  const d = findDesign(set, designId) ?? chosenDesign(set);
  if (!d) return null;
  const used = d.tools
    .map((t) => set.capabilityCatalog.find((c) => c.id === t.capability))
    .filter((c): c is Capability => !!c)
    .map((c) => ({
      id: c.id,
      vendor: c.vendor,
      kind: c.kind,
      access: c.access,
      pinnedVersion: c.pinnedVersion,
      vetted: c.vetted,
    }));
  const file = {
    format: "argo-ai-employee-blueprint",
    blueprintVersion: set.blueprintVersion,
    status: "designed-not-deployed",
    notice:
      "This file is a design. It does not switch anything on and it does not deploy a working agent. It can be given to Claude, pi or a developer as a build spec.",
    designedFor: { business: set.guest.business },
    runtime: set.runtimeDefaults,
    design: d,
    capabilitiesUsed: used,
    credentials: "None. Credentials are never stored in this file.",
  };
  return {
    json: JSON.stringify(file, null, 2) + "\n",
    readme: buildReadme(set, d),
    jsonFilename: `${slug(set.guest.business)}-${d.id}.json`,
    readmeFilename: "README.md",
  };
}

const bullets = (xs: string[]) =>
  xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- (none)";

function buildReadme(set: BlueprintSet, d: Design): string {
  const routines = d.routines.map(
    (r) =>
      `- **${r.name}**, ${describeCalendar(r.schedule.calendar)} (${r.schedule.timeZone}).`,
  );
  const others = set.designs
    .filter((x) => x.id !== d.id)
    .map(
      (x) =>
        `- **${x.name}.** ${x.scope}${x.fitCheck.status === "blocked" ? " It needs connections we do not yet support." : ""}`,
    );
  return `# Your ${d.name.toLowerCase()}

*A design for ${set.guest.business}. It is a design only: nothing has been built or switched on.*

## What this is

${d.role.objective}

## What it would do

${bullets(routines)}

On its own it can:

${bullets(d.autonomyAndApprovals.alone)}

## What it brings to you instead of acting

${bullets(d.autonomyAndApprovals.needsApproval)}

## What it will never do

${bullets(d.autonomyAndApprovals.never)}

## How you stay in control

- **Limits that cannot be skipped.** These are enforced by a small program, not left to the AI's judgment:
${d.autonomyAndApprovals.enforcedInCode.map((x) => `  - ${x}`).join("\n")}
- **Approvals.** ${d.approvalChannel.how}
- **A pause switch.** ${d.pauseSwitch.how}
- **Your data.** ${d.dataRetention.default}

## How much time it might save

We estimate **${d.expectedOutcome.estimate}** (${d.expectedOutcome.metric}). This is an estimate, not a promise. It assumes:

${bullets(d.expectedOutcome.assumptions)}

## What it would need from you

${bullets(d.accessNeeded.map((a) => `${a.system}: ${a.permission}${a.note ? ` (${a.note})` : ""}`))}

## What you are getting

- This design, and the file next to it (\`${slug(set.guest.business)}-${d.id}.json\`) that spells out every choice and the reason for it.
- You can hand that file to Claude, to pi, or to us, as the plan for building this employee.
- It does not switch anything on, and it does not contain any passwords or keys. Building and running it is a separate step.

## Intended runtime and setup

- It is designed to run on **pi**, a coding-agent harness, on a server, with each routine started by a system timer.
- Setup, in order: (1) choose a host and a dedicated user for it; (2) put credentials in an environment file on that host, never in the design file; (3) install the connections listed in \`capabilitiesUsed\`; (4) create one timer per routine; (5) run the acceptance checks in the file before turning anything on.

## Acceptance checks

${bullets(d.acceptanceChecks)}

## Other options we considered

${others.join("\n") || "- (none)"}
`;
}
