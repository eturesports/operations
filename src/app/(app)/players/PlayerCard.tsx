"use client";

import type { PlayerRow } from "./PlayersClient";
import { formatUSD } from "@/lib/format";

// Deterministic accent per player so the no-photo state still looks composed
// rather than empty — the same player always gets the same tint.
const TINTS = [
  "from-rose-500/25 to-orange-500/10",
  "from-sky-500/25 to-indigo-500/10",
  "from-emerald-500/25 to-teal-500/10",
  "from-violet-500/25 to-fuchsia-500/10",
  "from-amber-500/25 to-rose-500/10",
];
function tintFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="text-center">
      <div className="font-display text-lg leading-none text-fg">
        {value ?? "—"}
      </div>
      <div className="mt-0.5 text-[9px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

export function PlayerCard({
  player,
  onOpen,
  selected,
  onToggleSelect,
  selectable,
}: {
  player: PlayerRow;
  onOpen: () => void;
  selected: boolean;
  onToggleSelect: () => void;
  selectable: boolean;
}) {
  const photo = player.actionImageUrl || player.profileImageUrl;
  // Their live roster if they are on one, otherwise what their college years
  // add up to — a player who has finished still has a record worth showing.
  const ap = player.activeProfile ?? player.career ?? null;
  const hasStats =
    ap &&
    [ap.matchesPlayed, ap.minutes, ap.goals, ap.assists].some((v) => v != null && v !== 0);

  return (
    <div
      className={`card group relative overflow-hidden transition-transform hover:-translate-y-0.5 ${
        selected ? "ring-2 ring-brand" : ""
      }`}
    >
      {/* The padding is the point: a 16px checkbox is not a target you can hit
          with a thumb, so the label carries the tap area around it. */}
      {selectable && (
        <label className="absolute left-1 top-1 z-20 cursor-pointer p-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select ${player.name}`}
          />
        </label>
      )}

      {/* Their Instagram, straight from the card. Above the open-profile
          button rather than inside it, since a link nested in a button is
          neither one thing nor the other. */}
      {player.instagramUrl && (
        <a
          href={player.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={`Open ${player.name}'s Instagram`}
          aria-label={`Open ${player.name}'s Instagram`}
          className="absolute right-2 top-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/70"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="2" width="20" height="20" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
          </svg>
        </a>
      )}

      <button onClick={onOpen} className="block w-full text-left" title="Open profile">
        {/* Visual */}
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div
              className={`grid h-full w-full place-items-center bg-gradient-to-br ${tintFor(
                player.id
              )}`}
            >
              <span className="font-display text-4xl text-fg/70">
                {initials(player.name)}
              </span>
            </div>
          )}

          {/* legibility scrim */}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="flex items-center gap-1.5">
              {player.activeProfile && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/25 px-2 py-0.5 text-[10px] font-medium text-emerald-200 backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Playing now
                </span>
              )}
              {player.graduated && (
                <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white backdrop-blur">
                  🎓 {player.graduationYear ?? "Graduated"}
                </span>
              )}
            </div>
            <h3 className="mt-1.5 truncate font-display text-lg leading-tight text-white">
              {player.name}
            </h3>
            <p className="truncate text-xs text-white/70">
              {player.activeProfile?.university || player.university || "—"}
              {player.season ? ` · ${player.season}` : ""}
            </p>
          </div>
        </div>

        {/* Facts */}
        <div className="space-y-3 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {player.division && (
              <span className="badge bg-ink-700 text-fg">{player.division}</span>
            )}
            {player.position && (
              <span className="badge bg-ink-700 text-muted">{player.position}</span>
            )}
            {(player.scholarship != null || player.fullRide) && (
              <span className="ml-auto flex items-center gap-1 text-xs font-medium text-accent">
                {player.fullRide && (
                  <span className="badge bg-accent/20 text-accent">Full ride</span>
                )}
                {player.scholarship != null && formatUSD(player.scholarship)}
              </span>
            )}
          </div>

          {hasStats && (
            <div className="grid grid-cols-4 gap-1 rounded-xl border border-ink-600 bg-ink-900/40 py-2">
              <Stat label="GP" value={ap!.matchesPlayed} />
              <Stat label="Min" value={ap!.minutes} />
              <Stat label="G" value={ap!.goals} />
              {player.activeProfile?.saves != null ? (
                <Stat label="Sv" value={player.activeProfile.saves} />
              ) : (
                <Stat label="A" value={ap!.assists} />
              )}
            </div>
          )}
        </div>
      </button>
    </div>
  );
}
