import { describe, expect, it } from "vitest"
import {
  contrastRatio,
  contrastVsWhite,
  mixSrgb,
  derivedForeground,
  PRESETS,
} from "../src/lib/branding"

describe("contrastRatio", () => {
  it("white vs black is ~21", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0)
  })
  it("is order-independent", () => {
    expect(contrastRatio("#6F4E37", "#ffffff")).toBeCloseTo(contrastRatio("#ffffff", "#6F4E37"), 5)
  })
  it("same colour is 1", () => {
    expect(contrastRatio("#123456", "#123456")).toBeCloseTo(1, 5)
  })
})

describe("contrastVsWhite", () => {
  it("returns 0 for malformed hex", () => {
    expect(contrastVsWhite("nope")).toBe(0)
  })
})

describe("mixSrgb", () => {
  it("weight 1 returns a", () => {
    expect(mixSrgb("#102030", "#ffffff", 1)).toBe("#102030")
  })
  it("weight 0 returns b", () => {
    expect(mixSrgb("#102030", "#ffffff", 0)).toBe("#ffffff")
  })
  it("midpoint averages channels", () => {
    expect(mixSrgb("#000000", "#ffffff", 0.5)).toBe("#808080")
  })
})

describe("PRESETS accessibility", () => {
  it("has at least 5 presets with unique ids", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5)
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length)
  })
  for (const p of PRESETS) {
    it(`${p.id}: primary is AA vs white button text`, () => {
      expect(contrastVsWhite(p.primary)).toBeGreaterThanOrEqual(4.5)
    })
    it(`${p.id}: body text is AA on the background`, () => {
      expect(contrastRatio(derivedForeground(p.primary), p.background)).toBeGreaterThanOrEqual(4.5)
    })
  }
})
