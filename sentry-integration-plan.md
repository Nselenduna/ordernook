# Sentry Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Capture OrderNook errors (client PWA + server + edge) in a new `ordernook` Sentry project, privacy-safe, matching the BookOnTheMap standard.

**Architecture:** `@sentry/nextjs` v10 with the Next 16 instrumentation pattern — `instrumentation.ts` (`register()` + `onRequestError`) loads server/edge configs; `instrumentation-client.ts` inits the browser SDK; `next.config.ts` is wrapped with `withSentryConfig`. DSN comes from a Sentry-MCP-created project via `NEXT_PUBLIC_SENTRY_DSN`.

**Tech Stack:** `@sentry/nextjs` ^10, Next 16, Vercel, Sentry org `zizweit` (region `de.sentry.io`).

## Global Constraints

- **Sentry org `zizweit`, project `ordernook`** (new); region `https://de.sentry.io`.
- **DSN in `NEXT_PUBLIC_SENTRY_DSN`** (already scaffolded, empty) — client-safe, not a secret. Set in `.env.local` + Vercel (prod + preview).
- **Privacy:** `sendDefaultPii: false`, **no Session Replay**, `tracesSampleRate: 0.1` in every `Sentry.init`.
- **Capture scope:** client + server + edge.
- **Source maps** (`withSentryConfig` `sourcemaps.deleteSourcemapsAfterUpload`) upload only when `SENTRY_AUTH_TOKEN` is present in the build env — a **Phase-B** dependency on Lloyd (Vercel dashboard). Capture works without it.
- After each code step: `npm run build` clean (the Sentry webpack plugin warns without an auth token but must not fail; `silent: !process.env.CI` quiets it).

---

### Task 1: Create the Sentry project, install the SDK, set the DSN

**Files:**
- Modify: `package.json` (dep), `.env.local` (real DSN), `.env.example` (note `SENTRY_AUTH_TOKEN`)

**Interfaces:**
- Produces: a live `ordernook` Sentry project + its DSN, available as `process.env.NEXT_PUBLIC_SENTRY_DSN`.

- [ ] **Step 1: Find the team slug** (Sentry MCP)

