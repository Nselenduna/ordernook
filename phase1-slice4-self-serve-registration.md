# Phase 1 · Slice 4 — Self-Serve Business Registration (design)

**Date:** 2026-08-04
**Status:** Design approved, ready for implementation plan

## Goal
Let a café owner create their own OrderNook shop with no manual setup from Lloyd.
Today the only shops exist from a seed migration; there is no signup path and no
shop-creation flow. This slice closes the gap between "a café discovers OrderNook"
and "a café is a paying-capable shop on a trial."

## Why
It is the single missing link in the funnel. Billing (Phase 2A) already lets a shop
pay and unlock itself end-to-end; without self-serve registration, every new customer
requires manual onboarding, which does not scale.

## Decisions (from brainstorm)
- **Bare registration** — business name + email + password → working shop on a 30-day
  trial, landing in the existing dashboard (empty menu). Owners use the menu/branding
  editors already built. No setup wizard/checklist this slice.
- **Instant access** — sign up returns a live session immediately; the shop is created
  inline; no email-confirmation step. Customers order as guests (no auth), so only owner
  signups are affected.
- **Auto-suggest, editable slug** — derived from the business name, shown as
  `ordernook.uk/<slug>`, editable, with a live availability check.
- **One shop per account** — matches `getStaffShop`'s single-shop lookup. Multi-shop
  owners are out of scope.
- **Country hardcoded `GB`** — no country field this slice.

## Required setup step (not code)
Supabase → Auth → Email → **disable "Confirm email"** for the OrderNook project. Instant
access depends on `signUp` returning a session. This only affects owner signups. If it is
left on, the flow degrades gracefully (see Error handling → Stage A defensive case) rather
than dead-ending.

## Data layer

### Column defaults handle the trial
`shops` already defaults `subscription_status='trialing'`, `plan_tier='basic'`, and
`trial_ends_at = now() + interval '30 days'` (migration `20260802010000`). The
`protect_shop_billing` trigger is **BEFORE UPDATE only**, so inserting a shop with those
billing values is not blocked. No special handling needed.

### `register_shop` RPC (the only privileged writer)
There are no INSERT policies on `shops` or `staff_users` (only `shops_public_read` select,
`staff_users_self_read` select), so authenticated users cannot insert directly — by design.
A single `SECURITY DEFINER` function is the sole writer. New migration, e.g.
`20260804xxxxxx_register_shop.sql`.

```
register_shop(p_name text, p_slug text) returns public.shops
  language plpgsql
  security definer
  set search_path = public
```

Runs as one transaction:
1. **Auth guard** — `if auth.uid() is null then raise exception 'not_authenticated'`.
2. **One-shop-per-owner guard** — if a `staff_users` row already exists for `auth.uid()`,
   raise `already_registered`. (Also makes partial-failure recovery safe.)
3. **Normalize + validate slug** — lower-case; must match `^[a-z0-9-]{3,40}$`, no leading/
   trailing/double hyphen; not in the reserved list (below) → else `slug_invalid` /
   `slug_reserved`.
4. **Validate name** — trimmed, non-empty, length ≤ 80 → else `name_invalid`.
5. **Insert `shops`** (`name`, `slug`, `country_code='GB'`); defaults fill
   `subscription_status`/`plan_tier`/`trial_ends_at`/`payment_modes`.
6. **Insert `staff_users`** (`shop_id`, `auth.uid()`, role `'owner'`).
7. **Return** the new `shops` row.
8. On a slug race, the `shops.slug` unique constraint raises `unique_violation` → caught and
   re-raised as `slug_taken`.

**Reserved slugs** (collide with real top-level routes / assets):
`dashboard, order, api, auth, login, register, admin, static, _next, favicon, manifest`.
Kept as an array constant in the function.

**Typed errors** raised with recognizable messages the client maps to UI:
`not_authenticated, already_registered, slug_invalid, slug_reserved, slug_taken, name_invalid`.

Grant: `execute` to `authenticated` only.

### Live slug check (client)
Debounced `select slug from shops where slug = ?` (permitted by `shops_public_read`) plus the
same client-side format + reserved rules. The RPC remains the authoritative check on submit,
so a race cannot create duplicates.

### `GB` precondition
`shops.country_code` is a FK to `countries(code)`. Verify `GB` exists in `countries` during
implementation; if missing, seed it in the migration.

## Frontend

### Route: `/dashboard/register` (client component)
Travo Purple, reusing the login page's `Card`/`Input`/`Label`/`Button`. Title "Create your
shop"; footer link "Already have a shop? Log in" → `/dashboard/login`.

Fields, in order:
- **Business name** — on change, live-derives the slug via a `slugify()` helper (lowercase,
  spaces→hyphens, strip invalid chars, collapse/trim hyphens). Auto-derive stops once the user
  edits the slug manually (a `slugTouched` flag).
