# Slice 4 — Self-Serve Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a café owner self-register — business name + email + password → a working shop on a 30-day trial in the existing dashboard, with zero manual setup.

**Architecture:** A client `/dashboard/register` route runs `supabase.auth.signUp` then calls a single `SECURITY DEFINER` RPC `register_shop` that atomically creates the `shops` row (defaults fill the trial) and the owner `staff_users` link. Slug is auto-derived from the name, checked live, and validated authoritatively in the RPC.

**Tech Stack:** Next.js App Router (client component), Supabase (Postgres RPC, Auth, RLS), shadcn/ui, vitest.

## Global Constraints

- **Design template:** Travo Purple (dashboard) — reuse login page's `Card`/`Input`/`Label`/`Button`; 44px min touch targets; pill buttons.
- **Country:** hardcoded `'GB'` this slice (confirmed seeded in `public.countries`).
- **One shop per account** — `getStaffShop` assumes a single `staff_users` row per user.
- **No service-role key in app code** for this flow — the RPC (SECURITY DEFINER) is the only privileged writer; grant execute to `authenticated` only.
- **All user-facing strings** go through `t()` in `src/lib/i18n.ts` under new `register.*` keys.
- **Reserved slugs:** `dashboard, order, api, auth, login, register, admin, static, _next, favicon, manifest`.
- **Slug rule:** `^[a-z0-9]+(-[a-z0-9]+)*$`, length 3–40.

## Prerequisite (manual, one-time — do before Task 3 browser testing)

Supabase → **OrderNook** project → Authentication → Providers/Email → **turn OFF "Confirm email"**. Instant access depends on `signUp` returning a session. Only affects owner signups (customers order as guests).

## File Structure

- `src/lib/slug.ts` (create) — `slugify()`, `validateSlug()`, `RESERVED_SLUGS`. Pure, unit-tested.
- `supabase/migrations/<timestamp>_register_shop.sql` (create) — the `register_shop` RPC + grants.
- `tests/slug.test.ts` (create) — unit tests for slug helpers.
- `tests/register-shop.test.ts` (create) — RPC guard/negative tests (repeatable, write nothing).
- `src/app/dashboard/register/page.tsx` (create) — the registration form + recovery mode.
- `src/lib/i18n.ts` (modify) — add `register.*` keys.
- `src/app/dashboard/login/page.tsx` (modify) — add "Create your shop" link.
- `.env.test` (modify) — add `REGISTER_TEST_EMAIL` / `REGISTER_TEST_PASSWORD` (a no-shop account).

---

### Task 1: Slug helpers (`src/lib/slug.ts`)

**Files:**
- Create: `src/lib/slug.ts`
- Test: `tests/slug.test.ts`

**Interfaces:**
- Produces:
  - `slugify(input: string): string`
  - `validateSlug(slug: string): "too_short" | "too_long" | "bad_format" | "reserved" | null` (null = valid)
  - `RESERVED_SLUGS: readonly string[]`

- [ ] **Step 1: Write the failing test**

