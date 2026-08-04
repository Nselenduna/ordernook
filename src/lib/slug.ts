export const RESERVED_SLUGS: readonly string[] = [
  "dashboard", "order", "api", "auth", "login", "register",
  "admin", "static", "_next", "favicon", "manifest",
]

/** Derive a URL-safe slug from free text. Lossy by design. May return "". */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accent marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // any run of non-alphanumerics → single hyphen
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "") // a slice may have left a trailing hyphen
}

export type SlugError = "too_short" | "too_long" | "bad_format" | "reserved"

/** Authoritative client-side check. Returns null when the slug is valid. */
export function validateSlug(slug: string): SlugError | null {
  if (slug.length < 3) return "too_short"
  if (slug.length > 40) return "too_long"
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return "bad_format"
  if (RESERVED_SLUGS.includes(slug)) return "reserved"
  return null
}
