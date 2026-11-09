# Argo

Event software for **The Overhang**, a pop-up, AI-native education event. The first event, _Build a Bot_, is on **Thursday, November 26, 2026**: business owners work with an FDE (a concierge) to design an AI employee for their business.

Argo coordinates the event. The facilitator runs the room, FDEs work with owners, and owners get their own proposal page.

Planning lives in Linear: [The Overhang](https://linear.app/creatorship/project/the-overhang-c1ad909743de). This repo holds the software only. Dates, pricing, guest list, venue and FDE training stay in Linear.

**Building with an agent? Read [AGENTS.md](AGENTS.md) first.**

## What it does (event one)

| Screen        | Device                   | Used by                                                                                         |
| ------------- | ------------------------ | ----------------------------------------------------------------------------------------------- |
| FDE screens   | iPad                     | Assigned guests, suggested questions, read-back lock, break review of three AI employee designs |
| Run board     | iPad                     | Segment countdown and a status chip for each FDE group                                          |
| Proposal page | Phone, opened by QR code | The owner's chosen design, a free takeaway download, price and terms, and a Stripe checkout     |

## Stack

Next.js 16, React 19, Tailwind 4 and TypeScript; Convex (hosted) for data and realtime; Better Auth for staff login; Stripe embedded Checkout; a separate Parakeet 0.6B server for transcription. It runs on our own server over HTTPS.

## Status

Event one is built end to end and has been tested against stand-ins, not against live services. What exists:

| Ticket | What                                                                                                  | Where                                                           |
| ------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| A1     | FDE iPad screens: guest list, session (consent, record, read-back lock), break review, present and QR | `src/app/(fde)`, `src/components/fde`                           |
| A3     | Turn-based listener: segments, transcription proxy, suggested questions, tagged profile updates       | `src/lib/listener`, `src/lib/capture`, `convex/listener.ts`     |
| A4     | Blueprint builder: three independent designs, fit check, separate recommendation, FDE choice stored   | `src/lib/blueprint`, `convex/designs*.ts`                       |
| A7     | Run board: server-time countdown, one status chip per FDE group, manual phase changes                 | `src/app/(facilitator)`, `src/components/facilitator`           |
| E1     | Proposal page and free takeaway (JSON and README)                                                     | `src/app/p/[token]`, `src/lib/proposal`                         |
| E2     | Stripe embedded Checkout and verified webhook (test mode only)                                        | `src/app/api/checkout`, `convex/purchases.ts`, `convex/http.ts` |
| E3     | Staff email-code login from an allowlist, roles, QR guest links                                       | `convex/auth.ts`, `src/lib/access`                              |
| S7     | Docker image, deploy and rollback scripts                                                             | `Dockerfile`, `scripts/`, `docs/deploy.md`                      |

Not done, and waiting on a person: real prices and terms (E5, needs D4 and E4), a reviewer's sign-off on the six capability entries (B1), the Parakeet server, and server access with a domain (S7). Without a model key the app runs on labeled stand-ins.

## Run it locally

Needs Node 22 and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. `http://localhost:3000/api/health` returns `{"ok":true,"service":"argo"}`.

| Command             | What it does             |
| ------------------- | ------------------------ |
| `npm run lint`      | ESLint                   |
| `npm run typecheck` | TypeScript, no emit      |
| `npm test`          | Vitest, run once         |
| `npm run build`     | Production build         |
| `npm run format`    | Prettier, writes changes |

### Connecting Convex

Needs a Convex project (ask Mezie for access to the Argo project). Then, in this folder:

```bash
npm install
npx convex dev
```

Sign in when asked and choose the existing **Argo** project. It writes `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` into `.env.local`, and keeps the `convex/` functions in sync while it runs. Leave it running next to `npm run dev`.

Better Auth also needs two variables on the Convex deployment itself (they are not read from `.env.local`). Set them once per deployment:

```bash
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
npx convex env set SITE_URL http://localhost:3000
```

Staff sign in from an allowlist. Set it on the Convex deployment, then start a rehearsal event with test guests:

```bash
npx convex env set STAFF_ALLOWLIST "you@example.com:admin,fde@example.com:fde,sam@example.com:facilitator"
npx convex run seed:rehearsal '{"fdeEmails":["fde@example.com"]}'
```

Until an email sender exists (`EMAIL_API_KEY`, `EMAIL_FROM`), sign-in codes are not emailed. In development the code is printed in the `npx convex dev` log. Without `OPENCODE_GO_API_KEY` the suggestions are a plain checklist and the three designs are a labeled stand-in, so the whole flow can be tried before a key exists. Model calls go to the OpenCode Go gateway (OpenAI-compatible) at `https://opencode.ai/zen/go/v1`; `ARGO_MODEL` picks the model and defaults to `glm-5.3`.

Then: sign in as the FDE at `/fde`, open a guest, tap "Guest agreed", record (the transcription stub returns fake text), lock a read-back, build the designs at the break review, choose one, and open the proposal and QR code. Open `/facilitator` as the facilitator to run the clock.

### Deploying

See [docs/deploy.md](docs/deploy.md). The transcription server contract is in [docs/parakeet-contract.md](docs/parakeet-contract.md).

### Layout

`src/app` (routes), `src/components`, `src/lib`, `convex/`, `docs/` (examples and specs), `scripts/`.

## Examples

`docs/examples/hvac-followup/` holds a worked example of the AI employee blueprint format: a fictional guest, three designs and a recommendation. It is the test fixture for the blueprint schema.
