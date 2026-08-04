import { describe, expect, it } from "vitest"
import { slugify, validateSlug } from "../src/lib/slug"

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => expect(slugify("Corner Grind")).toBe("corner-grind"))
  it("strips punctuation", () => expect(slugify("Joe's Café!")).toBe("joe-s-cafe"))
  it("collapses repeated separators", () => expect(slugify("A   B---C")).toBe("a-b-c"))
  it("trims leading/trailing hyphens", () => expect(slugify("  -Hello-  ")).toBe("hello"))
  it("removes accents", () => expect(slugify("Crème Brûlée")).toBe("creme-brulee"))
  it("drops emoji", () => expect(slugify("Coffee ☕ Bar")).toBe("coffee-bar"))
  it("caps at 40 chars with no trailing hyphen", () => {
    const out = slugify("a".repeat(45) + " tail")
    expect(out.length).toBeLessThanOrEqual(40)
    expect(out.endsWith("-")).toBe(false)
  })
  it("returns empty for all-punctuation input", () => expect(slugify("!!!")).toBe(""))
})

describe("validateSlug", () => {
  it("accepts a valid slug", () => expect(validateSlug("corner-grind")).toBeNull())
  it("rejects too short", () => expect(validateSlug("ab")).toBe("too_short"))
  it("rejects too long", () => expect(validateSlug("a".repeat(41))).toBe("too_long"))
  it("rejects leading hyphen", () => expect(validateSlug("-abc")).toBe("bad_format"))
  it("rejects trailing hyphen", () => expect(validateSlug("abc-")).toBe("bad_format"))
  it("rejects double hyphen", () => expect(validateSlug("a--b")).toBe("bad_format"))
  it("rejects uppercase", () => expect(validateSlug("Abc")).toBe("bad_format"))
  it("rejects reserved words", () => expect(validateSlug("dashboard")).toBe("reserved"))
})
