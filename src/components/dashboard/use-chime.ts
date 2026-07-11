"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * New-order chime built with the WebAudio API (no audio asset needed).
 * Browsers block audio until the user interacts with the page, so we expose
 * `unlocked` + `unlock()` and also auto-unlock on the first pointer press.
 */
export function useChime() {
  const contextRef = useRef<AudioContext | null>(null)
  const [unlocked, setUnlocked] = useState(false)

  const unlock = useCallback(() => {
    if (!contextRef.current) contextRef.current = new AudioContext()
    contextRef.current
      .resume()
      .then(() => setUnlocked(true))
      .catch(() => {
        // Still blocked — the banner stays visible for another try.
      })
  }, [])

  useEffect(() => {
    const handler = () => unlock()
    window.addEventListener("pointerdown", handler, { once: true })
    return () => window.removeEventListener("pointerdown", handler)
  }, [unlock])

  const play = useCallback(() => {
    const context = contextRef.current
    if (!context || context.state !== "running") return
    // Two rising tones, ~0.5s total — audible over café noise without alarm.
    const notes: [frequency: number, start: number][] = [
      [880, 0],
      [1174.66, 0.18],
    ]
    for (const [frequency, start] of notes) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const startAt = context.currentTime + start
      oscillator.type = "sine"
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, startAt)
      gain.gain.exponentialRampToValueAtTime(0.4, startAt + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.3)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(startAt)
      oscillator.stop(startAt + 0.32)
    }
  }, [])

  return { play, unlocked, unlock }
}
