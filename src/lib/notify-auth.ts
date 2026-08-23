import { timingSafeEqual } from "node:crypto"

/**
 * Constant-time comparison of the trigger's shared secret.
 *
 * Length is checked first because timingSafeEqual throws on a length
 * mismatch. That leaks the secret's length, which is not a meaningful
 * disclosure for a random server-side secret.
 */
export function secretMatches(
  provided: string | null,
  expected: string | undefined
): boolean {
  if (!expected || !provided) return false
  const a = Buffer.from(provided, "utf8")
  const b = Buffer.from(expected, "utf8")
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
