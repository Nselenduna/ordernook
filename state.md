# state.md — OrderNook

**Updated:** 23 Aug 2026

## Where we are (read this first — the dated log below is history)
The product is **feature-complete and live at ordernook.uk**. Phases 0, 1, 2A and 2B are all shipped. Phase 2B (customer online payments) was proven on 12 Aug 2026 with a real £2.80 charge, reject, and automatic refund on `corner-grind`.

**Zero real paying shops.** `corner-grind` and `pilot-test` are both Lloyd's own pilots on a hand-set 2027 trial. This has been a distribution problem, not a build problem, since 12 Aug — see `roadmap.md` and `walk-in-kit.md`.

Open engineering, in order:
1. **Order alerts Task 6** — deploy + prove on a real iPhone (`feat/shop-order-alerts`, pushed to origin; Tasks 1–5 built and reviewed). Until this ships, a shop with the dashboard tab closed misses orders.
2. **Legal pages** — `/terms` + `/privacy` on `feat/legal-pages`, footer repointed off the `zizweit.uk` soft-404s.
3. Housekeeping: delete the leftover TEST Stripe webhook endpoint `we_1U0SmG…`, which points at the prod URL and 400s on test events (harmless noise).

**Anything dated below is a historical log entry, true as at its own date.** Where it disagrees with git or Vercel, git and Vercel win — that mismatch cost a whole session on 11 Aug.

## Where we were (11 Jul 2026)
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
- **Next: Phase 2** (payments — reuse BookOnTheMap Connect scaffolding, direct charges). Slice 2 (2a/2b/2c) fully done.

