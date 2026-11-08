# Argo

Event software for **The Overhang**, a pop-up, AI-native education event. The first event, *Build a Bot*, is on **Thursday, November 26, 2026**: business owners work with an FDE (a concierge) to design an AI employee for their business.

Argo coordinates the event. The facilitator runs the room, FDEs work with owners, and owners get their own proposal page.

Planning lives in Linear: [The Overhang](https://linear.app/creatorship/project/the-overhang-c1ad909743de). This repo holds the software only. Dates, pricing, guest list, venue and FDE training stay in Linear.

**Building with an agent? Read [AGENTS.md](AGENTS.md) first.**

## What it does (event one)

| Screen | Device | Used by |
|---|---|---|
| FDE screens | iPad | Assigned guests, suggested questions, read-back lock, break review of three AI employee designs |
| Run board | iPad | Segment countdown and a status chip for each FDE group |
| Proposal page | Phone, opened by QR code | The owner's chosen design, a free takeaway download, price and terms, and a Stripe checkout |

## Stack

Next.js 16, React 19, Tailwind 4 and TypeScript; Convex (hosted) for data and realtime; Better Auth for staff login; Stripe embedded Checkout; a separate Parakeet 0.6B server for transcription. It runs on our own server over HTTPS.

## Status

The app does not exist yet. Ticket S0 (CRE-54) creates the scaffold, and every other build ticket starts from it.

## Examples

`docs/examples/hvac-followup/` holds a worked example of the AI employee blueprint format: a fictional guest, three designs and a recommendation. It is the test fixture for the blueprint schema.
