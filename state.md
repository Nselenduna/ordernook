# state.md — Order-Ahead

**Updated:** 11 Jul 2026 (session in progress)

## Where we are
Phase 0 build underway. Infra done, app code in progress.

## Done this session
- Supabase project `order-ahead` (`iryavyogljedwgllaoit`, eu-west-2). NOTE: **wez_me_van was paused** to free the free-plan slot — restore it from the Supabase dashboard when needed.
- Schema + RLS + `create_order` / `get_order_by_token` / `attach_push_subscription` + audit triggers applied and smoke-tested (Large Oat Latte ×2 = 880 minor units ✓).
- Test shop seeded: **The Corner Grind** (`corner-grind`), 13 items, Size/Milk/Extras options.
- Dashboard login (dev seed): `owner@cornergrind.test` / `CornerGrind-Demo1!`
- Next.js scaffold + Tailwind + shadcn/ui, deps installed; VAPID keys generated (.env.local).
- Design locked: Travo Purple dashboard, Latte Glass customer default (see DESIGN.md).

## Done (end of session)
- Full Phase 0 app built and committed: customer flow, dashboard live queue, PWA + push.
- Verified end-to-end in browser: 2 orders placed, realtime + status flow + polling all confirmed. `npm run build` clean.
- Inline review done (1 display bug fixed); DB advisor hardening applied.
- See handoff.md for run instructions and next actions.

## Gotchas
- Supabase free plan = 2 active projects; slots used by revalidator_rebuild + order-ahead.
- iOS push only works for installed home-screen PWAs (iOS 16.4+) — test on real iPhone.
- Sentry DSN not yet set (.env.local placeholder).
