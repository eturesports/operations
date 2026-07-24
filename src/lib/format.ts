// Utilidades de formato para importe de becas y agrupaciones.

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatUSD(value: number | null | undefined): string {
  if (value == null) return "—";
  return usd.format(value);
}

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatUSDCompact(value: number | null | undefined): string {
  if (value == null) return "—";
  return "$" + compact.format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

// Ordena temporadas tipo "24/25" cronológicamente.
export function seasonSortKey(season: string | null | undefined): number {
  if (!season) return -1;
  const first = season.split("/")[0];
  const n = parseInt(first, 10);
  if (Number.isNaN(n)) return -1;
  // 16..99 => 2016..2099
  return n;
}
