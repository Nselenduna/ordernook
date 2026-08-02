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
- **Phase 1 Slice 2a (Menu Editor — items & categories) SHIPPED (26 Jul 2026):** dashboard `/dashboard/menu` reworked into a full editor — add/edit/delete/reorder items (name, description, price £, category, 14-allergen checkboxes, sold-out) + category add/rename/delete-guarded/reorder. Built subagent-driven (4 tasks). Merged (73944b2), deployed, pushed. **Security fix included:** menu_items RLS with-check now requires category to belong to the same shop (migration 20260726140000). Suite 13/13.
- **Next: 2c** (item photos — reuse Slice 3 Storage/sharp). Then Phase 2 (payments — reuse BookOnTheMap Connect scaffolding, direct charges).

## Update — 1 Aug 2026
- **Phase 1 Slice 2b (Option groups & options editor) BUILT + VERIFIED locally — NOT yet pushed/deployed.** Per-item `OptionsSheet` (opened from a sliders icon on each menu item): add/rename/delete/reorder option groups (single/multi toggle, required toggle) and their options (name + £ price delta, reorder, delete); immediate per-action saves via anon client under existing staff RLS; required-group-with-no-options inline warning. **UI-only slice — no migration, no new RPC** (backend `option_groups`/`options` + split staff RLS + `create_order` validation already existed since Phase 0).
- **Files:** new `src/components/dashboard/options-sheet.tsx`, `menu-types.ts`, `icon-btn.tsx` (extracted shared IconBtn); edited `menu-editor.tsx`, `app/dashboard/menu/page.tsx` (nested fetch), `lib/i18n.ts`, `lib/money.ts` (`parsePriceDeltaToMinor`). 5 commits on master (0243573 → 384ab5f).
- **Verified end-to-end in browser:** added Extra Large (+£1.50) to Latte via the sheet → customer page rendered it as a Required radio and totalled £4.80; delete option/group works; required-empty warning shows/clears with the toggle. Full test suite **27 passing** (added `tests/money.test.ts` unit tests + 4 cross-tenant RLS cases for option_groups/options).
- **NEXT ACTION for Lloyd:** `git push origin master` + deploy to Vercel (CLI) to ship 2b to ordernook.uk. Not done automatically (push/deploy left to you).
- Renamed the project's outer folder `Coffee shop 2` → `OrderNook` (path is now `…/Projexts 2025/OrderNook/order-ahead`).
- **Follow-ups (deferred):** currency GBP-hardcoded vs countries.currency join (UK-only for now); DB-level category-cascade guard; RLS tests are network-flaky against live Supabase (consider a dedicated test project); customer allergen badges show short key ("Gluten") not legal wording; default apple-icon for logo-less shops.
- **Branding follow-ups (deferred):** default root apple-icon for logo-less shops (iOS install); bucket-level file_size_limit/mime; logo cache-busting on re-upload; narrow Task2 sharp try/catch; test hygiene in storage-rls.test.ts.

## Gotchas
- Supabase now Pro tier under Zizwe org — 2-active-project free limit no longer applies to order-ahead.
- iOS push only works for installed home-screen PWAs (iOS 16.4+) — test on real iPhone.
- Sentry DSN not yet set (.env.local placeholder).
- Vercel deploy is currently CLI-based (not git-connected). Connect the Git repo in Vercel for auto-deploy on push, if wanted.
- **Dev on OneDrive + PWA gotcha:** after restarting `next dev`, the PWA **service worker serves STALE JS chunks** (stable Turbopack chunk names), so new code silently doesn't appear in the browser even after `rm -rf .next`. Fix: in the browser console unregister the SW + clear caches (`navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())); caches.keys().then(ks=>ks.forEach(k=>caches.delete(k)))`) then hard-reload. Cost ~an hour of confusion once.
- **Preview tool + spaced path:** the in-app preview/launch tool can't `cd` into the OneDrive path (spaces in "Projexts 2025"); 8.3 short paths break Turbopack. Run `npm run dev` via a normal shell instead and point the browser at localhost:3000.
