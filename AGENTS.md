# Working on Argo (for build agents)

You are building part of Argo, the software for The Overhang's first event on **Thursday, November 26, 2026**. Mezie owns decisions and merges every pull request.

## Source of truth

- Tickets live in Linear, project [The Overhang](https://linear.app/creatorship/project/the-overhang-c1ad909743de). Read your whole ticket before writing code.
- In a ticket, **"Event one scope"** sections and anything marked **Decided** override older text. **Proposal** means build the stated default and say in your pull request what you chose. **Needs decision** means stop and ask.
- Tickets use short codes (A3, E1). The table below maps them to Linear IDs. If a ticket and this file disagree, the ticket wins; flag it in your pull request.

## What you may build

| Code | Linear | What |
|---|---|---|
| S0 | CRE-54 | Scaffold the app (do this first) |
| B2 | CRE-21 | Blueprint format (JSON schema) and takeaway README |
| B1 | CRE-13 (and B1a, CRE-53) | First six vetted capability entries |
| A3 | CRE-27 | Listener: turn upload, transcription, suggested questions |
| A4 | CRE-32 | Blueprint builder: three designs plus a recommendation |
| A1 | CRE-23 | FDE iPad screens |
| A7 | CRE-38 | Run board |
| E1 | CRE-28 | Proposal page |
| E2 | CRE-36 | Stripe checkout |
| E3 | CRE-34 | Staff login and QR access |
| E5 | CRE-40 | Offer content (after Mezie sets prices in D4) |
| S7 | CRE-55 | Deploy to the server |

**Do not build** anything in the Linear milestone "Later (after event 1)": I1, I2, I3, I4, A5, A6, B3, S1 to S6, D5, D8 and the C-tickets. Their work was cut or folded into the tickets above.

## Stack

- Next.js 16 (App Router), React 19, Tailwind 4, TypeScript, `src/` layout, npm.
- Convex (hosted) for data and realtime. Better Auth through its Convex component.
- Stripe embedded Checkout for payment, in test mode until Mezie says otherwise.
- Audio: the iPad records and uploads short segments to a separate Parakeet 0.6B server. Only transcript text goes into Convex. Until that server exists, build against a stub.
- AI employees run on pi and are designed, not deployed. The blueprint format is ticket B2; the example is `docs/examples/hvac-followup/`.
- Layout (S0 creates it): `src/app`, `src/components`, `src/lib`, `convex/`, `docs/`, `scripts/`.

## How to work

1. Take one ticket at a time. Check its "blocked by" list in Linear. If a blocker is not merged, stop and comment on the ticket.
2. Use the branch name Linear shows on the ticket (for example `contact/cre-27-a3-build-the-silent-listener-with-consent`), so the pull request links to the ticket.
3. Do only what the ticket asks. Do not refactor unrelated code. If you spot another problem, mention it in the pull request instead of fixing it.
4. Before opening a pull request, run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`. All must pass.
5. Open a pull request titled `CRE-27: short summary`, fill in the template, and put `Closes CRE-27` in the description. **Never push to `main`. Never merge.**
6. If you are blocked or the ticket is unclear, add the Linear label **Needs human input**, comment with the exact question and what you tried, and stop. Do not guess on money, consent, privacy or anything marked Needs decision.

## Rules that matter

- No secrets in the repo. Read settings from environment variables, list their names in `.env.example` without values, and never log keys.
- No audio, transcript text or card data in logs.
- Every fact in a guest profile carries who said it: said by the guest, read back and confirmed, inferred by the agent, or approved by the FDE. Never show an inferred fact as confirmed.
- The FDE is always in the loop. The agent never speaks to the guest.
- Guests do not log in. They open their page by a private link or QR code with a long random token that expires and can be revoked.
- Numbers shown to guests are estimates with stated assumptions, never guarantees.
- Target devices: iPad Safari in landscape for FDE and facilitator screens, iPhone Safari in portrait for the proposal page. No hover-only interactions. Large, plain text on FDE screens.
- Write tests for logic (state changes, token expiry, permissions, the blueprint schema). Do not test framework behavior.
- Do not add a dependency without saying why in the pull request.
