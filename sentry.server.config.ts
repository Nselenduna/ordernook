// Sentry init for the Node.js server runtime (route handlers, server components).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 10% performance traces — plenty for this volume.
  tracesSampleRate: 0.1,

  // Privacy: don't send customer PII (IPs, request bodies, headers).
  sendDefaultPii: false,
})
