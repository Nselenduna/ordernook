import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Pin the workspace root (a stray lockfile on the Desktop confuses inference).
  turbopack: {
    root: __dirname,
  },
  // Lets the phone (LAN IP) load HMR/dev assets instead of being blocked as cross-origin.
  allowedDevOrigins: ["192.168.0.10"],
  // sharp ships native bindings — keep it out of the server bundle, load at runtime.
  serverExternalPackages: ["sharp"],
};

export default withSentryConfig(nextConfig, {
  org: "zizweit",
  project: "ordernook",
  silent: !process.env.CI, // quiet locally; verbose in CI
  widenClientFileUpload: true,
  // Upload source maps for readable stack traces, then delete them from the
  // build output so they're never served to users. Uploads only when
  // SENTRY_AUTH_TOKEN is in the build env (Vercel); no-ops without it.
  sourcemaps: { deleteSourcemapsAfterUpload: true },
});
