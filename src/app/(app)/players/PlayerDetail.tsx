"use client";

import { formatUSD } from "@/lib/format";
import type { PlayerRow } from "./PlayersClient";
import { ProfilesSection } from "./ProfilesSection";
import { ShareLinkPanel } from "./ShareLinkPanel";

function Photo({ url, label }: { url: string | null; label: string }) {
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-ink-600 bg-ink-900">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full place-items-center text-xs text-muted">{label}</div>
      )}
      <span className="absolute bottom-1 left-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
        {label}
      </span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="text-sm text-fg">{value || "—"}</div>
    </div>
  );
}

export function PlayerDetail({
  player,
  editable,
  seasonOptions = [],
  onClose,
  onEdit,
}: {
  player: PlayerRow;
  editable: boolean;
  seasonOptions?: string[];
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-fg">{player.name}</h2>
              {player.activeProfile && (
                <span className="badge inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Playing now
                </span>
              )}
              {player.graduated && (
                <span className="badge bg-accent/20 text-accent">
                  🎓 Graduated{player.graduationYear ? ` ${player.graduationYear}` : ""}
                </span>
              )}
              {!player.active && <span className="badge bg-ink-700 text-muted">Inactive</span>}
            </div>
            <p className="text-sm text-muted">
              {player.university ?? "—"}
              {player.season ? ` · ${player.season}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Photo url={player.profileImageUrl} label="Profile" />
          <Photo url={player.actionImageUrl} label="Action" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Info label="Division" value={player.division} />
          <Info label="Program" value={player.program} />
          <Info
            label="Scholarship"
            value={player.scholarship != null ? formatUSD(player.scholarship) : null}
          />
          <Info label="Position" value={player.position} />
          <Info label="Nationality" value={player.nationality} />
          <Info label="Previous club" value={player.previousClub} />
        </div>

        {player.notes && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-wide text-muted">Notes</div>
            <p className="whitespace-pre-wrap text-sm text-fg">{player.notes}</p>
          </div>
        )}

        <ProfilesSection
          playerId={player.id}
          seasonOptions={seasonOptions}
          editable={editable}
          defaults={{
            university: player.university,
            season: player.season,
            division: player.division,
          }}
        />

        {editable && <ShareLinkPanel playerId={player.id} />}

        <div className="mt-5 flex flex-wrap gap-2">
          {player.ncaaUrl && (
            <a href={player.ncaaUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3 py-1.5 text-xs">
              NCAA profile ↗
            </a>
          )}
          {player.instagramUrl && (
            <a href={player.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3 py-1.5 text-xs">
              Instagram ↗
            </a>
          )}
          {editable && (
            <button onClick={onEdit} className="btn-primary ml-auto px-3 py-1.5 text-xs">
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
