# AI employee blueprint format

The blueprint is the file Argo's builder (A4) writes each AI employee design in. The same file feeds the FDE review screen, the proposal page (E1) and the guest's free takeaway. The format is [`schema.json`](schema.json) (JSON Schema, draft 2020-12). A worked example is in [`../examples/hvac-followup/`](../examples/hvac-followup/).

**Every employee is designed, not deployed.** A blueprint never switches anything on, never contains credentials, and never promises that it deploys a working agent.

## What is in a blueprint set

| Section                       | What it holds                                                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `guest`, `evidence`           | Who it is for, and the facts the designs rely on. Each fact says who said it: `said`, `read-back-confirmed`, `inferred` or `fde-approved`. Only `read-back-confirmed` is a guest-confirmed fact. |
| `valueAssessment`             | The problem and the hours lost. A dollar figure is `null` unless the facts support it, and then a reason is required.                                                                            |
| `runtimeDefaults`             | Where employees run: pi, one headless run per routine, one unix user each, secrets on the host.                                                                                                  |
| `designs[]`                   | Three designs for the guest's highest-value problem (the format only requires at least one). Details below.                                                                                      |
| `recommendation`, `fdeChoice` | The system's pick and why, then the FDE's choice.                                                                                                                                                |
| `capabilityCatalog[]`         | The capability entries the designs use, by id.                                                                                                                                                   |

Each **design** has: role, model, skills, tools, memory, routines, autonomy and approvals, expected outcome, access needed, fit check, risks, data retention, a pause switch, an approval channel, a cost estimate and acceptance checks.

## Rules the schema enforces

- **A why on every choice.** The model and each skill and tool carry a `why`. The model and each skill must cite at least one evidence id.
- **Tools are capability ids** such as `email.drafts`, never vendor names. A design that needs an id that is not vetted is `blocked` and must list the gaps and a fallback.
- **Limits are enforced in code.** `autonomyAndApprovals.enforcedInCode` must list at least one limit that a script or a capability's access level enforces, not only the prompt.
- **Estimates are never guarantees.** `expectedOutcome.notAGuarantee` must be `true`, with stated assumptions.
- **Cost is measured, not guessed.** `costEstimate.monthly` can only be a number once `status` is `measured`.
- **Memory is split in three:** instructions (humans edit), state (written only through a script), notes (humans edit; the employee may only propose additions).
- **Schedules are systemd `OnCalendar` expressions** with a separate time zone. The schema checks that they exist, not that systemd accepts them (ticket S6, later).

## Capability entries (for B1)

`$defs/capability` is an entry as used inside a blueprint. `$defs/vettedCapability` is what B1 writes: it also requires what the entry connects to, its permissions, its risk and its license. An agent writes entries as `status: "draft"` with `reviewedBy` and `reviewedOn` empty. A human reviews each one and only then sets `status: "vetted"`, which requires a reviewer, a date and a pinned version.

## Checking a file

```ts
import {
  checkBlueprintSet,
  checkVettedCapability,
} from "@/lib/blueprint/validate";
```

Both return `{ ok: true, value }` or `{ ok: false, errors }`. These are shape checks only. They do not yet check that every evidence id, capability id and design id that a blueprint refers to exists.

## The takeaway README

The guest gets the chosen design as a JSON file plus a plain-language README. The README follows the order in the worked example and uses no jargon:

1. What this is (one sentence, and that nothing has been built or switched on)
2. What it would do
3. What it will always bring to you instead of acting
4. What it will never do
5. How you stay in control (approvals, limits enforced in code, the pause switch, your data)
6. How much time it might save (an estimate with its assumptions, never a promise)
7. What it would need from you
8. What you are getting today
9. Other options considered

## Not yet verified

- The mapping to pi (model setting, skills, tool allowlist, context files, headless run modes) comes from the ticket and has not been checked against pi's current docs.
- `routine.session` allows `none`, `continue-latest` and `named:<name>`. Only `none` appears in the example. The other two are a proposal based on pi's session options.
