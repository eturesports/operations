"use client";

import { useMemo } from "react";
import type { PlayerRow } from "./PlayersClient";
import { formatNumber } from "@/lib/format";

/**
 * How the current selection breaks down across the three NCAA divisions.
 *
 * Its own panel, because it answers a different question from the one next
 * to it: that one is about reach and money, this one is only about level.
 *
 * The three divisions do not add up to the selection and the panel says so.
 * The database holds NAIA, JUCO and MLS NEXT PRO records too, plus a few with
 * no division recorded — 112 of 780 as this was written. Three percentages
 * that quietly summed to 86% would read as an error every time someone
 * checked them, so the remainder is named and counted.
 */

type Slot = { key: string; label: string; count: number; color: string };

/** The division as written, in the several ways it has been written. */
function bucketOf(division: string | null | undefined): string {
  const d = (division ?? "").trim().toLowerCase();
  if (!d || d === "sin confirmar") return "unknown";
  if (d === "division i" || d === "division 1" || d === "d1" || d === "di") return "i";
  if (d === "division ii" || d === "division 2" || d === "d2" || d === "dii") return "ii";
  if (d === "division iii" || d === "division 3" || d === "d3" || d === "diii") return "iii";
  if (d.startsWith("naia")) return "naia";
  if (d === "juco" || d.startsWith("njcaa")) return "juco";
  return "other";
}

export function DivisionSplit({ filtered }: { filtered: PlayerRow[] }) {
  const s = useMemo(() => {
    const n = new Map<string, number>();
    for (const p of filtered) {
      const k = bucketOf(p.division);
      n.set(k, (n.get(k) ?? 0) + 1);
    }
    const total = filtered.length;
    const get = (k: string) => n.get(k) ?? 0;

    // Fixed order, never sorted by size: a filter that changes the counts
    // must not move Division II to where Division I was a moment ago.
    const divisions: Slot[] = [
      { key: "i", label: "Division I", count: get("i"), color: "var(--div-i)" },
      { key: "ii", label: "Division II", count: get("ii"), color: "var(--div-ii)" },
      { key: "iii", label: "Division III", count: get("iii"), color: "var(--div-iii)" },
    ];
    const rest = [
      { key: "naia", label: "NAIA", count: get("naia") },
      { key: "juco", label: "JUCO", count: get("juco") },
      { key: "other", label: "Other", count: get("other") },
      { key: "unknown", label: "Not recorded", count: get("unknown") },
    ].filter((r) => r.count > 0);

    const restCount = rest.reduce((a, r) => a + r.count, 0);
    const pct = (c: number) => (total ? Math.round((c / total) * 1000) / 10 : 0);

    return { total, divisions, rest, restCount, pct };
  }, [filtered]);

  if (s.total === 0) return null;

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-fg">Division split</h2>
        <span className="text-[11px] text-muted">
          of {formatNumber(s.total)} operation{s.total === 1 ? "" : "s"} selected
        </span>
      </div>

      {/* One bar for the shape of it. The 2px gaps are the surface showing
          through, so neighbouring segments stay separate without a border. */}
      <div
        className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-ink-700"
        role="img"
        aria-label={
          s.divisions
            .map((d) => `${d.label} ${s.pct(d.count)}%`)
            .join(", ") + `, other ${s.pct(s.restCount)}%`
        }
      >
        {s.divisions.map((d) =>
          d.count === 0 ? null : (
            <span
              key={d.key}
              className="h-full rounded-full"
              style={{ width: `${s.pct(d.count)}%`, backgroundColor: d.color }}
            />
          )
        )}
        {s.restCount > 0 && (
          <span
            className="h-full rounded-full bg-ink-600"
            style={{ width: `${s.pct(s.restCount)}%` }}
          />
        )}
      </div>

      {/* The numbers carry the identity; the swatch only repeats it. */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {s.divisions.map((d) => (
          <div key={d.key} className="rounded-xl border border-ink-600 bg-ink-900/40 px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: d.color }}
                aria-hidden
              />
              <span className="truncate text-[10px] uppercase tracking-wide text-muted">
                {d.label}
              </span>
            </div>
            <div className="font-display text-2xl leading-tight text-fg">
              {s.pct(d.count)}%
            </div>
            <div className="text-[10px] leading-tight text-muted">
              {formatNumber(d.count)} operation{d.count === 1 ? "" : "s"}
            </div>
          </div>
        ))}
      </div>

      {s.restCount > 0 && (
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          The remaining{" "}
          <b className="text-fg">
            {s.pct(s.restCount)}% ({formatNumber(s.restCount)})
          </b>{" "}
          competes outside the three NCAA divisions:{" "}
          {s.rest.map((r, i) => (
            <span key={r.key}>
              {i > 0 && " · "}
              {r.label} {formatNumber(r.count)}
            </span>
          ))}
          . Percentages are of the {formatNumber(s.total)} operations selected, so
          all four add to 100%.
        </p>
      )}
    </section>
  );
}
