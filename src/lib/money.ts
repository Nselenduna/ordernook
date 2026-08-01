/**
 * Money helpers. Prices are ALWAYS integers in minor units (350 = £3.50)
 * everywhere in the app and the DB. Formatting happens only here, at display.
 */
export function formatMinor(
  minor: number,
  currency: string,
  locale = "en-GB"
): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  })
  // Number of decimal places varies per currency (GBP = 2, JPY = 0),
  // so derive the divisor from the formatter instead of hardcoding 100.
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2
  return formatter.format(minor / 10 ** digits)
}

/**
 * Parse a user-entered price DELTA (an option surcharge) in major units into
 * integer minor units. Unlike an item price, a delta may be zero or negative
 * (a discount). Returns null for anything not matching -?digits(.dd) — mirrors
 * the strict parse in the item form (rejects "", "1e3", "1.234").
 */
export function parsePriceDeltaToMinor(raw: string): number | null {
  const trimmed = raw.trim()
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) return null
  const minor = Math.round(Number.parseFloat(trimmed) * 100)
  if (Math.abs(minor) > 100_000_000) return null // > £1,000,000 guard
  return minor
}
