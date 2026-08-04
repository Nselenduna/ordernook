# handoff.md — OrderNook (session end: 4 Aug 2026)

## TL;DR
**Phase 2A shop subscriptions is COMPLETE and self-healing in production.** The billing
loop now has two independent paths that both write subscription state to the DB:
1. **On-return reconciliation** (covers the subscribe moment) — verified test-mode.
2. **Live Stripe webhook** (covers lifecycle: renewals, cancels, failed payments) — verified live.

**Slice 4 — Self-serve registration is SHIPPED and LIVE** (deployed 4 Aug 2026 → ordernook.uk).
Owner signup at `/dashboard/register` (name+email+password → `register_shop` SECURITY DEFINER RPC
→ shop on a 30-day trial → dashboard). Built via subagent-driven TDD; 50/50 tests pass; whole-branch
review ship-ready. RPC migration `20260804140000_register_shop.sql` applied to the OrderNook DB.
Verified end-to-end in browser: full signUp happy path (auth user auto-confirmed + shop created,
trialing/GB/30d/owner) AND recovery-mode path; slug UX (available/taken/reserved/too-short) live;
prod page renders at ordernook.uk/dashboard/register.
**Supabase Auth "Confirm email" is now OFF** (`mailer_autoconfirm=true`) — required for the instant-
access design. Docs: [phase1-slice4-self-serve-registration.md](phase1-slice4-self-serve-registration.md)
(spec) + `-plan.md` (implementation plan).

Optional follow-up: consider disabling email-enumeration protection so a duplicate-email signup shows
"already registered" rather than the confirm-email message (minor UX papercut, non-blocking).

## Run it
```
cd "C:\Users\lloyd\OneDrive\Desktop\Projexts 2025\OrderNook\order-ahead"
npm run dev
```
- Live: https://ordernook.uk · deploy: `vercel --prod --yes`
- Supabase: iryavyogljedwgllaoit (Zizwe org, Pro) · Repo: Nselenduna/ordernook

## What shipped this session (verified)
1. **Reconcile-on-return fix** (`src/lib/billing.ts` `reconcileFromCheckoutSession`,
   `checkout/route.ts` success_url `?session_id=...`, `settings/page.tsx` awaits reconcile
   before `getStaffShop`). Verified end-to-end in **test mode** on pilot-test: Subscribe →
   test card 4242 → returned to settings → DB flipped trialing→active with correct Stripe IDs,
   no webhook. UI showed Active + Manage billing. Committed `52277bb`, deployed to prod.
2. **Live Stripe webhook created + verified.** Endpoint `we_1U0hYpDeO3cMpMIL12QGia8N`,
   URL https://ordernook.uk/api/stripe/webhook, **Active**, scope **Your account**, 5 events:
   checkout.session.completed, customer.subscription.created/updated/deleted, invoice.payment_failed.
   Prod `STRIPE_WEBHOOK_SECRET` set + redeployed; verified: unsigned POST returns
   `{"error":"bad_signature"}` (secret loaded) and the whsec_ values match Stripe↔Vercel.

## Stripe facts (OrderNook — dedicated account, separate per app)
- **Live account: `acct_1U0RkqDeO3cMpMIL`** (matches live price/customer IDs).
- Stripe CLI paired as project **`ordernook`** (`stripe login --project-name ordernook`).
  Its restricted key (`rk_live_...`) can **READ** webhooks but **CANNOT create** them — that's why
  the create had to be done in the Dashboard, not the CLI.
- Test price `price_1U0S78DeO3cMpMILVcyVZay5` · Live price `price_1U0S9UDeO3cMpMILOCL8ibiY`
- Webhook handler: `src/app/api/stripe/webhook/route.ts` (classic constructEvent + admin client).

## Known items / next actions
1. ~~corner-grind £12 live sub~~ **RESOLVED 4 Aug:** cancelled + refunded in Dashboard; the live
   webhook auto-wrote `canceled` (end-to-end proof), then row restored to trialing/2027-01-01,
   stripe_subscription_id cleared, customer cus_V0eZB5... kept. corner-grind usable as demo shop again.
2. **Cleanup (low priority):** a leftover **TEST-mode** webhook endpoint
   `we_1U0SmGDeO3cMpMIL8aiMP9kI` points at the prod URL → 400s on any test activity (harmless,
   just noise). Delete in Dashboard test mode → Webhooks → ⋯ → Delete.
3. pilot-test is restored to trial demo state (trialing, 2027-01-01, no Stripe IDs).
   Creds: owner@pilot-test.test / PilotTest-Demo1!
4. **Flagged follow-ups:** (a) make the DASHBOARD installable as a PWA (only customer /[slug]
   installs today); (b) **Slice 4 self-serve business registration** — no "create account" flow exists.
5. **Phase 2B:** customer online payments (Stripe Connect Standard; reuse BookOnTheMap scaffolding).

## Architecture (billing)
- `entitlement.ts` isEntitled(shop): active OR (trialing AND trial_ends_at future).
- `dashboard/layout.tsx`: LockScreen if shop && !isEntitled (getStaffShopOrNull, non-redirecting).
- `[slug]/page.tsx`: paused if is_paused || !isEntitled.
- Migrations: `20260802010000_shop_subscriptions.sql` (is_entitled(), create_order gated),
  `20260802020000_protect_billing_columns.sql` (protect_shop_billing trigger blocks authenticated/anon
  writes to billing cols → must use admin/service-role client for stripe_customer_id etc.).

## Gotchas (also in CLAUDE.md/memory)
- supabase-js storage.upload: pass `new Blob([new Uint8Array(buf)], {type})` NOT a raw Node Buffer —
  undici on Vercel corrupts binary (broken images). Doesn't repro locally.
- PWA dev: after dev restart, unregister SW + clear caches or stale chunks persist.
- `vercel env pull` returns EMPTY values for sensitive-flagged vars (STRIPE_*, SUPABASE_*, etc.) —
  can't retrieve prod secrets this way; set them in the Vercel dashboard/CLI directly.