Create `tests/slug.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { slugify, validateSlug } from "../src/lib/slug"

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => expect(slugify("Corner Grind")).toBe("corner-grind"))
  it("strips punctuation", () => expect(slugify("Joe's Café!")).toBe("joe-s-cafe"))
  it("collapses repeated separators", () => expect(slugify("A   B---C")).toBe("a-b-c"))
  it("trims leading/trailing hyphens", () => expect(slugify("  -Hello-  ")).toBe("hello"))
  it("removes accents", () => expect(slugify("Crème Brûlée")).toBe("creme-brulee"))
  it("drops emoji", () => expect(slugify("Coffee ☕ Bar")).toBe("coffee-bar"))
  it("caps at 40 chars with no trailing hyphen", () => {
    const out = slugify("a".repeat(45) + " tail")
    expect(out.length).toBeLessThanOrEqual(40)
    expect(out.endsWith("-")).toBe(false)
  })
  it("returns empty for all-punctuation input", () => expect(slugify("!!!")).toBe(""))
})

describe("validateSlug", () => {
  it("accepts a valid slug", () => expect(validateSlug("corner-grind")).toBeNull())
  it("rejects too short", () => expect(validateSlug("ab")).toBe("too_short"))
  it("rejects too long", () => expect(validateSlug("a".repeat(41))).toBe("too_long"))
  it("rejects leading hyphen", () => expect(validateSlug("-abc")).toBe("bad_format"))
  it("rejects trailing hyphen", () => expect(validateSlug("abc-")).toBe("bad_format"))
  it("rejects double hyphen", () => expect(validateSlug("a--b")).toBe("bad_format"))
  it("rejects uppercase", () => expect(validateSlug("Abc")).toBe("bad_format"))
  it("rejects reserved words", () => expect(validateSlug("dashboard")).toBe("reserved"))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/slug.test.ts`
Expected: FAIL — cannot find module `../src/lib/slug`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/slug.ts`:

```ts
export const RESERVED_SLUGS: readonly string[] = [
  "dashboard", "order", "api", "auth", "login", "register",
  "admin", "static", "_next", "favicon", "manifest",
]

/** Derive a URL-safe slug from free text. Lossy by design. May return "". */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accent marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // any run of non-alphanumerics → single hyphen
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "") // a slice may have left a trailing hyphen
}

export type SlugError = "too_short" | "too_long" | "bad_format" | "reserved"

/** Authoritative client-side check. Returns null when the slug is valid. */
export function validateSlug(slug: string): SlugError | null {
  if (slug.length < 3) return "too_short"
  if (slug.length > 40) return "too_long"
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return "bad_format"
  if (RESERVED_SLUGS.includes(slug)) return "reserved"
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/slug.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.ts tests/slug.test.ts
git commit -m "feat(register): slug derivation + validation helpers"
```

---

### Task 2: `register_shop` RPC + guard tests

**Files:**
- Create: `supabase/migrations/<timestamp>_register_shop.sql` (use a timestamp after `20260802020000`)
- Create: `tests/register-shop.test.ts`
- Modify: `.env.test` (add a no-shop test account)

**Interfaces:**
- Produces: Postgres RPC `register_shop(p_name text, p_slug text) returns public.shops`, callable by `authenticated`. Raises typed messages: `not_authenticated`, `already_registered`, `name_invalid`, `slug_invalid`, `slug_reserved`, `slug_taken`.

- [ ] **Step 1: Create a no-shop test account**

In the Supabase dashboard (Auth → Users → Add user, with "Confirm email" already off from the prerequisite), create `register-test@ordernook.test` with a strong password. Do **not** register a shop for it. Add to `.env.test`:

```
REGISTER_TEST_EMAIL=register-test@ordernook.test
REGISTER_TEST_PASSWORD=<the password you set>
```

(`SHOP_A_EMAIL` / `SHOP_A_PASSWORD` already exist and belong to corner-grind, which has a shop.)

- [ ] **Step 2: Write the failing test**

Create `tests/register-shop.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { config } from "dotenv"

config({ path: ".env.test" })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url, anon)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}

