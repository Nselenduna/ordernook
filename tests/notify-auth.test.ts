import { describe, expect, it } from "vitest"
import { secretMatches } from "../src/lib/notify-auth"

describe("secretMatches", () => {
  it("accepts an exact match", () => expect(secretMatches("s3cret", "s3cret")).toBe(true))
  it("rejects a wrong secret of equal length", () => expect(secretMatches("s3cret", "s3cr3t")).toBe(false))
  it("rejects a wrong secret of different length", () => expect(secretMatches("short", "muchlonger")).toBe(false))
  it("rejects a missing header", () => expect(secretMatches(null, "s3cret")).toBe(false))
  it("rejects an empty header", () => expect(secretMatches("", "s3cret")).toBe(false))
  it("rejects when the server has no secret configured", () => expect(secretMatches("anything", undefined)).toBe(false))
  it("rejects when the server secret is empty", () => expect(secretMatches("", "")).toBe(false))
})
