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
