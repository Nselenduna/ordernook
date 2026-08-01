import { describe, expect, it } from "vitest"
import { parsePriceDeltaToMinor } from "../src/lib/money"

describe("parsePriceDeltaToMinor", () => {
  it("parses zero", () => expect(parsePriceDeltaToMinor("0")).toBe(0))
  it("parses pounds and pence", () => expect(parsePriceDeltaToMinor("0.60")).toBe(60))
  it("parses whole pounds", () => expect(parsePriceDeltaToMinor("1")).toBe(100))
  it("parses a single decimal place", () => expect(parsePriceDeltaToMinor("0.5")).toBe(50))
  it("parses a negative delta (discount)", () => expect(parsePriceDeltaToMinor("-0.10")).toBe(-10))
  it("trims surrounding whitespace", () => expect(parsePriceDeltaToMinor("  0.5 ")).toBe(50))
  it("rejects empty", () => expect(parsePriceDeltaToMinor("")).toBeNull())
  it("rejects non-numeric", () => expect(parsePriceDeltaToMinor("abc")).toBeNull())
  it("rejects more than two decimals", () => expect(parsePriceDeltaToMinor("1.234")).toBeNull())
  it("rejects scientific notation", () => expect(parsePriceDeltaToMinor("1e3")).toBeNull())
})
