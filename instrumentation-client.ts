// Sentry init for the browser (customer PWA + dashboard).
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,

  // Privacy: no PII, and Session Replay is intentionally NOT enabled — we never
  // record customer screens.
  sendDefaultPii: false,
})

// Instruments App Router client-side navigations for tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
