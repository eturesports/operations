"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { PublicPlayer, PublicSeason } from "@/lib/publicRoster";

// This widget lives inside somebody else's page, so it owns a fixed slice of
// it: the filters stay put and the grid scrolls beneath them, never growing
// past this height. A page that keeps getting taller pushes the rest of the
// site down every time a visitor changes a filter.
const MAX_HEIGHT = 1200;

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

const number = (n: number) => n.toLocaleString("en-US");

function Card({ p }: { p: PublicPlayer }) {
  // Not every athletics site publishes its crest at the shared path; when it
  // doesn't, the row simply loses the badge rather than showing a broken one.
  const [logoOk, setLogoOk] = useState(true);

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
            <span className="font-display text-3xl text-fg/70 sm:text-4xl">
              {initials(p.name)}
            </span>
          </div>
        )}

        {p.season && (
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            {p.season}
          </span>
        )}
        {p.playingNow && (
          <span className="absolute right-2 top-2 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-medium text-white">
            Playing
          </span>
        )}
        {p.minutes != null && (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            {number(p.minutes)}′
          </span>
        )}
      </div>

      <figcaption className="flex items-center gap-2 p-2.5">
        {p.logo && logoOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.logo}
            alt=""
            loading="lazy"
            onError={() => setLogoOk(false)}
            className="h-7 w-7 shrink-0 object-contain"
          />
        ) : (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-700 text-[9px] font-semibold text-muted">
            {initials(p.university ?? "—")}
          </span>
        )}
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold leading-tight text-fg">
            {p.name}
          </div>
          <div className="truncate text-[11px] leading-tight text-muted">
            {p.university ?? "—"}
          </div>
        </div>
      </figcaption>
    </figure>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="font-display text-lg leading-none text-fg sm:text-2xl">{value}</div>
      <div className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-muted">
        {label}
      </div>
    </div>
  );
}

const isD1 = (division: string | null) =>
  (division ?? "").trim().toLowerCase() === "division i";

export function EmbedRoster({
  players,
  seasons,
}: {
  players: PublicPlayer[];
  seasons: PublicSeason[];
}) {
  const params = useSearchParams();
  const asked = params.get("season");

  const [season, setSeason] = useState<string>(
    asked && seasons.some((s) => s.season === asked) ? asked : ""
  );
  const [division, setDivision] = useState("");
  const [university, setUniversity] = useState("");
  const [onlyPlaying, setOnlyPlaying] = useState(false);
  const [q, setQ] = useState("");

  // The page around this one decides the look; the visitor's preference for
  // the internal app has nothing to do with it.
  const theme = params.get("theme") === "dark" ? "dark" : "light";
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const divisions = useMemo(
    () =>
      [...new Set(players.map((p) => p.division).filter(Boolean) as string[])].sort(),
    [players]
  );
  const universities = useMemo(
    () =>
      [...new Set(players.map((p) => p.university).filter(Boolean) as string[])].sort(
        (a, b) => a.localeCompare(b)
      ),
    [players]
  );

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return players.filter((p) => {
      if (season && p.season !== season) return false;
      if (division && p.division !== division) return false;
      if (university && p.university !== university) return false;
      if (onlyPlaying && !p.playingNow) return false;
      if (!needle) return true;
      return `${p.name} ${p.university ?? ""}`.toLowerCase().includes(needle);
    });
  }, [players, season, division, university, onlyPlaying, q]);

  const totals = useMemo(
    () => ({
      players: visible.length,
      d1: visible.filter((p) => isD1(p.division)).length,
      universities: new Set(visible.map((p) => p.university).filter(Boolean)).size,
      minutes: visible.reduce((a, p) => a + (p.minutes ?? 0), 0),
    }),
    [visible]
  );

  // Wix gives an embedded frame a fixed height and cannot know how tall this
  // is, so the widget reports its own — capped, because it never grows past
  // the height it has claimed.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const send = () =>
      window.parent?.postMessage(
        { type: "eture:height", height: Math.min(root.current?.scrollHeight ?? 0, MAX_HEIGHT) },
        "*"
      );
    send();
    const observer = new ResizeObserver(send);
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);

  const filtered = season || division || university || onlyPlaying || q.trim();

  return (
    <div
      ref={root}
      className="flex flex-col gap-3"
      style={{ maxHeight: MAX_HEIGHT, height: "100dvh" }}
    >
      {/* Headline figures for whatever the filters are showing */}
      <div className="grid shrink-0 grid-cols-4 gap-2 rounded-2xl border border-ink-600 px-3 py-2.5">
        <Figure label="Players" value={number(totals.players)} />
        <Figure label="Division I" value={number(totals.d1)} />
        <Figure label="Colleges" value={number(totals.universities)} />
        <Figure label="Minutes" value={number(totals.minutes)} />
      </div>

      {/* Filters. Native controls on purpose: inside an iframe on a phone,
          the browser's own pickers behave far better than a custom menu. */}
      <div className="shrink-0 space-y-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select
            className="input py-1.5 text-xs"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            aria-label="Season"
          >
            <option value="">All seasons</option>
            {seasons.map((s) => (
              <option key={s.season} value={s.season}>
                {s.season} · {s.players}
              </option>
            ))}
          </select>

          <select
            className="input py-1.5 text-xs"
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            aria-label="Division"
          >
            <option value="">All divisions</option>
            {divisions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            className="input col-span-2 py-1.5 text-xs sm:col-span-1"
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
            aria-label="College"
          >
            <option value="">All colleges</option>
            {universities.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          <input
            className="input col-span-2 py-1.5 text-xs sm:col-span-1"
            placeholder="Search a player…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyPlaying((v) => !v)}
            className={`rounded-full px-3 py-1 text-[11px] transition ${
              onlyPlaying ? "bg-brand text-white" : "btn-ghost"
            }`}
          >
            Playing now
          </button>
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setSeason("");
                setDivision("");
                setUniversity("");
                setOnlyPlaying(false);
                setQ("");
              }}
              className="text-[11px] text-muted underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Only this scrolls, so the figures and filters stay in view */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        {visible.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">No players to show here.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((p) => (
              <Card key={p.slug} p={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
