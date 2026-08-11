import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Integration tests hit one shared live Supabase and mutate shared shop
  // fixtures (e.g. corner-grind's stripe_account_id/payment_modes), so files
  // must run serially — parallel files race on that state and flake.
  test: { environment: "node", include: ["tests/**/*.test.ts"], fileParallelism: false },
})
