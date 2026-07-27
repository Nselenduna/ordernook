# Snapshot: OrderNook — 2026-07-26

**Captured:** 2026-07-26 · **Window:** project start (11 Jul 2026) → now, concentrated in one long session on 26 Jul
**Previous snapshot:** none — first snapshot
**Sources read:** this session (the full 26 Jul build), git log (43 commits, 11–26 Jul), the project docs (`project.md`, `requirements.md`, `roadmap.md`, `state.md`, `decisions/log.md`, `SPEC.md`, `phase1-*` spec/plan files), the 8 files in `supabase/migrations/`, and the SDD ledgers produced during the build. Past-session transcripts were **not** re-read this pass (see Gaps).

## 1. Where the project stands

OrderNook is a white-label order-ahead PWA for small UK food & drink shops (Next.js 16 App Router + Supabase + Vercel). A shop gets a branded installable web app at `ordernook.uk/{slug}`; customers scan a QR, install it, order ahead, and skip the queue. Business model: flat subscription, **zero per-order commission** — customer money is meant to settle directly to the shop (payments not built yet).

What works today, live on `https://ordernook.uk`: the full customer loop (menu → cart → guest checkout → pay-in-store order → live dashboard queue with sound → status flow → **web push on iOS**, verified on a real iPhone), and a shop dashboard with five sections — Orders, Menu (full item/category editor), Settings (accepting-orders + prep time), QR (poster), Profile (name/tagline/logo/brand colour). One seeded test shop, "The Corner Grind", plus a throwaway second shop `pilot-test` used only for tenant-isolation tests.

What doesn't exist yet: online payments (Phase 2), self-serve shop registration (Slice 4 — shops are onboarded by hand via a SQL seed), menu option-groups editor (Slice 2b) and item photos (Slice 2c).

**Health:** on track — Phase 0 complete and device-verified; Phase 1 has shipped 3 of 4 slices to production in a day, each behind an independent review gate. The main exposures are RLS-policy completeness and a flaky test setup (see risks), not delivery pace.

## 2. Milestones

### 2026-07-26 — Slice 2a (Menu Editor) shipped
- **What happened:** `/dashboard/menu` went from a read-only sold-out list to a full editor — add/edit/delete/reorder items (name, description, £ price, category, 14 allergen checkboxes) and categories. Merged `73944b2`, deployed, pushed.
- **What it changed:** shops now maintain their own menus; Lloyd no longer hand-seeds a menu per pilot. Also closed a **pre-existing cross-tenant RLS hole** (migration `20260726140000`).
- **Evidence:** commits `511217f`..`73944b2`; `decisions/log.md`.

### 2026-07-26 — Slice 3 (Shop Profile & Branding) shipped
- **What happened:** dashboard Profile tab (name, tagline, one brand colour with a WCAG contrast guard, logo upload) + a logo pipeline (sharp → opaque square PNG 512/192/180 in a public `shop-logos` Storage bucket) + a **dynamic per-shop PWA manifest** (`/[slug]/manifest.webmanifest`, per-shop `apple-touch-icon` + theme colour).
- **What it changed:** an installed shop PWA is now genuinely *the shop's* app (its icon, name, colour), which is the core white-label promise. Introduced Supabase Storage into the stack.
- **Evidence:** commits `06172ff`..`fceb096`; migration `20260726130000`; `phase1-slice3-shop-profile.md`.

### 2026-07-26 — Slice 1 (Go-Live Kit) shipped
- **What happened:** dashboard nav shell + `getStaffShop()`, sold-out toggle, shop settings (accepting-orders + prep), QR panel/printable poster, `menu_items.allergens` + customer display, pilot seed template, RLS cross-tenant test.
- **What it changed:** a hand-onboarded pilot shop can run daily service unattended. First automated RLS isolation test in the repo.
- **Evidence:** commits `4d8dfd5`..`358d38e`; `phase1-go-live-kit.md`.

### 2026-07-26 — Rebrand + first production deploy + custom domain
- **What happened:** renamed **Order-Ahead → OrderNook** (`ff56ed4`), deployed to Vercel production, registered `ordernook.uk` (Namecheap) and wired it to Vercel over HTTPS with a `www` 308-redirect. Vercel project renamed to `ordernook`.
- **What it changed:** the product has a real, verified brand and a public URL — the prerequisite for a pilot.
- **Evidence:** `ff56ed4`; `decisions/log.md`; DNS is an A-record `@`→Vercel + CNAME `www`→cname.vercel-dns.com at Namecheap.

