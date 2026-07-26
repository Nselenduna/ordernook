# state.md — OrderNook

**Updated:** 11 Jul 2026 (session in progress)

## Where we are
Phase 0 build underway. Infra done, app code in progress.

## Done this session
- Supabase project `order-ahead` (`iryavyogljedwgllaoit`, eu-west-2). NOTE: **wez_me_van was paused** to free the free-plan slot — restore it from the Supabase dashboard when needed.
- Schema + RLS + `create_order` / `get_order_by_token` / `attach_push_subscription` + audit triggers applied and smoke-tested (Large Oat Latte ×2 = 880 minor units ✓).
- Test shop seeded: **The Corner Grind** (`corner-grind`), 13 items, Size/Milk/Extras options.
- Dashboard login (dev seed): `owner@cornergrind.test` — password rotated 26 Jul 2026; current value lives in local `.env.test` (gitignored), not committed. (Old committed value is dead.)
- Next.js scaffold + Tailwind + shadcn/ui, deps installed; VAPID keys generated (.env.local).
- Design locked: Travo Purple dashboard, Latte Glass customer default (see DESIGN.md).

## Done (end of session)
- Full Phase 0 app built and committed: customer flow, dashboard live queue, PWA + push.
- Verified end-to-end in browser: 2 orders placed, realtime + status flow + polling all confirmed. `npm run build` clean.
- Inline review done (1 display bug fixed); DB advisor hardening applied.
- See handoff.md for run instructions and next actions.

## Update — 26 Jul 2026
- Supabase project moved to **Zizwe org, Pro tier** (ref iryavyogljedwgllaoit unchanged). Free-plan slot juggling no longer applies.
- **Schema exported to git**: `supabase/migrations/` (5 baseline migrations); local↔remote history in sync. Committed (3c818a7).
- **Deployed to Vercel**: `lloydmgutshini-projects/order-ahead`. Menu renders from Supabase, 0 console errors. Env vars set for prod + preview.
- **Name = OrderNook** (rebrand deployed to prod); GitHub repo `Nselenduna/ordernook` (master pushed).
- **Custom domain LIVE**: https://ordernook.uk serves the app over HTTPS (valid cert); `www.ordernook.uk` 308-redirects to apex. Registered at Namecheap (A `@`→64.29.17.1, CNAME `www`→cname.vercel-dns.com). Vercel project **renamed** `order-ahead`→`ordernook` (id prj_Lh9UiNaafUdE5eipbkJ5vPhggnD6 unchanged).
- **iPhone test FULLY PASSED (26 Jul):** installed as PWA from home screen, full order flow works, notification permission granted, and **"order ready" web push DELIVERED on iOS** when the order was advanced to Ready on the dashboard (logged in as dev seed `owner@cornergrind.test`). The riskiest spec assumption (iOS push to installed PWA) is proven on real hardware.
- **Phase 0 COMPLETE — zero open risks.**
- **Phase 1 Slice 1 (Go-Live Kit) SHIPPED (26 Jul 2026):** dashboard nav + Menu (sold-out toggle) + Settings (accepting-orders + prep) + QR panel/poster; `menu_items.allergens` + customer display; pilot seed template (`scripts/seed-shop.sql`); RLS cross-tenant isolation test (7/7). Built subagent-driven (7 tasks, all reviewed). Merged to master (358d38e) + **deployed to production (ordernook.uk)**. RLS verified sound. Dev-seed password rotated (new value in local `.env.test`). Second test shop seeded: `pilot-test`.
- **Phase 1 Slice 3 (Shop Profile & Branding) SHIPPED (26 Jul 2026):** dashboard Profile tab (name, tagline, brand colour + WCAG contrast guard, logo upload); `shop-logos` Storage bucket + RLS; logo auto-processing (sharp → 512/192/180) via `/api/branding/logo`; logo on customer header; dynamic per-shop `/[slug]/manifest.webmanifest` + apple-touch-icon + theme-color. Built subagent-driven (6 tasks). Merged to master (fceb096), deployed to production, pushed to GitHub. Storage isolation test added (suite 10/10). New dep: sharp.
- **Next: Phase 1 Slice 2** — full menu editor (CRUD items/categories/options, photos, allergen editing). See `phase1-go-live-kit-plan.md` §8.
- **Branding follow-ups (deferred):** default root apple-icon for logo-less shops (iOS install); bucket-level file_size_limit/mime; logo cache-busting on re-upload; narrow Task2 sharp try/catch; test hygiene in storage-rls.test.ts.

## Gotchas
- Supabase now Pro tier under Zizwe org — 2-active-project free limit no longer applies to order-ahead.
- iOS push only works for installed home-screen PWAs (iOS 16.4+) — test on real iPhone.
- Sentry DSN not yet set (.env.local placeholder).
- Vercel deploy is currently CLI-based (not git-connected). Connect the Git repo in Vercel for auto-deploy on push, if wanted.
