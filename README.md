# OrderNook

**A cosy corner for every order.**

White-label order-ahead PWA for small neighbourhood food & drink shops (coffee, sandwiches, bakeries). A shop registers, builds its menu, and gets a QR code; customers scan once, install the shop's *own* branded PWA, then order ahead and skip the queue. Flat subscription, **zero per-order commission** — customer money goes directly to the shop via Stripe Connect.

By Zizwe IT Limited — *Low Cost. High Impact.*

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Supabase** — Postgres, Auth, RLS, Realtime (project `iryavyogljedwgllaoit`)
- **Tailwind + shadcn/ui**, Zustand (cart)
- **web-push** (VAPID) for "order ready" notifications
- Hosting: **Vercel**

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000/corner-grind (the seeded Phase 0 test shop, "The Corner Grind").

Requires `.env.local` (gitignored) with Supabase + VAPID keys — see `.env.example`.

## Project layout

- `src/app/[slug]` — customer menu / ordering PWA (per shop)
- `src/app/dashboard` — shop live order queue + status flow
- `src/app/order` — tokened customer order-status page
- `src/lib`, `src/store` — Supabase clients, i18n, cart
- `supabase/migrations` — full schema, RLS, and RPCs (source of truth)

## Status

Phase 0 complete and verified (browser + Pixel 6). Deployed to Vercel. Next: real-iPhone PWA install + push test, then Phase 1 (self-serve shop registration). See `roadmap.md`, `state.md`, and `decisions/log.md`.

## Docs

`project.md` (North Star) · `requirements.md` · `../SPEC.md` (full product + technical spec).
