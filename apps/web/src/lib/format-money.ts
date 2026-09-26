import type { Money } from "@footconnect/shared";

/**
 * Format a DZD Money object into standard human-readable copy.
 * E.g. { amountMinor: 400000, currency: "DZD" } -> "4,000 DZD"
 * Never uses '$'.
 */
export function formatMoney(money: Money | { amountMinor: number; currency?: string }): string {
  const major = money.amountMinor / 100;
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(major) ? 0 : 2,
  }).format(major);
  return `${formatted} DZD`;
}

/**
 * Format a raw minor unit amount into DZD currency representation.
 * E.g. 400000 -> "4,000 DZD"
 */
export function formatDzd(amountMinor: number): string {
  return formatMoney({ amountMinor, currency: "DZD" });
}
