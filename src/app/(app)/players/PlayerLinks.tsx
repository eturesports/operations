"use client";

import type { PlayerRow } from "./PlayersClient";

/**
 * The two places a player exists outside this database: the college roster
 * page that proves the placement, and their Instagram.
 *
 * One component for both the table row and the gallery card, because they
 * have to agree — a link that appears in one view and not the other is the
 * kind of difference nobody notices until someone is looking for it.
 *
 * Each is its own anchor rather than something inside the button that opens
 * the record: a link nested in a button is neither one thing nor the other,
 * and the click has to stop before it reaches the row underneath.
 */

function Shield() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 3 4 6v5.5c0 4.4 3.2 8 8 9.5 4.8-1.5 8-5.1 8-9.5V6l-8-3Z" />
    </svg>
  );
}

function Instagram() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

const STYLES = {
  // In the table: quiet until you reach for it.
  row: "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink-700/60 hover:text-fg",
  // On a card: sitting over a photograph, so it carries its own ground.
  card: "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/70",
} as const;

export function PlayerLinks({
  player,
  variant,
}: {
  player: PlayerRow;
  variant: "row" | "card";
}) {
  const links = [
    {
      key: "ncaa",
      href: player.ncaaUrl,
      label: `Open ${player.name}'s college profile`,
      icon: <Shield />,
    },
    {
      key: "instagram",
      href: player.instagramUrl,
      label: `Open ${player.name}'s Instagram`,
      icon: <Instagram />,
    },
  ].filter((l) => l.href);

  if (links.length === 0) return null;

  return (
    <span className={variant === "row" ? "ml-1.5 inline-flex items-center gap-0.5" : "flex items-center gap-1.5"}>
      {links.map((l) => (
        <a
          key={l.key}
          href={l.href!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={l.label}
          aria-label={l.label}
          className={STYLES[variant]}
        >
          {l.icon}
        </a>
      ))}
    </span>
  );
}
