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
 * Every level gets a box and the six add to 100%. Three percentages that
 * quietly summed to 86% would read as an error every time someone checked
 * them — the database holds NAIA and JUCO records too, and a few with no
 * division recorded.
 *
 * Only the three NCAA divisions carry a colour. Five categorical hues cannot
 * survive deuteranopia against this surface — a green beside the Division I
 * red comes out at ΔE 3.0, nowhere near the floor — so the three outside it
 * are stepped by lightness instead. That reads as what it is: coloured is an
 * NCAA division, grey is not.
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
    // The level we placed players at, so a college a player moved to on his
    // own is not in the split — it would say we put him there.
    const ours = filtered.filter((p) => p.byEture);
    const n = new Map<string, number>();
    for (const p of ours) {
      const k = bucketOf(p.division);
      n.set(k, (n.get(k) ?? 0) + 1);
    }
    const total = ours.length;
    const get = (k: string) => n.get(k) ?? 0;

    // Fixed order, never sorted by size: a filter that changes the counts
    // must not move Division II to where Division I was a moment ago.
    const slots: Slot[] = [
      { key: "i", label: "Division I", count: get("i"), color: "var(--div-i)" },
      { key: "ii", label: "Division II", count: get("ii"), color: "var(--div-ii)" },
      { key: "iii", label: "Division III", count: get("iii"), color: "var(--div-iii)" },
      { key: "naia", label: "NAIA", count: get("naia"), color: "var(--out-naia)" },
      { key: "juco", label: "NJCAA (JUCO)", count: get("juco"), color: "var(--out-juco)" },
      // Everything else in one box: MLS NEXT PRO, and anything still without a
      // division. Naming it keeps the six adding to 100%.
      {
        key: "other",
        label: "Other",
        count: get("other") + get("unknown"),
        color: "var(--out-other)",
      },
    ];

    const unknown = get("unknown");
    const pct = (c: number) => (total ? Math.round((c / total) * 1000) / 10 : 0);

    return { total, slots, unknown, pct };
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
        aria-label={s.slots.map((d) => `${d.label} ${s.pct(d.count)}%`).join(", ")}
      >
        {s.slots.map((d) =>
          d.count === 0 ? null : (
            <span
              key={d.key}
              className="h-full rounded-full"
              style={{ width: `${s.pct(d.count)}%`, backgroundColor: d.color }}
            />
          )
        )}
      </div>

      {/* The name and the number carry the identity; the swatch repeats it. */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {s.slots.map((d) => (
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

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Percentages are of the {formatNumber(s.total)} operation
        {s.total === 1 ? "" : "s"} selected, so the six add to 100%.
        {s.unknown > 0 && (
          <>
            {" "}
            <b className="text-fg">Other</b> includes {formatNumber(s.unknown)} with
            no division recorded.
          </>
        )}
      </p>
    </section>
  );
}
