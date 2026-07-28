"use client";

import { useMemo, useState } from "react";
import { formatNumber, seasonSortKey } from "@/lib/format";
import { Select } from "@/components/Select";
import { isOurCopy } from "@/lib/photo";

export type LinkRow = {
  id: string;
  name: string;
  university: string | null;
  season: string | null;
  division: string | null;
  ncaaUrl: string | null;
  playingNow: boolean;
  photo: string | null;
};

type Status = "idle" | "saving" | "saved" | "error";

// A search that lands on the athletics site rather than a news article.
function searchUrl(r: LinkRow) {
  const q = `${r.name} ${r.university ?? ""} men's soccer roster`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

function Row({
  r,
  onSaved,
  onPhoto,
}: {
  r: LinkRow;
  onSaved: (id: string, url: string | null) => void;
  onPhoto: (id: string, url: string) => void;
}) {
  const [value, setValue] = useState(r.ncaaUrl ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const dirty = value.trim() !== (r.ncaaUrl ?? "");

  async function save() {
    if (!dirty) return;
    setStatus("saving");
    setMessage(null);
    try {
      const res = await fetch(`/api/players/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ncaaUrl: value.trim() || null }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Could not save");
      setStatus("saved");
      onSaved(r.id, value.trim() || null);
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Could not save");
    }
  }

  // Pull stats straight after pasting a link — the point of adding it.
  async function refresh() {
    setStatus("saving");
    setMessage(null);
    try {
      const res = await fetch(`/api/players/${r.id}/refresh-stats`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Refresh failed");
      if (j.photoAdded && j.photoUrl) onPhoto(r.id, j.photoUrl);
      const photoNote = j.photoAdded
        ? " · photo added"
        : j.photoBlocked
          ? " · photo not copied: image storage is off"
          : "";
      setStatus(j.matched ? "saved" : "error");
      setMessage(
        j.matched
          ? `Stats loaded${j.seasonsCounted > 1 ? ` · ${j.seasonsCounted} seasons` : ""}${photoNote}`
          : (j.reason ?? "No stats found") + photoNote
      );
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Refresh failed");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-2 border-b border-ink-700/60 px-3 py-2.5 sm:grid-cols-[minmax(0,15rem)_1fr_auto] sm:items-center sm:gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {r.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.photo}
            alt=""
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-700 text-[10px] text-muted"
            title="No photo yet"
          >
            ○
          </span>
        )}
        <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-fg">{r.name}</span>
          {r.playingNow && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" title="Playing now" />
          )}
        </div>
        <div className="truncate text-[11px] text-muted">
          {[r.university, r.season, r.division].filter(Boolean).join(" · ") || "—"}
        </div>
        </div>
      </div>

      <div className="min-w-0">
        <input
          className="input py-1.5 text-xs"
          placeholder="Paste their college roster link…"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setStatus("idle");
            setMessage(null);
          }}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label={`College link for ${r.name}`}
        />
        {message && (
          <p
            className={`mt-0.5 text-[11px] ${
              status === "error" ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {message}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <a
          href={searchUrl(r)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost px-2.5 py-1 text-[11px]"
          title="Search for this player's roster page"
        >
          Find ↗
        </a>
        {value.trim() && (
          <>
            <a
              href={value.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost px-2.5 py-1 text-[11px]"
              title="Open the link"
            >
              Open
            </a>
            <button
              type="button"
              onClick={refresh}
              disabled={status === "saving" || dirty}
              title={dirty ? "Save the link first" : "Pull stats from this link"}
              className="btn-ghost px-2.5 py-1 text-[11px]"
            >
              {status === "saving" ? "…" : "↻ Stats"}
            </button>
          </>
        )}
        <span className="w-4 text-center text-xs">
          {status === "saved" && <span className="text-emerald-400">✓</span>}
          {status === "error" && <span className="text-amber-400">!</span>}
        </span>
      </div>
    </div>
  );
}

export function LinksClient({ rows: initial }: { rows: LinkRow[] }) {
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("Missing links");
  const [season, setSeason] = useState("All seasons");

  const seasons = useMemo(
    () =>
      [...new Set(rows.map((r) => r.season).filter(Boolean) as string[])].sort(
        (a, b) => seasonSortKey(b) - seasonSortKey(a)
      ),
    [rows]
  );

  const [photoRun, setPhotoRun] = useState<
    { busy: boolean; message: string | null }
  >({ busy: false, message: null });

  const withLink = rows.filter((r) => r.ncaaUrl).length;
  const pct = rows.length ? Math.round((withLink / rows.length) * 100) : 0;
  const withPhoto = rows.filter((r) => r.photo).length;
  const missingPhoto = rows.filter((r) => r.ncaaUrl && !r.photo).length;
  // Photos still served from a university's own site — one redesign away
  // from disappearing, so they are worth copying across too.
  const notStored = rows.filter((r) => r.photo && !isOurCopy(r.photo)).length;
  const photoWork = missingPhoto + notStored;

  // Copies headshots for everyone who has a link but no photo, and brings
  // any photo still hosted elsewhere into our own storage. The server works
  // in batches to stay inside its time limit, so keep asking until it says
  // there is nothing left.
  async function copyPhotos() {
    setPhotoRun({ busy: true, message: "Reading roster pages…" });
    let total = 0;
    try {
      for (let round = 0; round < 12; round += 1) {
        const res = await fetch("/api/players/photos/backfill", { method: "POST" });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error ?? "Could not copy photos");

        const found: { id: string; url: string }[] = j.photos ?? [];
        if (found.length) {
          setRows((prev) =>
            prev.map((r) => {
              const hit = found.find((f) => f.id === r.id);
              return hit ? { ...r, photo: hit.url } : r;
            })
          );
        }
        const done = (j.added ?? 0) + (j.mirrored ?? 0);
        total += done;
        setPhotoRun({ busy: true, message: `${total} photo${total === 1 ? "" : "s"} copied…` });
        // Nothing left to try, or this batch found nothing new to copy.
        if (!j.remaining || done === 0) break;
      }
      setPhotoRun({
        busy: false,
        message:
          total > 0
            ? `${total} photo${total === 1 ? "" : "s"} stored on the platform.`
            : "No new photos — those pages only publish club images.",
      });
    } catch (e) {
      setPhotoRun({
        busy: false,
        message: e instanceof Error ? e.message : "Could not copy photos",
      });
    }
  }

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (scope === "Missing links" && r.ncaaUrl) return false;
      if (scope === "Has a link" && !r.ncaaUrl) return false;
      if (scope === "Playing now" && !r.playingNow) return false;
      if (scope === "Missing photo" && r.photo) return false;
      if (season !== "All seasons" && r.season !== season) return false;
      if (needle) {
        const hay = `${r.name} ${r.university ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, scope, season]);

  function onSaved(id: string, url: string | null) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ncaaUrl: url } : r)));
  }

  function onPhoto(id: string, url: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, photo: url } : r)));
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="kicker mb-1">Editors</div>
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">College links</h1>
        <p className="text-sm text-muted">
          Paste each player&apos;s roster page and their stats — and their photo —
          follow. Use <b className="text-fg">Find</b> to search for it, paste, press
          Enter, then <b className="text-fg">↻ Stats</b>.
        </p>
      </div>

      <div className="card p-4">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-fg">
            {formatNumber(withLink)} of {formatNumber(rows.length)} players linked
          </span>
          <span className="font-display text-2xl text-fg">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-ink-700">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink-700/60 pt-3">
          <span className="text-xs text-muted">
            {formatNumber(withPhoto)} with a photo
            {missingPhoto > 0 && ` · ${formatNumber(missingPhoto)} linked but still without one`}
            {notStored > 0 && ` · ${formatNumber(notStored)} not stored on the platform yet`}
          </span>
          <div className="flex items-center gap-2">
            {photoRun.message && (
              <span className="text-[11px] text-muted">{photoRun.message}</span>
            )}
            <button
              type="button"
              onClick={copyPhotos}
              disabled={photoRun.busy || photoWork === 0}
              className="btn-ghost px-3 py-1 text-xs"
              title="Copy each player's headshot from their college roster page into our own storage"
            >
              {photoRun.busy ? "Copying…" : "Copy photos from links"}
            </button>
          </div>
        </div>
      </div>

      <div className="card relative z-30 grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        <input
          className="input"
          placeholder="Search by name or college…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select
          value={scope}
          options={["Missing links", "Has a link", "Missing photo", "Playing now", "Everyone"]}
          onChange={setScope}
          ariaLabel="Which players to show"
        />
        <Select
          value={season}
          options={["All seasons", ...seasons]}
          onChange={setSeason}
          ariaLabel="Season"
        />
      </div>

      <div className="card overflow-hidden">
        {visible.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted">
            Nothing here — every player in this selection already has a link.
          </p>
        ) : (
          <>
            <div className="border-b border-ink-600 px-3 py-2 text-[11px] uppercase tracking-wide text-muted">
              {formatNumber(visible.length)} player{visible.length === 1 ? "" : "s"}
            </div>
            {visible.slice(0, 100).map((r) => (
              <Row key={r.id} r={r} onSaved={onSaved} onPhoto={onPhoto} />
            ))}
            {visible.length > 100 && (
              <p className="px-3 py-3 text-center text-xs text-muted">
                Showing the first 100 — narrow the filters to reach the rest.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