- **Shop link (slug)** — rendered with a `ordernook.uk/` prefix. Inline status under it,
  debounced ~400ms: `checking… / ✓ available / ✗ taken / ✗ too short / ✗ that word's reserved`.
- **Email** (`type=email`, browser validation), **Password** (`type=password`, min length per
  Supabase).

Submit ("Create your shop") disabled until: name present, slug valid **and** available, email
valid, password present. Spinner while submitting.

### Submit flow
1. `supabase.auth.signUp({ email, password })`.
2. If a session is returned → call `register_shop` RPC with `{ p_name, p_slug }`.
3. On success → `router.push('/dashboard')` then `router.refresh()`.

### Login page change
Add a "Create your shop" link/button under the sign-in form → `/dashboard/register`.

### Partial-failure recovery
If a user is authenticated but has no linked shop (signUp succeeded, RPC failed), the register
route detects this on load — `supabase.auth.getUser()` returns a user **and** a client query
`select id from staff_users where auth_user_id = <uid> limit 1` returns nothing — and shows
**only** the shop-name/slug step to retry `register_shop`. No orphaned auth users, no duplicate
signup. (The email/password fields are hidden because the account already exists.)

### i18n
New `register.*` keys in `i18n.ts` for every label, placeholder, status, and error string,
matching the existing `t()` pattern.

## Error handling matrix

| Stage | Condition | UI |
|-------|-----------|----|
| A signUp | email already registered | inline: "That email's already registered — log in instead" (link) |
| A signUp | weak password / other | friendly mapped message |
| A signUp | **no session returned** (confirm-email left ON) | "Check your email to confirm, then log in." (graceful, not a dead end) |
| B RPC | `slug_taken` | slug field error "just got taken — pick another"; stay on form |
| B RPC | `slug_invalid` / `slug_reserved` | slug field error (belt-and-braces) |
| B RPC | `name_invalid` | name field error |
| B RPC | `already_registered` | redirect to `/dashboard` |
| B RPC | `not_authenticated` / unknown | generic toast; stay on form |

## Test plan

### Unit (vitest)
- `slugify()` — spaces→hyphens, uppercase→lower, punctuation stripped, accents/emoji handled,
  double/leading/trailing hyphens collapsed, empty/very-long inputs.
- Slug format validator — accepts valid, rejects too short (<3), too long (>40), bad chars,
  leading/trailing/double hyphen, and each reserved word.

### Database / RPC (SQL, run against a branch or local)
- Happy path: authenticated call creates exactly one `shops` row (status `trialing`,
  `trial_ends_at ≈ now()+30d`, `plan_tier basic`, `country_code GB`) and one `staff_users`
  row (role `owner`) for `auth.uid()`; returns the shop.
- `already_registered`: second call by the same user raises.
- `slug_taken`: two users racing the same slug → exactly one succeeds, the other raises
  `slug_taken`; no duplicate rows.
- `slug_reserved` / `slug_invalid` / `name_invalid`: each raises its typed error, no rows written.
- `not_authenticated`: anon call raises, no rows written.
- Grant check: `authenticated` can execute; `anon` cannot.

### Integration / manual (verified in browser, per the project workflow)
1. From `/dashboard/login`, follow "Create your shop" → register form renders.
2. Type "Corner Grind Two" → slug auto-fills `corner-grind-two`, shows ✓ available.
3. Edit slug to an existing shop's slug → shows ✗ taken; submit disabled.
4. Edit slug to `dashboard` → shows ✗ reserved.
5. Valid name/slug/email/password → submit → lands on `/dashboard`, no lock screen, empty
   menu, nav shows the new shop; `settings` shows "Trial: ~30 days left".
6. DB check: one `shops` + one `staff_users(owner)` row created with correct trial fields.
7. Re-submitting the same email → "already registered — log in" message.
8. Partial-failure recovery: simulate RPC failure after signUp (e.g. reserved slug forced) →
   reload register while authed → shop-only retry step appears → completing it creates the shop.
9. Add a menu item + place a test order end-to-end on the new shop to confirm it is fully
   functional (not just created).

### Acceptance criteria
- A brand-new visitor can self-register and reach a working, trial-active dashboard with zero
  manual steps from Lloyd.
- Exactly one shop + one owner link per registration; no duplicates under slug races.
- Reserved/invalid slugs and duplicate emails are rejected with clear messages.
- No orphaned auth users after a mid-flow failure.
- `npm run build` and the test suite pass.

## Out of scope (follow-ups)
- Setup wizard / onboarding checklist.
- Multi-shop owners; inviting additional staff.
- Country selection / non-GB shops.
- Making the dashboard installable as a PWA (separate flagged follow-up).
- Password strength UI / leaked-password protection toggle (separate Supabase setting).
