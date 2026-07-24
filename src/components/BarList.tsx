import { formatNumber, formatUSDCompact } from "@/lib/format";
import type { Bucket } from "@/lib/stats";

// Lista de barras horizontales para desglosar una métrica (jugadores + becas).
export function BarList({
  title,
  buckets,
  metric = "players",
}: {
  title: string;
  buckets: Bucket[];
  metric?: "players" | "scholarship";
}) {
  const max = Math.max(
    1,
    ...buckets.map((b) => (metric === "players" ? b.players : b.scholarship))
  );

  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-semibold text-gray-200">{title}</h3>
      {buckets.length === 0 ? (
        <p className="text-sm text-gray-500">Sin datos</p>
      ) : (
        <ul className="space-y-3">
          {buckets.map((b) => {
            const val = metric === "players" ? b.players : b.scholarship;
            const pct = Math.round((val / max) * 100);
            return (
              <li key={b.key}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-gray-300" title={b.key}>
                    {b.key}
                  </span>
                  <span className="shrink-0 tabular-nums text-gray-400">
                    {formatNumber(b.players)}
                    <span className="mx-1 text-gray-600">·</span>
                    <span className="text-accent">
                      {formatUSDCompact(b.scholarship)}
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-700">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
