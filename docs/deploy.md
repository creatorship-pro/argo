# Deploying Argo to the server (S7)

Argo runs as one Docker container behind HTTPS. Data and realtime live in hosted Convex, so the server only runs the web app.

## What you need first (from Mezie)

- SSH access to the server, with Docker installed.
- A domain or subdomain whose DNS points at the server (for example `argo.example.com`).
- The values for the env file below.

## 1. The env file (never in the repo)

Create `/etc/argo/argo.env`, readable only by the user who deploys:

```sh
sudo install -d -m 750 /etc/argo
sudo install -m 640 /dev/null /etc/argo/argo.env
```

Fill it from [`.env.example`](../.env.example). Plain `KEY=value` lines, no quotes. Three of them are built into the browser code, so changing one means redeploying:

- `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` (Convex gives these to you)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (a `pk_test_` key)

The rest are read when the container starts: `SITE_URL` (the public https address), `PARAKEET_URL`, `PARAKEET_TOKEN`, `STRIPE_SECRET_KEY` (an `sk_test_` key: the app refuses a live key), and `STRIPE_TAX` / `STRIPE_REQUIRE_TERMS` if you want them.

Convex has its own settings, set once on the deployment, not here:

```sh
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
npx convex env set SITE_URL https://argo.example.com
npx convex env set STAFF_ALLOWLIST "ana@example.com:fde,sam@example.com:facilitator,you@example.com:admin"
npx convex env set OPENCODE_GO_API_KEY oc_sk_...       # OpenCode Go gateway; without it, designs are a labeled stand-in
# npx convex env set ARGO_MODEL glm-5.3               # optional, this is the default
npx convex env set STRIPE_WEBHOOK_SECRET whsec_...
npx convex env set EMAIL_API_KEY ... && npx convex env set EMAIL_FROM argo@example.com
npx convex deploy                                      # pushes the functions
```

## 2. HTTPS

Copy [`deploy/Caddyfile.example`](../deploy/Caddyfile.example), put your domain in it, and run it with Caddy. Or, if the server uses a Cloudflare Tunnel, point the tunnel's hostname at `http://127.0.0.1:3100`. The container only listens on `127.0.0.1`, so the proxy is the only way in.

## 3. Deploy

```sh
git pull
scripts/deploy.sh
```

It builds `argo:<commit>`, keeps the running build as `argo:previous`, starts the new one and waits for `/api/health`. If the new build is not healthy within 30 seconds it puts the previous one back and exits with an error.

## 4. Roll back

```sh
scripts/rollback.sh
```

Swaps `argo:previous` in. The build it replaced is kept as `argo:rolledback`.

## Checks

```sh
curl -fsS https://argo.example.com/api/health     # {"ok":true,"service":"argo"}
docker logs --tail 50 argo
```

Open the staging URL on the iPad and on a phone. On the iPad, add it to the Home Screen: the screen wake lock that keeps the screen on while recording needs the installed app on iOS.

## Stripe webhook

In the Stripe dashboard (test mode), add an endpoint at `<NEXT_PUBLIC_CONVEX_SITE_URL>/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `checkout.session.expired`. To try it locally: `stripe listen --forward-to <NEXT_PUBLIC_CONVEX_SITE_URL>/stripe/webhook`. For the terms checkbox, set the terms URL in the Stripe dashboard first (or set `STRIPE_REQUIRE_TERMS=0` for a first test).

## The transcription server

See [`parakeet-contract.md`](parakeet-contract.md) for what the app sends and expects.