## Update — 2 Aug 2026
- **Phase 1 Slice 2c (Item photos) SHIPPED (2 Aug 2026):** pushed to master + **deployed to production (ordernook.uk, deployment dpl_GQ9SKa5EvXfdDVNYVpyRxVx44HPH, READY)**; /corner-grind + /dashboard/login verified 200 live. Migration was already applied to remote. One photo per menu item: pick in the item form → local preview → **deferred upload on Save** (upsert item, then POST the file; cancelling a new item leaves no orphaned file) → thumbnail on the customer card + full-width hero in the item sheet + thumbnail on the dashboard row. Remove clears `photo_url` and deletes the stored object.
- **Storage:** new **`menu-photos`** public bucket + staff-scoped RLS (mirrors `shop-logos`; path `{shop_id}/{item_id}.webp`). **Migration `20260802000000_menu_photos_storage.sql` already applied to remote via `supabase db push`** (the Supabase CLI IS linked to iryavyogljedwgllaoit and works — the *MCP* can't reach the Zizwe project, but the CLI can). `menu_items.photo_url` already existed (Phase 0) — no column migration.
- **Route** `POST /api/menu/photo` (nodejs): verifies caller staffs the item's shop, sharp `rotate().resize(800,800,cover).webp(q80)`, ≤10 MB in, stores + sets versioned `photo_url` (busts caches). Mirrors `/api/branding/logo`.
- **Files:** new `src/app/api/menu/photo/route.ts`, `src/components/dashboard/item-photo-field.tsx`; edited `item-form-sheet.tsx` (photo state + deferred upload in `save()` + `photo_url` on EditorItem), `menu-editor.tsx` (row thumb), `app/dashboard/menu/page.tsx` (fetch `photo_url`), `shop/menu-page.tsx` (card thumb), `shop/item-sheet.tsx` (hero), `lib/i18n.ts`. Migration + storage RLS test. **6 commits on master.**
- **Verified in browser:** uploaded a photo to the Latte via the form (POST 200 → menu-photos bucket → dashboard row + customer card thumbnail + item-sheet hero all render); a no-photo item stays clean; Remove deletes the object (bucket empty after). Full suite **29 passing** (added 2 menu-photos cross-tenant storage RLS cases). Demo shop restored (test photo removed).
- **Post-ship fixes (2 Aug, deployed):** (1) **Uploaded photos rendered as broken images in prod** — root cause: supabase-js `storage.upload()` sends a raw Node `Buffer` straight to fetch, and **undici on Vercel UTF-8-stringifies it** (`EF BF BD` corruption); fix = wrap in `new Blob([new Uint8Array(buf)], {type})` (multipart, binary-safe) in BOTH the menu-photo and branding-logo routes. Did NOT repro locally. Corrupt Americano/Espresso objects cleared. Verified on prod: upload → decodes 800×800 → renders. (2) **Dashboard item-row overlap on mobile** — 6 controls in one non-wrapping flex row; fix = group controls + `flex-wrap` + name min-basis (wraps to 2 lines on phones, 1 line on desktop). See [[supabase-storage-upload-blob-not-buffer]].
- **NEXT:** Phase 2B (customer online payments — Stripe Connect direct charges).

## Update — 3 Aug 2026 (Phase 2A SHIPPED)
- **Phase 2A (shop subscriptions) LIVE on production (ordernook.uk).** Dedicated **OrderNook Stripe account** (separate from BookOnTheMap); Basic £12/mo product (test `price_1U0S78DeO3cMpMILVcyVZay5`, live `price_1U0S9UDeO3cMpMILOCL8ibiY`). Env set in `.env.local` (test) + Vercel (live on Production, test on Preview): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_BASIC_PRICE_ID`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`. Live webhook → `/api/stripe/webhook`.
- **Verified end-to-end in TEST mode:** checkout route → real `checkout.stripe.com` URL; signed webhook → shop `trialing→active` + subscription id stored; unsigned/bad-sig webhook → 400; billing-column trigger blocks staff self-grant; dashboard unlocked + PlanCard (151 trial days); public pause + `create_order` gate. Prod smoke: pages 200, webhook deployed (400 unsigned). **First real £12 live subscription not run** (would charge); flow proven in test mode.
- Pilots corner-grind/pilot-test on 2027 trial → won't lock.

## Update — 2 Aug 2026 (Phase 2A: shop subscriptions — code done, not deployed)
- **Phase 2A code BUILT + committed locally (Tasks 1–6); NOT pushed/deployed** — waiting on a dedicated OrderNook Stripe account.
- **Model:** 30-day trial → Basic £12/mo (Stripe Billing, not Connect). Unentitled = dashboard LockScreen + public ordering paused + `create_order` rejects. Pro shown "coming soon" (2B).
- **DB (applied to remote):** `shops.stripe_customer_id` + `trial_ends_at` (30-day default; existing backfilled; **pilots corner-grind/pilot-test set to 2027-01-01** so they don't lock); `is_entitled()` helper; `create_order` gated. **Security:** a trigger blocks authenticated/anon from writing billing columns (subscription_status/plan_tier/trial_ends_at/stripe_*) — else a shop could self-grant entitlement. Verified both.
- **Code:** `lib/stripe.ts` (lazy), `lib/supabase/admin.ts` (service role), `lib/entitlement.ts`; routes `/api/stripe/checkout|portal|webhook`; `dashboard/layout.tsx` LockScreen gate (uses `getStaffShopOrNull` to avoid a login redirect loop); `PlanCard` in Settings; `[slug]` paused when unentitled. Verified locally: corner-grind unlocked, PlanCard shows 151 trial days; login not looping; billing-column writes blocked for staff.
- **STRIPE PRODUCT MISTAKE FIXED:** a Basic product was first created in the **BookOnTheMap** Stripe account (wrong — Lloyd keeps one account per app); archived. The real product goes in a **dedicated OrderNook account**.
- **TASK 7 — Lloyd (blocks deploy):** (1) create the **OrderNook** Stripe account under Zizwe IT; (2) create "OrderNook Basic" £12/mo GBP product in **test + live**; (3) add webhook `https://ordernook.uk/api/stripe/webhook` (checkout.session.completed, customer.subscription.created/updated/deleted, invoice.payment_failed); (4) provide keys. Env needed: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (secrets), `STRIPE_BASIC_PRICE_ID`, `NEXT_PUBLIC_APP_URL`. Then I deploy + verify subscribe/cancel/lock in test mode. Specs: `phase2a-shop-subscriptions.md` (+ `-plan.md`).

## Update — 2 Aug 2026 (Sentry)
- **Sentry error monitoring LIVE (Phase A).** `@sentry/nextjs` v10 wired for **client + server + edge** — `instrumentation.ts` (register + `onRequestError`), `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`; `next.config.ts` wrapped with `withSentryConfig` (org `zizweit`, project `ordernook`). **Privacy:** `sendDefaultPii: false`, **no Session Replay**, `tracesSampleRate: 0.1`.
- **Sentry project:** `ordernook` in the zizweit org (de region) — **Lloyd created it** (org blocks members/MCP from creating projects, 403). DSN in `NEXT_PUBLIC_SENTRY_DSN` (set in `.env.local` + Vercel prod+preview; DSN is client-safe, not a secret).
- **Verified live on production:** deliberate server error → ORDERNOOK-1; deliberate client error on ordernook.uk → ORDERNOOK-2. Both captured, then resolved. Temp `/api/sentry-check` route removed. Deployed (61b3051).
- **Phase B — source maps DONE (2 Aug):** Lloyd added `SENTRY_AUTH_TOKEN` to Vercel; redeployed → build uploaded source maps (55 files, release 29af27b) + created a Sentry release. Stack traces are now un-minified. **Sentry fully complete.** Specs: `sentry-integration.md` (+ `-plan.md`).

## Update — 1 Aug 2026
- **Phase 1 Slice 2b (Option groups & options editor) SHIPPED (1 Aug 2026):** pushed to master (3760386) + **deployed to production (ordernook.uk, deployment dpl_9ZtGbRA39c1NKPBRVmfVCjgYa9E5, READY)**; /corner-grind + /dashboard/login verified 200 live. Per-item `OptionsSheet` (opened from a sliders icon on each menu item): add/rename/delete/reorder option groups (single/multi toggle, required toggle) and their options (name + £ price delta, reorder, delete); immediate per-action saves via anon client under existing staff RLS; required-group-with-no-options inline warning. **UI-only slice — no migration, no new RPC** (backend `option_groups`/`options` + split staff RLS + `create_order` validation already existed since Phase 0).
- **Files:** new `src/components/dashboard/options-sheet.tsx`, `menu-types.ts`, `icon-btn.tsx` (extracted shared IconBtn); edited `menu-editor.tsx`, `app/dashboard/menu/page.tsx` (nested fetch), `lib/i18n.ts`, `lib/money.ts` (`parsePriceDeltaToMinor`). 5 commits on master (0243573 → 384ab5f).
- **Verified end-to-end in browser:** added Extra Large (+£1.50) to Latte via the sheet → customer page rendered it as a Required radio and totalled £4.80; delete option/group works; required-empty warning shows/clears with the toggle. Full test suite **27 passing** (added `tests/money.test.ts` unit tests + 4 cross-tenant RLS cases for option_groups/options).
- **NEXT:** Slice 2c (item photos). 2b is live.
- Renamed the project's outer folder `Coffee shop 2` → `OrderNook` (path is now `…/Projexts 2025/OrderNook/order-ahead`).
- **Follow-ups (deferred):** currency GBP-hardcoded vs countries.currency join (UK-only for now); DB-level category-cascade guard; RLS tests are network-flaky against live Supabase (consider a dedicated test project); customer allergen badges show short key ("Gluten") not legal wording; default apple-icon for logo-less shops.
- **Branding follow-ups (deferred):** default root apple-icon for logo-less shops (iOS install); bucket-level file_size_limit/mime; logo cache-busting on re-upload; narrow Task2 sharp try/catch; test hygiene in storage-rls.test.ts.

## Gotchas
- Supabase now Pro tier under Zizwe org — 2-active-project free limit no longer applies to order-ahead.
- iOS push only works for installed home-screen PWAs (iOS 16.4+) — test on real iPhone.
- Sentry LIVE (Phase A, 2 Aug) — capture on prod; source maps pending SENTRY_AUTH_TOKEN in Vercel (Phase B).
- Vercel deploy is currently CLI-based (not git-connected). Connect the Git repo in Vercel for auto-deploy on push, if wanted.
- **Dev on OneDrive + PWA gotcha:** after restarting `next dev`, the PWA **service worker serves STALE JS chunks** (stable Turbopack chunk names), so new code silently doesn't appear in the browser even after `rm -rf .next`. Fix: in the browser console unregister the SW + clear caches (`navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())); caches.keys().then(ks=>ks.forEach(k=>caches.delete(k)))`) then hard-reload. Cost ~an hour of confusion once.
- **Preview tool + spaced path:** the in-app preview/launch tool can't `cd` into the OneDrive path (spaces in "Projexts 2025"); 8.3 short paths break Turbopack. Run `npm run dev` via a normal shell instead and point the browser at localhost:3000.
