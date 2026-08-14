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

/**
 * The NCAA roundel, drawn here rather than fetched.
 *
 * Two reasons not to point at the file on Wikimedia: an icon that renders
 * only when someone else's server answers is an icon that sometimes is not
 * there, and hotlinking their uploads is what their own policy asks people
 * not to do. It is 1.5 KB of path data, so it costs nothing to carry.
 *
 * It keeps its own colours — a brand mark that inherits the text colour is
 * not that brand mark. Checked on both themes and over a photograph.
 */
function NcaaMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 69 69" aria-hidden focusable="false">
      <path d="M59.402 34.312h-7.339l-.878 3.073h1.13l-3.639 5.709-.502-8.782h-7.402l-.815 3.01h1.129l-4.83 7.34h-4.015c-.439 0-2.007-.377-2.007-2.384 0-2.007 1.882-4.893 3.826-4.893h.816c-.125.502-.44 1.506-.44 1.506h3.576l1.255-4.642H33.81c-3.388 0-6.148 2.446-7.026 4.956l1.443-4.956h-4.893l-.878 3.074h1.255l-1.255 4.453-3.2-7.527h-4.578l-.878 3.136h1.254l-2.823 10.288h3.639s1.38-5.081 1.756-6.398a1145.14 1145.14 0 002.634 6.398h4.078l1.882-6.524a8.099 8.099 0 000 3.01c.376 2.134 2.446 3.514 4.704 3.514h7.402l1.255-1.945h5.206l.125 1.882h4.642l1.192-1.882h5.332l.188 1.945h3.262l.69-1.443-.816-11.918z" fill="#fff" />
      <path d="M56.203 47.672l-.188-1.944h-5.332l-1.191 1.882H44.85l-.126-1.882h-5.206l-1.255 1.944h-7.401c-2.259 0-4.391-1.38-4.705-3.512a8.099 8.099 0 010-3.011l-1.882 6.523h-4.077s-2.133-5.206-2.635-6.398c-.313 1.318-1.693 6.398-1.693 6.398h-3.638l2.822-10.287H13.8l.878-3.01h4.579l3.2 7.527 1.254-4.454h-1.255l.878-3.074h4.893l-1.443 4.956c.879-2.51 3.639-4.956 7.026-4.956h5.457l-1.255 4.642h-3.575s.314-1.003.44-1.505h-.816c-1.945 0-3.827 2.885-3.827 4.892 0 2.008 1.631 2.384 2.008 2.384h4.014l4.83-7.34h-1.129l.816-3.01h7.401l.502 8.782 3.638-5.708h-1.129l.878-3.074h7.34l.815 11.918c1.63-3.575 2.509-7.527 2.509-11.73 0-15.619-12.608-28.227-28.227-28.227-15.62 0-28.228 12.608-28.228 28.227 0 15.62 12.609 28.227 28.228 28.227a28.127 28.127 0 0024.965-15.054h-3.262v-.126zM41.65 42.59l2.886-4.328.125 4.265h-3.01v.063zm11.354-.063 2.823-4.265.125 4.265h-2.948z" fill="#009cde" />
    </svg>
  );
}

function Instagram({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden focusable="false">
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

// The roundel needs the room: at 15px the lettering inside it turns to mush,
// and it is the lettering that says which league this is.
const SIZES = { row: { ncaa: 18, instagram: 15 }, card: { ncaa: 20, instagram: 16 } } as const;

export function PlayerLinks({
  player,
  variant,
}: {
  player: PlayerRow;
  variant: "row" | "card";
}) {
  const size = SIZES[variant];
  const links = [
    {
      key: "ncaa",
      href: player.ncaaUrl,
      label: `Open ${player.name}'s college profile`,
      icon: <NcaaMark size={size.ncaa} />,
    },
    {
      key: "instagram",
      href: player.instagramUrl,
      label: `Open ${player.name}'s Instagram`,
      icon: <Instagram size={size.instagram} />,
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
