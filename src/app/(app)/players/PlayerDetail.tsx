"use client";

import { formatUSD } from "@/lib/format";
import type { PlayerRow } from "./PlayersClient";
import { ProfilesSection } from "./ProfilesSection";
import { AchievementsSection } from "./AchievementsSection";
import { ShareLinkPanel } from "./ShareLinkPanel";
import { uniKey } from "@/lib/universities";
import { useModal, MODAL_BACKDROP, MODAL_PANEL } from "@/components/useModal";

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
  related = [],
  onOpenRelated,
  onClose,
  onEdit,
}: {
  player: PlayerRow;
  editable: boolean;
  seasonOptions?: string[];
  /** the same person's other operations — a transfer is a separate record */
  related?: PlayerRow[];
  onOpenRelated?: (p: PlayerRow) => void;
  onClose: () => void;
  onEdit: () => void;
}) {
  useModal(onClose);

  return (
    <div
      className={MODAL_BACKDROP}
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`${MODAL_PANEL} sm:max-w-lg`}
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
            value={
              player.scholarship != null
                ? `${formatUSD(player.scholarship)}${player.fullRide ? " · Full ride" : ""}`
                : player.fullRide
                  ? "Full ride"
                  : null
            }
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

        {/* Drafted once, at the end of the college years, so it sits with the
            player rather than with any one university. */}
        {(player.mlsDraftYear != null || player.mlsDraftClub) && (
          <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-3">
            <div className="text-[10px] uppercase tracking-wide text-accent">
              MLS Draft pick
            </div>
            <p className="mt-1 text-sm text-fg">
              {player.mlsDraftClub ?? "MLS"}
              {player.mlsDraftYear ? ` · ${player.mlsDraftYear}` : ""}
              {player.mlsDraftRound ? ` · Round ${player.mlsDraftRound}` : ""}
              {player.mlsDraftPick ? ` · Pick ${player.mlsDraftPick}` : ""}
            </p>
          </div>
        )}

        {/* Read-only here — university profiles and NCAA stats are edited in
            the single Edit form, so there is only one place to change things. */}
        <ProfilesSection
          playerId={player.id}
          seasonOptions={seasonOptions}
          editable={false}
          playerNcaaUrl={player.ncaaUrl}
        />

        <div className="mt-6 border-t border-ink-600 pt-4">
          <AchievementsSection playerId={player.id} editable={false} />
        </div>

        {related.length > 0 && (
          <div className="mt-6 border-t border-ink-600 pt-4">
            <h3 className="text-sm font-semibold text-fg">Career path</h3>
            <p className="mb-2 text-[11px] text-muted">
              The same person across their college journey.{" "}
              {related.length === 1 ? "One other record" : `${related.length} other records`}.
            </p>
            <div className="space-y-1.5">
              {related.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onOpenRelated?.(r)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-ink-600 bg-ink-800/40 px-3 py-2 text-left transition-colors hover:border-brand/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-fg">
                      {r.university ?? "—"}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {[r.season, r.division, r.program].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span
                      className={`badge ${
                        uniKey(r.university ?? "") === uniKey(player.university ?? "")
                          ? "bg-ink-700 text-muted"
                          : "bg-accent/20 text-accent"
                      }`}
                    >
                      {uniKey(r.university ?? "") === uniKey(player.university ?? "")
                        ? "Same college"
                        : "Transfer"}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-brand">Open →</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {editable && <ShareLinkPanel playerId={player.id} />}

        <div className="mt-5 flex flex-wrap gap-2">
          {player.ncaaUrl && (
            <a href={player.ncaaUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3 py-1.5 text-xs">
              College profile ↗
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
