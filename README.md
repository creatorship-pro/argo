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

The scaffold is in place (ticket S0, CRE-54): Next.js, Convex with a placeholder schema, and a Better Auth email-code sign-in skeleton at `/sign-in`. Real staff login, roles and QR guest access arrive with E3.

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

Until an email sender exists, sign-in codes are not emailed. In development the code is printed in the `npx convex dev` log.

### Layout

`src/app` (routes), `src/components`, `src/lib`, `convex/`, `docs/` (examples and specs), `scripts/`.

## Examples

`docs/examples/hvac-followup/` holds a worked example of the AI employee blueprint format: a fictional guest, three designs and a recommendation. It is the test fixture for the blueprint schema.
