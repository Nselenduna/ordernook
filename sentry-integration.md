# OrderNook — Sentry Integration — design spec

**Date:** 2 August 2026 · **Status:** Approved, ready for implementation plan
**Reference:** BookOnTheMap's Sentry setup (org `zizweit`, `@sentry/nextjs` v10) — the portfolio standard.

## 1. Goal
Wire up Sentry error monitoring for OrderNook (currently nothing but an empty `NEXT_PUBLIC_SENTRY_DSN` placeholder) so production errors — customer PWA, server routes, edge — are captured with alerts, meeting the "Sentry live" definition-of-done bar.

## 2. Scope
- **Package:** `@sentry/nextjs` (v10, matching BookOnTheMap).
- **Sentry project:** a new `ordernook` project in the `zizweit` org, created via the Sentry MCP (`create_project`), which auto-provisions the DSN. Region `de.sentry.io`.
- **DSN:** stored in `NEXT_PUBLIC_SENTRY_DSN` (already scaffolded, empty) — set in `.env.local` + Vercel (prod + preview). The DSN is client-safe, not a secret.
- **Capture scope: client + server + edge.** (BookOnTheMap is server/edge only; OrderNook is a customer-facing PWA, so browser errors matter.)
- **Config files** (Next 16 pattern):
  - `instrumentation.ts` — `register()` dynamically imports the server/edge config by runtime; `export const onRequestError = Sentry.captureRequestError`.
  - `instrumentation-client.ts` — browser `Sentry.init`.
  - `sentry.server.config.ts`, `sentry.edge.config.ts` — `Sentry.init` for the Node + edge runtimes.
- **`next.config.ts`** wrapped with `withSentryConfig`: `org: "zizweit"`, `project: "ordernook"`, `silent: !process.env.CI`, `widenClientFileUpload: true`, `sourcemaps: { deleteSourcemapsAfterUpload: true }`, `automaticVercelMonitors: true`.

## 3. Privacy (matches GDPR / on-device ethos)
- `sendDefaultPii: false` — no customer IPs, request bodies, or headers.
- **No Session Replay** — never record customer screens.
- `tracesSampleRate: 0.1` — 10% performance sampling, low volume/cost.

## 4. Sequencing (around the one external dependency)
- **Phase A — error capture (no external dependency):** install + create project/DSN + all config + set DSN env + verify a deliberate test error appears in the Sentry `ordernook` project. Works with just the DSN.
- **Phase B — source maps (needs Lloyd):** readable (un-minified) stack traces require `SENTRY_AUTH_TOKEN` in Vercel's **build** env. Lloyd adds it in the Vercel dashboard (or reuses BookOnTheMap's org token), then a redeploy uploads maps. `withSentryConfig` is configured for it now; it no-ops without the token (capture still works, traces just minified). The Sentry MCP cannot mint a build auth token, and secrets shouldn't be handled in-agent.

## 5. Files
- **New:** `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`.
- **Edit:** `next.config.ts` (wrap with `withSentryConfig`), `package.json` (dep), `.env.local` (real DSN), `.env.example` (keep placeholder + note `SENTRY_AUTH_TOKEN`).
- **Temporary:** a throwaway `/sentry-test` route (or a button) to trigger a test error for verification, removed after confirming capture — OR verify via a one-off client throw without committing a route.

## 6. Verification
1. `npm run build` clean with the Sentry wrapper.
2. Locally/prod: trigger a deliberate error (server + client) → confirm both land in the `ordernook` Sentry project (via the Sentry MCP `search_issues` or the dashboard).
3. After Phase B: confirm a new error's stack trace is un-minified (source-mapped).

## 7. Out of scope
Session Replay, user-feedback widget, custom performance instrumentation/spans, cron/Check-in monitors beyond `automaticVercelMonitors`, alert-rule tuning (defaults for now), profiling.

## 8. Open questions
None. (Auth token is a known Phase-B dependency on Lloyd, not an open design question.)