### 2026-07-26 — Schema exported to git; Supabase moved to Zizwe Pro
- **What happened:** the DB schema (which had existed *only* in the hosted project) was exported to `supabase/migrations/` (`3c818a7`); the Supabase project was moved from the free tier to the Zizwe organisation on the Pro tier.
- **What it changed:** the schema is now recoverable from git, and the project no longer risks a free-tier auto-pause. Also means the Vercel-integrated Supabase MCP can no longer see the project (it's under the Zizwe org now).
- **Evidence:** `3c818a7`; `state.md`.

### ~2026-07-26 — iOS PWA install + web-push verified on a real iPhone
- **What happened:** Lloyd installed the PWA from the home screen on an iPhone, placed an order, and received the "order ready" web push when an order was advanced to Ready.
- **What it changed:** closed the single riskiest assumption in the whole spec (iOS only allows push for installed PWAs). Phase 0 became truly done, zero open risks.
- **Evidence:** this session (screenshots shared by the user); `state.md` "iPhone test FULLY PASSED".

### 2026-07-11 — Phase 0 complete (pre-this-session)
- **What happened:** full order loop built on Next.js + Supabase, browser-verified and tested end-to-end on a Pixel 6.
- **What it changed:** proved the core value with no payment complexity.
- **Evidence:** commits `fc7c328`, `668f719`; `roadmap.md` "Done".

## 3. Decisions and reasoning

### Product name = OrderNook
- **Decided:** the app is "OrderNook"; domain `ordernook.uk`. · 2026-07-26
- **Why:** Lloyd wanted a name that reads as "the friend in business" and works in common language. OrderNook keeps that warmth and was **verified clear of existing products** (app-store + web search), not just domain-available.
- **Alternatives considered:** *OrderMate* (Lloyd's first pick) — rejected: it's an established Australian hospitality-POS brand, all domains taken. *OrderNest* (my first recommendation) — rejected after checking: it's a live "OrderNest – Restaurant POS" on both app stores + ordernest.com. *Orderly/Order Pro* — crowded/generic. Process lesson baked into `decisions/log.md`: **check app-store products, not just domain availability, before recommending a name.**
- **Assumes:** UK-first is fine (`.uk` only; `.com` was taken). A formal UK IPO trademark search is still pending before heavy marketing spend.
- **Firmness:** settled.
- **Evidence:** `decisions/log.md` (26 Jul name entry); `SPEC.md` risk #5 resolved.

### Lean pilot-first (hand-onboard shops; defer self-serve registration)
- **Decided:** Lloyd onboards 2–3 pilot shops himself via a SQL seed template; Phase 1 builds the tools a shop uses daily, not a public signup wizard. · 2026-07-26
- **Why:** fastest path to a live pilot; matches Lloyd's stated way of working ("learn by shipping"). Self-serve registration is deferred to Slice 4 "until a shop asks".
- **Alternatives considered:** full self-serve signup first (more work before the first live shop); hybrid minimal-signup. Both deferred.
- **Assumes:** pilot scale is small enough that manual onboarding isn't a bottleneck.
- **Firmness:** settled for the pilot phase.
- **Evidence:** `decisions/log.md`; `phase1-go-live-kit.md` §1; `scripts/seed-shop.sql`.

### No service-role key anywhere
- **Decided:** all app writes go through the anon/publishable client under Postgres RLS. Privileged operations are either DB `SECURITY DEFINER` functions (`create_order`, etc.) or SQL run by hand in the Supabase editor (the pilot seed). The logo-upload route uses the *caller's* cookie session, so Storage RLS still applies. · inherited from Phase 0, upheld through Phase 1
- **Why:** the service-role key was never exposed to the app; DB-enforced validation is stronger than API-layer checks; and Supabase's MCP never surfaced the service key anyway.
- **Alternatives considered:** a server route with the service key for privileged writes — rejected to keep the trust boundary at the DB.
- **Assumes:** RLS policies are actually correct and complete. (This assumption was dented once — see R1.)
- **Firmness:** settled; treated as a hard constraint in every slice's global-constraints block.
- **Evidence:** `decisions/log.md` (Phase 0 entry); `src/app/api/branding/logo/route.ts`; every `phase1-*-plan.md`.

### Payments = Stripe Connect **direct** charges (Phase 2, not built)
- **Decided:** when payments land, the shop is the merchant of record and money never routes through the platform (zero commission). Reuse BookOnTheMap's Connect *onboarding + subscription* scaffolding, but **not** its charge model.
- **Why:** the commission-free, money-goes-straight-to-the-shop positioning is the whole differentiator vs Deliveroo-style marketplaces; direct charges also make refunds simple (no `reverse_transfer`).
- **Alternatives considered:** BookOnTheMap's **destination charges** (platform takes the money, transfers to the business, needs `reverse_transfer` on refund). That model is proven and live in BookOnTheMap, but it's the opposite trust/commission posture.
- **Assumes:** shops will complete Stripe Connect onboarding; UK e-money rules stay clear of the (later, deferred) wallet feature.
- **Firmness:** provisional — it's a Phase 2 design, not yet implemented. `SPEC.md` §5 flags evaluating Accounts v2 at build time.
- **Evidence:** `SPEC.md` §5; `decisions/log.md`; reviewed the BookOnTheMap deposit work this session.

### Brand colour drives `--brand-primary` (stored as both primary + accent)
- **Decided:** the shop's single brand colour is written to `branding.primary` (and `accent`), with a WCAG ≥4.5:1-vs-white contrast guard blocking unreadable colours. · 2026-07-26
- **Why:** `brandingVars()` maps `primary`→`--brand-primary`, which is what actually styles buttons/prices/headings. The first implementation wrote only `accent` (which just feeds the ring), so the picker did nothing — caught in review.
- **Alternatives considered:** full three-colour theming (deferred — too easy for non-designers to make ugly/inaccessible); logo-only, no colour (too little "theirs"). Lloyd chose "one colour + contrast guard".
- **Assumes:** one primary colour on the Latte-cream base is enough personalisation for a pilot.
- **Firmness:** settled.
- **Evidence:** `phase1-slice3-shop-profile.md` §3; Slice 3 Task 3 fix (`01345ac`).

### Logo auto-processing (sharp → opaque square 512/192/180)
- **Decided:** uploaded logos are centre-cropped to square, flattened onto white, and emitted at 512/192/180 PNG server-side. · 2026-07-26
- **Why:** the logo doubles as the installed-app icon; iOS shows a black box for transparent PNGs and needs a proper `apple-touch-icon` (180). Flattening + fixed sizes makes the home-screen icon look right.
- **Alternatives considered:** use-as-is (rejected — icon quality depends on what's uploaded); logo in header only, generic app icon (rejected — undercuts the white-label point).
- **Assumes:** `sharp` runs fine in a Vercel Node route (it does; `serverExternalPackages: ["sharp"]`).
- **Firmness:** settled.
- **Evidence:** `phase1-slice3-shop-profile.md` §4; `src/app/api/branding/logo/route.ts`.

### 14-allergen checkboxes (not free text)
- **Decided:** allergens are the 14 UK-regulated ones as checkboxes, stored as lowercase canonical keys in `menu_items.allergens text[]`. · 2026-07-26
- **Why:** UK food law; structured + consistent across shops; easier for owners than typing; avoids under-declaring by omission.
- **Alternatives considered:** free-text tags (inconsistent, weaker for compliance); both (more UI).
- **Assumes:** the 14 standard allergens cover what pilots need; free-text "may contain" notes deferred.
- **Firmness:** settled — but see R3 (customer side shows the short key, not the legal wording).
- **Evidence:** `phase1-slice2a-menu-editor.md` §3; `src/lib/allergens.ts`.

### Build method: subagent-driven development, per slice
- **Decided:** each Phase 1 slice was built on a feature branch with a written spec → plan → one implementer subagent per task → independent review → fix loop → final whole-branch review → merge/deploy. · 2026-07-26
- **Why:** it created a real quality gate. It caught, this session, at least three bugs that would otherwise have shipped (see Patterns).
- **Alternatives considered:** inline single-session build (faster per task, no independent review).
- **Assumes:** the reviews are worth their token/time cost — borne out this session.
- **Firmness:** settled as the working method; Lloyd asked to be consulted on decisions and was, at each genuine fork.
- **Evidence:** the three `phase1-*-plan.md` files; the SDD ledgers; branch/commit history.

## 4. Current architecture and state

Single Next.js 16 (App Router, TypeScript) app on Vercel; Supabase (Postgres + Auth + RLS + Realtime + Storage) as the backend. One codebase serves the customer PWA, the shop dashboard, and the API routes.

```
src/app/
  [slug]/                       customer menu PWA (per shop)
  [slug]/manifest.webmanifest/  dynamic per-shop PWA manifest (Slice 3)
  order/[token]/                tokened customer order-status page
  dashboard/                    orders queue (live via Realtime + sound)
  dashboard/menu|settings|qr|profile/   shop tools (Slices 1, 2a, 3)
  api/branding/logo/            sharp logo pipeline → Storage (Slice 3)
  api/notify-ready/             web-push sender
src/lib/         supabase clients, i18n, money, branding, allergens, dashboard helper
src/components/  shop/ (customer), dashboard/, ui/ (base-ui-based kit), pwa/
supabase/migrations/  8 migrations (schema, RLS, seed, allergens, storage, category-shop check)
tests/           rls.test.ts, storage-rls.test.ts (Vitest, run against live Supabase)
scripts/         seed-shop.sql (+ README) — manual pilot onboarding
```

- **Themes:** Latte Glass (customer), Travo (dashboard), applied via CSS variables; per-shop colour overrides through `brandingVars()`.
- **Tenant isolation** is entirely RLS-based, keyed on `is_staff_of(shop_id)`. This is the load-bearing security mechanism and the main place to be careful (R1).
- **Supabase project:** `iryavyogljedwgllaoit` (Zizwe org, Pro tier, eu-west-2). Not visible to the Vercel-integrated Supabase MCP anymore.
- **Deploy:** Vercel **CLI** (`vercel --prod`), *not* git-connected — so merging to `master` does not auto-deploy; deploys are a separate manual step. `master` is pushed to GitHub (`Nselenduna/ordernook`, private) and currently in sync at `00d245a`.
- **Deliberately simple:** reorder via up/down `sort_order` swaps (no drag-drop lib); `router.refresh()` after mutations instead of fine-grained optimistic state; currency hard-set to GBP.
- **Accidentally complex / watch:** the RLS policy surface (easy to under-specify a `with check`, see R1); the logo→icon URL derivation relies on the `icon-512`→`icon-192/180` filename string-replace convention.

## 5. Open threads

| Thread | Status | Blocked on | Next step |
|---|---|---|---|
| Slice 2b — menu option-groups editor (Size/Milk/Extras) | Not started | Lloyd's go-ahead | Brainstorm → spec → plan → subagent build |
| Slice 2c — item photos | Not started | 2b | Reuse the Slice 3 Storage + sharp pipeline for item images |
| Slice 4 — self-serve shop registration | Deferred by design | A pilot shop actually asking / scaling past hand-onboarding | Onboarding wizard + auth signup |
| Phase 2 — payments (Stripe Connect, direct charges) | Designed, not built | Slices 2/4 first | Reuse BookOnTheMap Connect onboarding + Billing scaffolding |
| Pilot recruitment (2–3 local shops) | Not started | Product readiness (nearly there) | Onboard via `scripts/seed-shop.sql`; give shop its URL + login + QR |
| Corner Grind real logo | Demo only | Lloyd sourcing a ≥512px logo | Currently a knowingly-blurry 96px icons8 emoji; replace via Profile upload |
| Deferred follow-ups (see risks) | Logged | — | Address before onboarding a real second shop |

## 6. Patterns observed

- **Reviews catch spec-ambiguity bugs, repeatedly** — 3 times this session an independent review caught a real defect that traced back to my own spec/plan wording, not sloppy implementation: brand colour written to the wrong field (`accent` vs `primary`), the `category_id` cross-tenant RLS gap, and price validation accepting scientific notation (`1e5`→£100k). → The spec is the weak point; the subagent review gate is the net that catches it. Keep the gate.
- **"The backend already supports it"** — 3 slices (1, 2a, 3) turned out to be *mostly UI* because Phase 0 built the schema + RLS thoroughly (staff CRUD policies, `is_available`/`is_paused` enforcement in `create_order`, `photo_url`/`allergens` columns). → Phase 0's over-investment in the data layer is paying compounding dividends; lean on it.
- **Secrets leaking into git, then rotated** — the Corner Grind dev password appeared committed (in `state.md` and `.env.test.example`) and was rotated + placeholdered this session. → A recurring hygiene failure mode with credentials; see R4.
- **RLS tests are flaky against live Supabase** — a transient failure appeared at the Slice 2a merge (storage tests skipped/timed out over the network), then passed clean on re-run. → The suite hits prod over the network; see R2.

## 7. Risk register

### R1: RLS `with check` policies verify `shop_id` but not related-row ownership
- **Evidence:** `menu_items` insert/update policies checked `is_staff_of(shop_id)` but not that `category_id` belonged to the same shop — a shop owner could inject items (incl. allergen data) onto another shop's live menu via a public category id. Found in the Slice 2a final review, fixed in migration `20260726140000`. It was a *pre-existing* Phase 0 policy, which means sibling policies may share the shape.
- **Likelihood / impact:** medium / high (cross-tenant data + allergen safety/liability).
- **Early warning sign:** any staff-writable table with a foreign key to another tenant-scoped table whose policy only checks the row's own `shop_id`.
- **Mitigation:** audit every `*_staff_insert/update` policy for FK-ownership before onboarding any real second shop; extend the RLS test suite to cover each FK-injection vector.
- **Status:** open (one instance fixed 2026-07-26; audit of the rest outstanding).

### R2: Integration tests run against live production Supabase and are network-flaky
- **Evidence:** transient test failure at the Slice 2a merge (same commit passed twice around it); the suite does real `signInWithPassword` + Storage fetches against prod. Flagged as a deferred follow-up in `state.md`.
- **Likelihood / impact:** medium (flakiness) / medium (would block CI or mask a real failure if it becomes a gate).
- **Early warning sign:** intermittent red on unchanged code; storage tests reported "skipped".
- **Mitigation:** point tests at a dedicated Supabase test project or a branch/local stack before making them a CI gate.
- **Status:** open.

### R3: Customer allergen badges show the short key, not the legal wording
- **Evidence:** editor stores canonical keys; the customer item sheet just capitalises them ("Gluten", "Nuts") rather than the FIR-2014 wording ("Cereals containing gluten", "Tree nuts"). Pre-existing since Slice 1; flagged in the Slice 2a review.
- **Likelihood / impact:** high it stays as-is unless fixed / medium-high (UK food-law precision on a safety field).
- **Early warning sign:** a shop or customer querying an allergen label's accuracy.
- **Mitigation:** map keys → legal labels on the customer side (the mapping already exists in `src/lib/allergens.ts`).
- **Status:** open.

### R4: Credentials committed to git
- **Evidence:** the Corner Grind dev password was committed in `state.md` (since Phase 0) and again in `.env.test.example`; rotated + placeholdered on 2026-07-26. The pilot seed (`scripts/seed-shop.sql`) also inserts directly into `auth.users` with an inline password the operator must remember to change.
- **Likelihood / impact:** medium (it already happened once) / medium (test-shop creds today; would be worse if a real shop's or a service key ever landed).
- **Early warning sign:** a real password/token in any committed file; the old committed value still lives in git history.
- **Mitigation:** keep `*.example` files placeholder-only; never document live passwords in tracked docs; rotation neutralises committed values (history rewrite only if the repo goes public).
- **Status:** open (occurrence handled; the pattern remains a live hazard).

### R5: Currency hardcoded to GBP while the schema is multi-country
- **Evidence:** the menu editor and the manifest default to `"GBP"`; `create_order` derives currency from `countries.currency` via `shop.country_code`. The first item added on a hypothetical non-GB shop would be miswritten as GBP. Flagged in the Slice 2a review.
- **Likelihood / impact:** low now (UK-only pilot) / medium later (data repair if a non-GB shop onboards before this is fixed).
- **Early warning sign:** onboarding any shop with `country_code <> 'GB'`.
- **Mitigation:** derive currency from `countries.currency` (join on `shop.country_code`) rather than scraping existing items / defaulting.
- **Status:** open (deferred by design while UK-only).

### R6: Reasoning lives largely in one long session + one person's head
- **Evidence:** essentially all of Phase 1's rationale was produced in a single 26 Jul session; the doc trail (`decisions/log.md`, spec/plan files, and now this snapshot) is good, but the SDD ledgers were deleted after each slice per the method.
- **Likelihood / impact:** medium / medium (re-litigating settled calls, e.g. the direct-vs-destination charge model, or the name diligence).
- **Early warning sign:** someone proposing OrderMate/OrderNest again, or destination charges, without knowing they were evaluated.
- **Mitigation:** this snapshot; keep `decisions/log.md` current.
- **Status:** open (this snapshot is the first mitigation).

## 8. Gaps in this snapshot

- **Past-session transcripts not re-read.** The session-management MCP was mid-reconnect during this write-up, so I relied on the current session + git + the in-repo docs. Low loss for OrderNook specifically (its history is almost entirely in this session + the committed docs), but the pre-11-Jul planning that produced `SPEC.md`/`HANDOFF.md` was not re-read here — **HANDOFF.md (Part 2) holds the original Phase 0 decision log** and is the place to look if a Phase 0 rationale is ever in question.
- **RLS audit not performed.** R1 identifies the risk but I have not actually reviewed every staff-write policy for FK-ownership gaps — that's an outstanding action, not a completed finding.
- **Payments (Phase 2) is design-only.** The direct-charge decision is recorded from `SPEC.md` and this session's review of BookOnTheMap; none of it is implemented or tested, so treat that section as intent, not fact.
- **Exact iPhone-test timestamp** is inferred from the session, not a commit — the device test left no git trace.

_Only Lloyd can fill the biggest remaining gap: whether a pilot shop is lined up, and whether OrderNook's name should get a formal UK IPO trademark check before marketing spend._
