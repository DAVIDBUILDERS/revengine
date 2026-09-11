/** Proposed DAVID defaults; no verified legacy brand assets were supplied. */
export const theme = {
  canvas: "#F5F6F8",
  surface: "#FFFFFF",
  text: "#18191C",
  muted: "#626873",
  border: "#E0E4EB",
  accent: "#C42B2F",
  spacing: [4, 8, 12, 16, 24, 32],
} as const;

export function money(value: number | null, currency = "USD"): string {
  return value === null
    ? "Unavailable"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(value / 100);
}

export function words(value: string): string {
  return value.replace(/_/g, " ");
}