Run `find_teams` for org `zizweit` (via `execute_sentry_tool` name `find_teams`, args `{organizationSlug:"zizweit"}`). Note the team slug (likely the org's default team).

- [ ] **Step 2: Create the project** (Sentry MCP)

`create_project` with `{ organizationSlug: "zizweit", teamSlug: <team>, name: "ordernook", slug: "ordernook", platform: "javascript-nextjs" }`. Capture the returned **SENTRY_DSN**. If it doesn't return a DSN, call `find_dsns({organizationSlug:"zizweit", projectSlug:"ordernook"})`.

- [ ] **Step 3: Install the SDK**

Run: `npm install @sentry/nextjs@^10`
Expected: added to `package.json` dependencies; `npm run build` still succeeds (no config yet, so no Sentry active).

- [ ] **Step 4: Set the DSN locally**

In `.env.local`, set the scaffolded line to the real DSN:
```
NEXT_PUBLIC_SENTRY_DSN=<dsn-from-step-2>
```
In `.env.example`, keep `NEXT_PUBLIC_SENTRY_DSN=` and add a comment line:
```
# SENTRY_AUTH_TOKEN is set in Vercel build env only (source-map upload); never commit it.
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "$(cat <<'EOF'
chore(sentry): install @sentry/nextjs, create ordernook project

New Sentry project 'ordernook' in the zizweit org (DSN in NEXT_PUBLIC_SENTRY_DSN,
set locally + Vercel). No config wired yet.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```
(`.env.local` is gitignored — the DSN is set there but not committed; it's also set in Vercel in Task 5.)

---

### Task 2: Sentry config files (client + server + edge + instrumentation)

**Files:**
- Create: `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`, `instrumentation-client.ts` (all at project root)

**Interfaces:**
- Consumes: `NEXT_PUBLIC_SENTRY_DSN` (Task 1).
- Produces: Sentry initialised in all three runtimes; `register` + `onRequestError` exported from `instrumentation.ts`.

- [ ] **Step 1: Server config**

Create `sentry.server.config.ts`:
```ts
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false, // no customer IPs / request bodies
})
```

- [ ] **Step 2: Edge config**

Create `sentry.edge.config.ts` (identical init — runs for middleware/edge routes):
```ts
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
})
```

- [ ] **Step 3: Instrumentation (server/edge loader + request-error capture)**

Create `instrumentation.ts`:
```ts
import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

export const onRequestError = Sentry.captureRequestError
```

- [ ] **Step 4: Client config**

Create `instrumentation-client.ts`:
```ts
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false, // no PII; Session Replay intentionally NOT enabled
})

// Instruments App Router client navigations for tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: clean. (Sentry initialises but without `withSentryConfig` yet, so no source-map plugin runs.)

- [ ] **Step 6: Commit**

```bash
git add sentry.server.config.ts sentry.edge.config.ts instrumentation.ts instrumentation-client.ts
git commit -m "$(cat <<'EOF'
feat(sentry): client + server + edge init (PII off, no replay)

instrumentation.ts loads server/edge configs by runtime and exports
onRequestError; instrumentation-client.ts inits the browser SDK. 10% traces.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wrap `next.config.ts` with `withSentryConfig`

**Files:**
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: the config files (Task 2).
- Produces: build-time Sentry integration (source-map upload when `SENTRY_AUTH_TOKEN` present).

- [ ] **Step 1: Wrap the export**

In `next.config.ts`, add the import at the top and replace the final `export default nextConfig` line:
```ts
import { withSentryConfig } from "@sentry/nextjs"
```
```ts
export default withSentryConfig(nextConfig, {
  org: "zizweit",
  project: "ordernook",
  silent: !process.env.CI, // quiet locally; verbose in CI
  widenClientFileUpload: true,
  // Upload source maps for readable traces, then delete them from the build
  // output so they're never served to users. Uploads only when SENTRY_AUTH_TOKEN
  // is in the build env (Vercel); no-ops (with a warning) without it.
  sourcemaps: { deleteSourcemapsAfterUpload: true },
})
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: clean. Without `SENTRY_AUTH_TOKEN` it prints a non-fatal notice about skipping source-map upload; the build succeeds. `serverExternalPackages`/`turbopack`/`allowedDevOrigins` from the original `nextConfig` are preserved.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "$(cat <<'EOF'
feat(sentry): wrap next config with withSentryConfig (zizweit/ordernook)

Source-map upload + delete-after-upload; silent unless CI. Uploads activate
once SENTRY_AUTH_TOKEN is set in the Vercel build env.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Verify capture end-to-end (test error → Sentry)

**Files:**
- Create (temporary): `src/app/api/sentry-check/route.ts` — removed at the end of this task.

**Interfaces:**
- Consumes: everything from Tasks 1–3.

- [ ] **Step 1: Add a temporary throwing route**

Create `src/app/api/sentry-check/route.ts`:
```ts
export const dynamic = "force-dynamic"

export function GET() {
  throw new Error("sentry-check: OrderNook server capture test")
}
```

- [ ] **Step 2: Run the app with the DSN and trigger the error**

Start the dev server (or a `npm run build && npm run start`), then hit `http://localhost:3000/api/sentry-check` (expect a 500). This routes through `onRequestError` → Sentry.
Note: the PWA service worker is guarded off in dev; if verifying against a production build locally, clear the SW first.

- [ ] **Step 3: Confirm the event landed in Sentry**

Via the Sentry MCP: `execute_sentry_tool` name `search_issues` (or `search_events`) with `{organizationSlug:"zizweit", projectSlug:"ordernook", query:"sentry-check"}`. Expected: an issue titled "sentry-check: OrderNook server capture test".
If nothing appears within ~1 min: check the DSN is set in the running env (`echo` it), and that `instrumentation.ts` registered (build output lists it).

- [ ] **Step 4: Remove the temporary route**

```bash
rm src/app/api/sentry-check/route.ts
```
Run `npm run build` — clean.

- [ ] **Step 5: Commit**

```bash
git add -A src/app/api
git commit -m "$(cat <<'EOF'
test(sentry): verified server capture, removed temp check route

Confirmed a thrown error in /api/sentry-check reached the ordernook Sentry
project via onRequestError; route deleted.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Set the Vercel DSN env + deploy + verify on production (Phase A ship)

**Files:** none (env + deploy).

- [ ] **Step 1: Set the DSN in Vercel (prod + preview)**

```bash
printf '%s' "<dsn>" | vercel env add NEXT_PUBLIC_SENTRY_DSN production
printf '%s' "<dsn>" | vercel env add NEXT_PUBLIC_SENTRY_DSN preview
```
(The DSN is public/client-safe, so this is fine to set from the CLI.)

- [ ] **Step 2: Push + deploy**

```bash
git push origin master && vercel --prod --yes
```
Expected: deployment `READY`, aliased to ordernook.uk.

- [ ] **Step 3: Verify prod capture**

Trigger a real client error on ordernook.uk (e.g. via the browser console on the customer page: force an unhandled rejection through the app, or briefly re-add + hit the check route on prod). Confirm a **production**-environment event appears in the `ordernook` Sentry project (Sentry MCP `search_issues`). Then confirm normal pages are error-free.

- [ ] **Step 4: Update state/roadmap docs + commit**

Record in `state.md` that Sentry Phase A is live, and that **Phase B (source maps) is pending `SENTRY_AUTH_TOKEN` in Vercel** — Lloyd's action.

---

## Phase B (follow-up, needs Lloyd) — source maps

Not an executable task here: readable (un-minified) traces need `SENTRY_AUTH_TOKEN` in Vercel's **build** environment.
1. Lloyd creates an org auth token in Sentry (Settings → Auth Tokens, scope `project:releases` + source-map upload) — or reuses BookOnTheMap's.
2. `vercel env add SENTRY_AUTH_TOKEN production` (and preview) — **secret**, set by Lloyd, not committed.
3. Redeploy → `withSentryConfig` uploads + deletes source maps. Verify a new error's stack trace is un-minified.

---

## Self-Review

**Spec coverage:** package install (T1) ✓; project/DSN via MCP (T1) ✓; DSN env (T1/T5) ✓; client+server+edge configs + instrumentation (T2) ✓; withSentryConfig (T3) ✓; privacy PII-off/no-replay/0.1 (T2 every init) ✓; verification (T4 local, T5 prod) ✓; source maps Phase B dependency documented ✓. No gaps.

**Placeholder scan:** `<dsn>` / `<team>` are runtime values captured in T1 (not unfilled plan blanks) — every code block is complete. No TBD/TODO.

**Type consistency:** `NEXT_PUBLIC_SENTRY_DSN` used identically across all four config files and both env locations; `withSentryConfig(nextConfig, {...})` consumes the existing `nextConfig` object unchanged; `register`/`onRequestError`/`onRouterTransitionStart` are the exact @sentry/nextjs v10 export names. Consistent.
