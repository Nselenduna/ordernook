# handoff.md — Order-Ahead (session end: 11 Jul 2026)

## TL;DR
**Phase 0 is built, committed, and verified end-to-end in a live browser.** Menu → customise → cart → guest checkout → order lands in the dashboard in realtime → status flow → customer status page updates. Production build passes.

## Run it
```
cd "C:\Users\lloyd\OneDrive\Desktop\Projexts 2025\Coffee shop 2\order-ahead"
npm run dev
```
- Customer PWA: http://localhost:3000/corner-grind
- Dashboard: http://localhost:3000/dashboard/login → `owner@cornergrind.test` / `CornerGrind-Demo1!`

## What was verified live (this session)
1. Placed order #1 (2× Latte, Large + Oat = £8.80 — server recomputed the same total as the client).
2. Dashboard (logged in as owner): order appeared, Accept → Start preparing → Ready → Collected all worked; DB trigger stamped timestamps + audit log.
3. Customer status page updated to "ready" via polling.
4. Placed order #2 → appeared on the dashboard **via realtime, no refresh**; per-shop daily order number incremented (#2).
5. RLS spot-check: anon REST query on `orders` is denied; menu tables readable; `/manifest.webmanifest` and `/sw.js` serve 200.
6. `npm run build` passes clean.

## Architecture notes (differs slightly from HANDOFF.md Part 5 — deliberate)
- **No service-role key anywhere.** Privileged ops are SECURITY DEFINER Postgres functions called by RPC: `create_order` (validates items/options, recomputes all prices, per-shop daily order number under shop-row lock), `get_order_by_token`, `attach_push_subscription`. See decisions/log.md.
- Push send: `/api/notify-ready` uses the staff cookie session, so RLS proves shop ownership before reading the push subscription. VAPID keys in `.env.local`.
- Supabase project: `order-ahead` (`iryavyogljedwgllaoit`, eu-west-2). Migrations applied via MCP: phase0_schema, fix_create_order_currency, fix_order_triggers, seed_test_shop, advisor_hardening.

## Known items / next actions
1. **wez_me_van Supabase project is PAUSED** (freed the free-plan slot). Restore from the dashboard when needed.
2. **Sentry not wired** — `NEXT_PUBLIC_SENTRY_DSN` placeholder in .env.local. Add `@sentry/nextjs` when you have a DSN.
3. Supabase Auth: enable **leaked password protection** (dashboard → Auth → Passwords) — advisor WARN, manual toggle.
4. Web push end-to-end needs a real device test (iOS requires installed PWA, iOS 16.4+). The opt-in card + subscription + send path is coded and the send route was exercised (no subscription attached → clean no-op).
5. Minor: dashboard "Xm ago" showed ~2 min for a fresh order — likely local clock vs server skew; check on another machine before worrying.
6. Test orders #1 (collected) and #2 (new) left in the DB as demo data — delete via Supabase Studio if unwanted.
7. Before Phase 1 marketing copy: run the AUDIENCE.md 4-question interview → audience.md.
8. Phase 1 next: shop registration, menu editor, branding + dynamic manifest, QR generation, subdomain routing (see roadmap.md).

## Review summary (inline review, this session)
- Fixed: double-counted option deltas in order-page line totals (`unit_price_minor` already includes options).
- Fixed earlier by smoke test: order trigger FK bug (audit insert moved to AFTER trigger), currency expression bug in create_order.
- Advisor hardening applied: `is_staff_of` + trigger functions revoked from anon/public, `(select auth.uid())` initplan fix, FK indexes, split FOR ALL policies.
- Anon-callable SECURITY DEFINER RPCs (`create_order`, `get_order_by_token`, `attach_push_subscription`) are **intentional** — that's the guest flow; inputs validated server-side.
