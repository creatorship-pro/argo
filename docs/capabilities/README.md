# Vetted capability list

The parts the blueprint builder (A4) is allowed to use. One JSON file per entry, named after its id, in the format `$defs/vettedCapability` in [`../blueprint/schema.json`](../blueprint/schema.json). Blueprints refer to entries by id (for example `email.drafts`), never by vendor name. An id that is missing from this folder means "no good fit".

**Status of every entry today: `draft`.** An agent wrote these from the vendors' own repositories and docs. A human has not reviewed any of them, so `reviewedBy` and `reviewedOn` are empty and `vetted` is `false`. An entry only counts once a person reviews it and sets `status` to `vetted` with their name, the date and a pinned version.

| Id                | Candidate                           | Pinned           | Risk   | Biggest open question                                                                    |
| ----------------- | ----------------------------------- | ---------------- | ------ | ---------------------------------------------------------------------------------------- |
| `email.drafts`    | shinzo-labs/gmail-mcp               | 1.7.4            | high   | Gmail has no draft-only permission, so "drafts only" must be enforced outside the server |
| `email.send`      | shinzo-labs/gmail-mcp               | 1.7.4            | high   | Same server; sends in the owner's name, so the limits must live in `ledger.touch`        |
| `calendar.book`   | nspady/google-calendar-mcp          | 2.8.1            | medium | Which scope it requests; invites reach customers                                         |
| `crm.read`        | Onsite-Intelligence/Jobber-mcp      | 1.0.1            | medium | Weak candidate (unofficial, 3 stars); consider a small read-only script instead          |
| `accounting.read` | intuit/quickbooks-online-mcp-server | commit `31a1dd5` | medium | Intuit's scope is believed to be read and write, so read-only relies on three flags      |
| `ledger.touch`    | Argo's own script                   | not written      | low    | It is the safety net, and it does not exist yet                                          |

## What a reviewer checks

For each entry, before setting `status` to `vetted`:

1. Open the vendor repository. Confirm the license, the pinned version and that the code does what the entry says.
2. Read the "TO VERIFY" items in `riskNote` and settle each one.
3. Confirm the entry's `access` can really be enforced: by the permission, by the server's own flags, or by a script.
4. Check what data leaves the machine (telemetry, third-party services).
5. Set `status`, `vetted`, `reviewedBy`, `reviewedOn` and `pinnedVersion`.

## Not in the first six

`crm.write` and `accounting.paylinks` are deliberately not here. They are unvetted in the example, which keeps its third design blocked, and the fit check logs the gap for later.
