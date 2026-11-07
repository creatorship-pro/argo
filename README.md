# Argo

Event intelligence software for **The Overhang**, a pop-up, AI-native education accelerator. The first event is *Build a Bot*: business owners build AI employees to reduce owner dependency.

Argo coordinates the event. Captain is the facilitator, Shipmates are the FDEs (concierges), Passengers are the owners.

Planning lives in Linear: [The Overhang](https://linear.app/creatorship/project/the-overhang-c1ad909743de) (project CRE-1). This repo holds the software only. Dates, pricing, guest list, venue, FDE training and scripts stay in Linear.

## Status

Stack not chosen yet. A research pass comes first, then the scaffold.

## One app, three role-based views

A single shared guest-status model feeds all three views with role-appropriate information:

| View | Device | Used by |
|---|---|---|
| Guest web app | Phone | Owners: sign-up, arrival, proposal page, takeaway |
| FDE view | iPad | Assigned guests, guided next step, copilot, proposal deck |
| Facilitator view | iPad | Event-wide progress, timers, phase control |

## Scope (Linear tickets)

| Area | Tickets |
|---|---|
| Guest flow | CRE-11 I1 sign-up and confirmation, CRE-19 I2 arrival booking and check-in |
| Live session engine | CRE-27 A3 silent listener, CRE-32 A4 template matcher, CRE-29 A5 breakout timekeeper, CRE-30 A6 proposal deck builder, CRE-38 A7 facilitator view, CRE-41 I3 proposal-round coordination, CRE-39 I4 notifications |
| Takeaway and offer | CRE-21 B2 JSON config and README, CRE-17 B3 bot visualization, CRE-28 E1 proposal page, CRE-36 E2 Stripe checkout, CRE-34 E3 owner web app access |

## Build order

1. Foundation: roles and login, guest record, shared guest-status model.
2. Proposal and takeaway track: B2, then B3, E1, E2, E3.
3. Facilitator view and timekeeper: A5, then A7.
4. Silent listener spike (A3). It is the riskiest build, so test live audio, transcription and consent recording on an iPad early.
5. A4, A6, I3, I4, then I1 and I2.

## Blocked on decisions

- **A1** (interface design sprint with Kazdin) gates A3 and A7.
- **D8** (guest-facing flow) gates I1, I2, E3 and I4. **D7** (closing notification timing) also feeds I4.
- **B1** (template audit) gates B2 and A4.
- **D1** (event date) sets the deadline.
