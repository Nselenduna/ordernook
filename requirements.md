# requirements.md — OrderNook Phase 0

Full spec: `../HANDOFF.md` §8 (schema), §11 (phases), Part 5 (task list). This file = Phase 0 acceptance criteria only.

## Phase 0 — validate the loop (NO Stripe)
1. ✅ Supabase schema + RLS (project `iryavyogljedwgllaoit`): full §8 schema, tenant isolation, SECURITY DEFINER `create_order` (server-side price validation), `get_order_by_token`, `attach_push_subscription`, order-event audit triggers, realtime on `orders`.
2. ✅ Seeded test shop **The Corner Grind** (`corner-grind`), 13-item menu, Size/Milk/Extras option groups, staff owner login.
3. Customer flow: `/[slug]` menu page → item customisation → cart (Zustand, persisted, prices in minor units) → guest checkout (name + optional phone) → pay-in-store order at status `new` → tokened status page `/order/[token]`.
4. Shop dashboard: `/dashboard` — Supabase Auth login, live queue via Realtime, sound on new order, status buttons New→Accepted→Preparing→Ready→Collected, Reject with reason.
5. Web push to customer on `ready` (permission asked at first order, "get notified when your order is ready").
6. PWA: manifest (hardcoded for test shop), service worker, installable.

## Conventions (non-negotiable)
- Prices: integers in minor units + currency code. Format only at display via `Intl.NumberFormat`.
- All UI strings via i18n keys (`src/lib/i18n.ts`), English-only shipped.
- Secrets in `.env.local` (gitignored) only. Never in git — lesson from the old Expo repo.
- Order items stored as snapshots (jsonb) — menu edits never mutate order history.
- Never trust client totals — `create_order` recomputes from DB.
