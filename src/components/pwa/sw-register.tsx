"use client"

import { useEffect } from "react"

/** Registers the service worker (PWA install + web push). Renders nothing. */
export function SwRegister() {
  useEffect(() => {
    // Never register in dev: Turbopack serves non-content-hashed chunk names,
    // so the SW's cache-first handler would serve stale JS after edits (the
    // "new code doesn't appear in the browser" trap). No SW in dev = no stale cache.
    if (process.env.NODE_ENV !== "production") return
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failing must never break the page (e.g. private mode).
      })
    }
  }, [])

  return null
}