// Every case here raises BEFORE any insert, so no rows are written and the
// no-shop account stays shopless — the suite is repeatable.
describe("register_shop RPC guards", () => {
  let noShop: SupabaseClient // account with NO staff_users row
  let hasShop: SupabaseClient // corner-grind owner (already has a shop)

  beforeAll(async () => {
    noShop = await signedIn(process.env.REGISTER_TEST_EMAIL!, process.env.REGISTER_TEST_PASSWORD!)
    hasShop = await signedIn(process.env.SHOP_A_EMAIL!, process.env.SHOP_A_PASSWORD!)
  })

  it("anon cannot register", async () => {
    const anonClient = createClient(url, anon)
    const { error } = await anonClient.rpc("register_shop", { p_name: "X", p_slug: "some-cafe" })
    expect(error?.message ?? "").toContain("not_authenticated")
  })

  it("rejects a reserved slug and writes nothing", async () => {
    const { error } = await noShop.rpc("register_shop", { p_name: "Test Cafe", p_slug: "dashboard" })
    expect(error?.message ?? "").toContain("slug_reserved")
    const { data } = await noShop.from("staff_users").select("id")
    expect(data ?? []).toHaveLength(0)
  })

  it("rejects an invalid (too short) slug", async () => {
    const { error } = await noShop.rpc("register_shop", { p_name: "Test Cafe", p_slug: "ab" })
    expect(error?.message ?? "").toContain("slug_invalid")
  })

  it("rejects an empty name", async () => {
    const { error } = await noShop.rpc("register_shop", { p_name: "  ", p_slug: "valid-slug" })
    expect(error?.message ?? "").toContain("name_invalid")
  })

  it("rejects a second shop for an already-registered owner", async () => {
    const { error } = await hasShop.rpc("register_shop", { p_name: "Another", p_slug: "another-cafe" })
    expect(error?.message ?? "").toContain("already_registered")
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/register-shop.test.ts`
Expected: FAIL — RPC `register_shop` does not exist (PostgREST 404 / "Could not find the function").

- [ ] **Step 4: Write the migration**

Create `supabase/migrations/<timestamp>_register_shop.sql`:

```sql
-- Self-serve shop registration. The ONLY writer of shops/staff_users for owners.
-- SECURITY DEFINER so it inserts past the (intentionally absent) INSERT policies on
-- shops/staff_users. Column defaults fill subscription_status='trialing',
-- plan_tier='basic', trial_ends_at=now()+30d. GB is seeded in public.countries.
-- The protect_shop_billing trigger is BEFORE UPDATE only, so INSERT here is fine.

create or replace function public.register_shop(p_name text, p_slug text)
returns public.shops
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid   := auth.uid();
  v_name text   := btrim(coalesce(p_name, ''));
  v_slug text   := lower(btrim(coalesce(p_slug, '')));
  v_reserved text[] := array[
    'dashboard','order','api','auth','login','register',
    'admin','static','_next','favicon','manifest'
  ];
  v_shop public.shops;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.staff_users where auth_user_id = v_uid) then
    raise exception 'already_registered' using errcode = 'P0001';
  end if;

  if v_name = '' or length(v_name) > 80 then
    raise exception 'name_invalid' using errcode = 'P0001';
  end if;

  if length(v_slug) < 3 or length(v_slug) > 40
     or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'slug_invalid' using errcode = 'P0001';
  end if;

  if v_slug = any(v_reserved) then
    raise exception 'slug_reserved' using errcode = 'P0001';
  end if;

  begin
    insert into public.shops (name, slug, country_code)
    values (v_name, v_slug, 'GB')
    returning * into v_shop;
  exception when unique_violation then
    raise exception 'slug_taken' using errcode = 'P0001';
  end;

  insert into public.staff_users (shop_id, auth_user_id, role)
  values (v_shop.id, v_uid, 'owner');

  return v_shop;
end;
$$;

revoke all on function public.register_shop(text, text) from public, anon;
grant execute on function public.register_shop(text, text) to authenticated;
```

- [ ] **Step 5: Apply the migration**

Apply to the OrderNook project (`iryavyogljedwgllaoit`) via the Supabase MCP `apply_migration` (name `register_shop`), or `supabase db push` if using the CLI. Confirm it appears in `list_migrations`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/register-shop.test.ts`
Expected: PASS (all five guard cases).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/*_register_shop.sql tests/register-shop.test.ts
git commit -m "feat(register): register_shop RPC + guard tests"
```

(Do not commit `.env.test` if it is gitignored — verify with `git status` first.)

---

### Task 3: Registration page, i18n, and login link

**Files:**
- Create: `src/app/dashboard/register/page.tsx`
- Modify: `src/lib/i18n.ts` (add `register.*` keys)
- Modify: `src/app/dashboard/login/page.tsx` (add link)

**Interfaces:**
- Consumes: `slugify`, `validateSlug` from `src/lib/slug.ts`; `register_shop` RPC; `createClient` from `src/lib/supabase/client`.

- [ ] **Step 1: Add i18n keys**

In `src/lib/i18n.ts`, add these keys alongside the existing `login.*` block (match the file's existing object/format):

```
register.title = "Create your shop"
register.subtitle = "Start your 30-day free trial. No card needed."
register.name = "Business name"
register.namePlaceholder = "The Corner Grind"
register.slug = "Your shop link"
register.slugChecking = "Checking…"
register.slugAvailable = "✓ Available"
register.slugTaken = "✗ That link is taken"
register.slugTooShort = "✗ At least 3 characters"
register.slugReserved = "✗ That word is reserved"
register.slugInvalid = "✗ Use lowercase letters, numbers and hyphens"
register.email = "Email"
register.password = "Password"
register.submit = "Create your shop"
register.submitting = "Creating…"
register.haveShop = "Already have a shop?"
register.logIn = "Log in"
register.errorEmailTaken = "That email's already registered — log in instead."
register.errorConfirmEmail = "Check your email to confirm, then log in."
register.errorGeneric = "Something went wrong. Please try again."
register.recoveryNote = "Your account's ready — just name your shop to finish."
login.createShop = "New here? Create your shop"
```

- [ ] **Step 2: Build the registration page**

Create `src/app/dashboard/register/page.tsx`:

```tsx
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { t } from "@/lib/i18n"
import { createClient } from "@/lib/supabase/client"
import { slugify, validateSlug } from "@/lib/slug"

type SlugState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok" }
  | { kind: "bad"; msg: string }

export default function RegisterPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [recovery, setRecovery] = useState(false) // authed but no shop
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailErr, setEmailErr] = useState<string | null>(null)
  const [slugState, setSlugState] = useState<SlugState>({ kind: "idle" })
  const [submitting, setSubmitting] = useState(false)
  const checkSeq = useRef(0)

  // On load: authed + already has a shop → dashboard; authed + no shop → recovery.
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !active) return
      const { data } = await supabase.from("staff_users").select("id").limit(1).maybeSingle()
      if (!active) return
      if (data) router.replace("/dashboard")
      else setRecovery(true)
    })()
    return () => { active = false }
  }, [supabase, router])

  // Auto-derive slug from name until the user edits the slug themselves.
  function onName(v: string) {
    setName(v)
    if (!slugTouched) setSlug(slugify(v))
  }
  function onSlug(v: string) {
    setSlugTouched(true)
    setSlug(slugify(v))
  }

  // Debounced availability check.
  useEffect(() => {
    const s = slug
    const fmt = validateSlug(s)
    if (fmt) {
      const map: Record<string, string> = {
        too_short: t("register.slugTooShort"),
        too_long: t("register.slugInvalid"),
        bad_format: t("register.slugInvalid"),
        reserved: t("register.slugReserved"),
      }
      setSlugState({ kind: "bad", msg: map[fmt] })
      return
    }
    setSlugState({ kind: "checking" })
    const seq = ++checkSeq.current
    const id = setTimeout(async () => {
      const { data } = await supabase.from("shops").select("slug").eq("slug", s).maybeSingle()
      if (seq !== checkSeq.current) return // superseded
      setSlugState(data ? { kind: "bad", msg: t("register.slugTaken") } : { kind: "ok" })
    }, 400)
    return () => clearTimeout(id)
  }, [slug, supabase])

  const canSubmit =
    name.trim().length > 0 &&
    slugState.kind === "ok" &&
    (recovery || (/.+@.+\..+/.test(email) && password.length > 0)) &&
    !submitting

  function mapRpcError(message: string) {
    if (message.includes("slug_taken")) return setSlugState({ kind: "bad", msg: t("register.slugTaken") })
    if (message.includes("slug_reserved")) return setSlugState({ kind: "bad", msg: t("register.slugReserved") })
    if (message.includes("slug_invalid")) return setSlugState({ kind: "bad", msg: t("register.slugInvalid") })
    if (message.includes("already_registered")) return router.replace("/dashboard")
    toast.error(t("register.errorGeneric"))
  }

  async function createShop() {
    const { error } = await supabase.rpc("register_shop", { p_name: name.trim(), p_slug: slug })
    if (error) { mapRpcError(error.message); return false }
    router.push("/dashboard")
    router.refresh()
    return true
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setEmailErr(null)
    try {
      if (!recovery) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
        if (error) {
          if (/registered|already/i.test(error.message)) setEmailErr(t("register.errorEmailTaken"))
          else toast.error(error.message)
          return
        }
        if (!data.session) { toast.error(t("register.errorConfirmEmail")); return }
      }
      await createShop()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="theme-travo flex flex-1 flex-col items-center justify-center bg-background px-4 text-foreground">
      <Card className="w-full max-w-sm shadow-[0_4px_16px_rgba(123,97,255,.10)] ring-0">
        <CardHeader>
          <CardTitle className="font-heading text-xl">{t("register.title")}</CardTitle>
          <CardDescription>{recovery ? t("register.recoveryNote") : t("register.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-name">{t("register.name")}</Label>
              <Input id="reg-name" required value={name} placeholder={t("register.namePlaceholder")}
                onChange={(e) => onName(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-slug">{t("register.slug")}</Label>
              <div className="flex items-center gap-1 rounded-xl border px-3 h-11">
                <span className="text-sm text-muted-foreground">ordernook.uk/</span>
                <input id="reg-slug" value={slug} onChange={(e) => onSlug(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm" autoCapitalize="none" autoCorrect="off" />
              </div>
              <p className="text-xs h-4" data-testid="slug-status">
                {slugState.kind === "checking" && t("register.slugChecking")}
                {slugState.kind === "ok" && <span className="text-green-600">{t("register.slugAvailable")}</span>}
                {slugState.kind === "bad" && <span className="text-red-600">{slugState.msg}</span>}
              </p>
            </div>
            {!recovery && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reg-email">{t("register.email")}</Label>
                  <Input id="reg-email" type="email" required autoComplete="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" />
                  {emailErr && <p className="text-xs text-red-600">{emailErr} <Link href="/dashboard/login" className="underline">{t("register.logIn")}</Link></p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reg-password">{t("register.password")}</Label>
                  <Input id="reg-password" type="password" required autoComplete="new-password" value={password}
                    onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl" />
                </div>
              </>
            )}
            <Button type="submit" disabled={!canSubmit} className="h-11 w-full rounded-full">
              {submitting ? t("register.submitting") : t("register.submit")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("register.haveShop")} <Link href="/dashboard/login" className="underline">{t("register.logIn")}</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 3: Add the link on the login page**

In `src/app/dashboard/login/page.tsx`, add `import Link from "next/link"` and, immediately after the `</form>` inside `CardContent`, add:

```tsx
<p className="mt-4 text-center text-sm text-muted-foreground">
  <Link href="/dashboard/register" className="underline">{t("login.createShop")}</Link>
</p>
```

- [ ] **Step 4: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds, `/dashboard/register` appears in the route list, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/register/page.tsx src/lib/i18n.ts src/app/dashboard/login/page.tsx
git commit -m "feat(register): self-serve registration page + login link"
```

---

### Task 4: End-to-end verification in the browser

**Files:** none (verification only). Uses the preview browser tools against `npm run dev`.

- [ ] **Step 1: Confirm the email-confirmation prerequisite is done**

In Supabase Auth, "Confirm email" is OFF (see Prerequisite). If not, do it now — otherwise signup returns no session and the flow shows the confirm-email fallback.

- [ ] **Step 2: Run the dev server and open register**

Start dev (test-mode env is fine), open `http://localhost:3000/dashboard/register`. Verify the form renders (Travo Purple card).

- [ ] **Step 3: Slug behaviours**

- Type "Corner Grind Two" → slug auto-fills `corner-grind-two`, status shows ✓ Available.
- Edit slug to `corner-grind` (existing) → status ✗ taken; submit disabled.
- Edit slug to `dashboard` → status ✗ reserved.
- Edit slug to `ab` → ✗ at least 3 characters.

- [ ] **Step 4: Happy path**

Use a fresh email (e.g. `e2e+<timestamp>@ordernook.test`), a valid password, name "E2E Test Cafe", slug `e2e-test-cafe` → submit → lands on `/dashboard`, no lock screen, empty menu, nav shows the new shop; open `/dashboard/settings` → "Trial: ~30 days left".

- [ ] **Step 5: Data check**

Via Supabase MCP `execute_sql` on `iryavyogljedwgllaoit`:
```sql
select s.slug, s.subscription_status, s.plan_tier, s.trial_ends_at, su.role
from shops s join staff_users su on su.shop_id = s.id
where s.slug = 'e2e-test-cafe';
```
Expected: one row, `trialing`, `basic`, `trial_ends_at ≈ now()+30d`, role `owner`.

- [ ] **Step 6: Duplicate email**

Log out, return to register, reuse the same e2e email → inline "already registered — log in instead."

- [ ] **Step 7: Functional shop**

Log in as the new shop, add a menu item via the editor, open `ordernook.uk`-style customer page (`/e2e-test-cafe`) locally, place a test order → it appears on the dashboard. Confirms the shop is fully functional, not just created.

- [ ] **Step 8: Clean up the E2E shop**

Via `execute_sql`, delete the test shop (cascades to menu/staff) and the auth user, so prod data stays clean:
```sql
delete from shops where slug = 'e2e-test-cafe';
```
Then remove the e2e auth user in the Supabase Auth dashboard.

- [ ] **Step 9: Full suite + build**

Run: `npm test` then `npm run build`
Expected: all tests pass, build clean.

- [ ] **Step 10: Commit any doc updates**

Update `state.md` / `roadmap.md` to mark Slice 4 done, then:
```bash
git add state.md roadmap.md
git commit -m "docs: Slice 4 self-serve registration shipped"
```

---

## Self-Review

**Spec coverage:**
- Bare registration flow → Task 3 form + Task 2 RPC. ✓
- Instant access / confirm-email off → Prerequisite + Task 3 no-session fallback. ✓
- Auto-suggest editable slug + live check → Task 1 `slugify`, Task 3 derive/debounce. ✓
- `register_shop` RPC (guards, reserved list, typed errors, race safety) → Task 2. ✓
- Column defaults handle trial → relied on in Task 2 migration (no explicit set). ✓
- One-shop-per-owner → RPC `already_registered` guard + tested. ✓
- GB hardcoded → Task 2 migration (`country_code='GB'`); confirmed seeded. ✓
- Partial-failure recovery → Task 3 `recovery` mode. ✓
- Error-handling matrix → Task 3 `mapRpcError` + signUp handling. ✓
- Login link → Task 3 Step 3. ✓
- Test plan (unit / RPC / manual) → Tasks 1, 2, 4. ✓

**Placeholder scan:** none — all steps contain runnable code/SQL/commands. `<timestamp>` in the migration filename is a real instruction (use a value after `20260802020000`), not a content placeholder.

**Type consistency:** `slugify`/`validateSlug` signatures match between Task 1 and Task 3. RPC name/params (`register_shop(p_name, p_slug)`) and error strings match between Task 2 migration, Task 2 tests, and Task 3 `mapRpcError`. `SlugState` used consistently in Task 3.
