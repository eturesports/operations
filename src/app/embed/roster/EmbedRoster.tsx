"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { PublicPlayer, PublicSeason } from "@/lib/publicRoster";

// Deterministic tint so a player without a photo still looks composed —
// the same rule the internal gallery uses, so the two never disagree.
const TINTS = [
  "from-rose-500/25 to-orange-500/10",
  "from-sky-500/25 to-indigo-500/10",
  "from-emerald-500/25 to-teal-500/10",
  "from-violet-500/25 to-fuchsia-500/10",
  "from-amber-500/25 to-rose-500/10",
];
function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

function Card({ p }: { p: PublicPlayer }) {
  return (
    <figure className="card overflow-hidden p-0">
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        {p.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.photo}
            alt={p.name}
            loading="lazy"
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${tintFor(
              p.slug
            )}`}
          >
            <span className="font-display text-4xl text-fg/70">{initials(p.name)}</span>
          </div>
        )}
        {p.playingNow && (
          <span className="absolute right-2 top-2 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-medium text-white">
            Playing now
          </span>
        )}
      </div>
      <figcaption className="p-3">
        <div className="truncate text-sm font-semibold text-fg">{p.name}</div>
        <div className="truncate text-xs text-muted">{p.university ?? "—"}</div>
        {p.season && (
          <div className="mt-1 text-[11px] uppercase tracking-wide text-muted">{p.season}</div>
        )}
      </figcaption>
    </figure>
  );
}

export function EmbedRoster({
  players,
  seasons,
}: {
  players: PublicPlayer[];
  seasons: PublicSeason[];
}) {
  const params = useSearchParams();
  const asked = params.get("season");
  const [season, setSeason] = useState<string | null>(
    asked && seasons.some((s) => s.season === asked) ? asked : null
  );
  const [q, setQ] = useState("");

  // The page around this one decides the look; the visitor's preference for
  // the internal app has nothing to do with it.
  const theme = params.get("theme") === "dark" ? "dark" : "light";
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return players.filter((p) => {
      if (season && p.season !== season) return false;
      if (!needle) return true;
      return `${p.name} ${p.university ?? ""}`.toLowerCase().includes(needle);
    });
  }, [players, season, q]);

  const current = seasons.find((s) => s.season === season);

  // Wix gives an embedded frame a fixed height, so the page it sits on has no
  // way of knowing how tall this is. Publishing the height lets the host
  // resize the frame instead of leaving the grid to scroll inside a box.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const send = () => {
      const height = root.current?.scrollHeight ?? 0;
      window.parent?.postMessage({ type: "eture:height", height }, "*");
    };
    send();
    const observer = new ResizeObserver(send);
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, [visible.length]);

  return (
    <div ref={root} className="space-y-4">
      {/* Season strip — the tabs double as the season's headline figures. */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSeason(null)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition ${
            season === null ? "bg-brand text-white" : "btn-ghost"
          }`}
        >
          All seasons
        </button>
        {seasons.map((s) => (
          <button
            key={s.season}
            type="button"
            onClick={() => setSeason(s.season)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition ${
              season === s.season ? "bg-brand text-white" : "btn-ghost"
            }`}
          >
            {s.season}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          <span className="font-display text-2xl text-fg">{visible.length}</span>{" "}
          {visible.length === 1 ? "player" : "players"}
          {current && ` · ${current.universities} universities`}
        </p>
        <input
          className="input max-w-[16rem] py-1.5 text-sm"
          placeholder="Search a player or college…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search"
        />
      </div>

      {visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">No players to show here.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((p) => (
            <Card key={p.slug} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
