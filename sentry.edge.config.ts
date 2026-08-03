// Sentry init for the edge runtime (middleware/proxy, edge routes). Also loads
// when running locally. Unrelated to Vercel's Edge Runtime naming.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
})
