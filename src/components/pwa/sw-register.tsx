"use client"

import { useEffect } from "react"

/** Registers the service worker (PWA install + web push). Renders nothing. */
export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failing must never break the page (e.g. private mode).
      })
    }
  }, [])

  return null
}
