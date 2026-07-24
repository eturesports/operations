"use client";

import { useEffect, useState } from "react";

export type Profile = {
  id: string;
  university: string;
  division: string | null;
  season: string | null;
  current: boolean;
  jersey: string | null;
  ncaaSport: string | null;
  ncaaDivision: string | null;
  rosterUrl: string | null;
  matchesPlayed: number | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  points: number | null;
  saves: number | null;
  goalsAgainst: number | null;
  statsSource: string | null;
  statsUpdatedAt: string | null;
};

type Draft = {
  id?: string;
  university: string;
  division: string;
  season: string;
  current: boolean;
  jersey: string;
  ncaaSport: string;
  ncaaDivision: string;
  rosterUrl: string;
  matchesPlayed: string;
  minutes: string;
  goals: string;
  assists: string;
  points: string;
  saves: string;
  goalsAgainst: string;
};

const empty: Draft = {
  university: "",
  division: "",
  season: "",
  current: false,
  jersey: "",
  ncaaSport: "soccer-men",
  ncaaDivision: "d1",
  rosterUrl: "",
  matchesPlayed: "",
  minutes: "",
  goals: "",
  assists: "",
  points: "",
  saves: "",
  goalsAgainst: "",
};

function toDraft(p: Profile): Draft {
  const s = (n: number | null) => (n == null ? "" : String(n));
  return {
    id: p.id,
    university: p.university ?? "",
    division: p.division ?? "",
    season: p.season ?? "",
    current: p.current,
    jersey: p.jersey ?? "",
    ncaaSport: p.ncaaSport ?? "soccer-men",
    ncaaDivision: p.ncaaDivision ?? "d1",
    rosterUrl: p.rosterUrl ?? "",
    matchesPlayed: s(p.matchesPlayed),
    minutes: s(p.minutes),
    goals: s(p.goals),
    assists: s(p.assists),
    points: s(p.points),
    saves: s(p.saves),
    goalsAgainst: s(p.goalsAgainst),
  };
}

const num = (v: string) => (v.trim() === "" ? null : parseInt(v.replace(/[^\d-]/g, ""), 10));

function Stat({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <div className="rounded-lg border border-ink-600 bg-ink-900/40 px-2.5 py-1.5 text-center">
      <div className="font-display text-lg leading-none text-fg">{value}</div>
      <div className="mt-0.5 text-[9px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

export function ProfilesSection({
  playerId,
  seasonOptions,
  editable,
}: {
  playerId: string;
  seasonOptions: string[];
  editable: boolean;
}) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/players/${playerId}/profiles`);
        const j = await res.json();
        if (!cancelled && res.ok) setProfiles(j.profiles ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  }

  async function save() {
    if (!draft) return;
    if (!draft.university.trim()) {
      setError("University is required.");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      university: draft.university.trim(),
      division: draft.division.trim() || null,
      season: draft.season.trim() || null,
      current: draft.current,
      jersey: draft.jersey.trim() || null,
      ncaaSport: draft.ncaaSport,
      ncaaDivision: draft.ncaaDivision,
      rosterUrl: draft.rosterUrl.trim() || null,
      matchesPlayed: num(draft.matchesPlayed),
      minutes: num(draft.minutes),
      goals: num(draft.goals),
      assists: num(draft.assists),
      points: num(draft.points),
      saves: num(draft.saves),
      goalsAgainst: num(draft.goalsAgainst),
    };
    try {
      const res = await fetch(
        draft.id ? `/api/profiles/${draft.id}` : `/api/players/${playerId}/profiles`,
        {
          method: draft.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not save profile");
      const saved = j.profile as Profile;
      setProfiles((prev) => {
        const next = draft.id
          ? prev.map((p) => (p.id === saved.id ? saved : p))
          : [saved, ...prev];
        // keep a single current profile in the UI
        return saved.current ? next.map((p) => (p.id === saved.id ? p : { ...p, current: false })) : next;
      });
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Profile) {
    if (!confirm(`Remove ${p.university} profile?`)) return;
    const res = await fetch(`/api/profiles/${p.id}`, { method: "DELETE" });
    if (res.ok) setProfiles((prev) => prev.filter((x) => x.id !== p.id));
  }

  async function refresh(p: Profile) {
    setRefreshing(p.id);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/profiles/${p.id}/refresh`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Refresh failed");
        return;
      }
      if (!j.matched) {
        const cand =
          j.candidates?.length > 0
            ? ` Closest names: ${j.candidates.map((c: { name: string; team: string }) => `${c.name} (${c.team})`).join(", ")}.`
            : "";
        setNotice((j.reason ?? "No match found on NCAA leaderboards.") + cand);
        return;
      }
      setProfiles((prev) => prev.map((x) => (x.id === p.id ? (j.profile as Profile) : x)));
      setNotice(`Updated from NCAA — matched ${j.ncaa.name} (${j.ncaa.team}).`);
    } catch {
      setError("Could not reach the NCAA stats service.");
    } finally {
      setRefreshing(null);
    }
  }

  return (
    <div className="mt-6 border-t border-ink-600 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg">University profiles</h3>
        {editable && !draft && (
          <button
            onClick={() => {
              setError(null);
              setNotice(null);
              setDraft({ ...empty, current: profiles.length === 0 });
            }}
            className="btn-ghost px-3 py-1 text-xs"
          >
            + Add profile
          </button>
        )}
      </div>

      {notice && (
        <div className="mb-3 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs text-blue-300">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : profiles.length === 0 && !draft ? (
        <p className="text-xs text-muted">
          No university profiles yet. A player can have several (e.g. after a transfer).
        </p>
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => (
            <div key={p.id} className="rounded-xl border border-ink-600 bg-ink-800/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-fg">{p.university}</span>
                    {p.current && (
                      <span className="badge bg-brand/20 text-brand">Current</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted">
                    {[p.division, p.season, p.jersey ? `#${p.jersey}` : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </div>
                {editable && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => refresh(p)}
                      disabled={refreshing === p.id}
                      className="btn-ghost px-2 py-1 text-[11px]"
                      title="Pull season stats from the NCAA stats API"
                    >
                      {refreshing === p.id ? "Refreshing…" : "↻ NCAA"}
                    </button>
                    <button
                      onClick={() => {
                        setError(null);
                        setNotice(null);
                        setDraft(toDraft(p));
                      }}
                      className="text-xs text-muted hover:text-fg"
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => remove(p)}
                      className="text-xs text-red-400 hover:text-red-300"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {(p.matchesPlayed != null ||
                p.goals != null ||
                p.assists != null ||
                p.points != null ||
                p.minutes != null ||
                p.saves != null) && (
                <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  <Stat label="GP" value={p.matchesPlayed} />
                  <Stat label="Min" value={p.minutes} />
                  <Stat label="G" value={p.goals} />
                  <Stat label="A" value={p.assists} />
                  <Stat label="Pts" value={p.points} />
                  <Stat label="Saves" value={p.saves} />
                </div>
              )}

              <div className="mt-2 flex items-center gap-3">
                {p.rosterUrl && (
                  <a
                    href={p.rosterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-brand hover:underline"
                  >
                    Roster page ↗
                  </a>
                )}
                {p.statsSource && (
                  <span className="text-[10px] text-muted">
                    {p.statsSource === "ncaa-api" ? "NCAA" : "Manual"}
                    {p.statsUpdatedAt
                      ? ` · ${new Date(p.statsUpdatedAt).toLocaleDateString()}`
                      : ""}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <ProfileForm
          draft={draft}
          seasonOptions={seasonOptions}
          busy={busy}
          onChange={set}
          onCancel={() => {
            setDraft(null);
            setError(null);
          }}
          onSave={save}
        />
      )}
    </div>
  );
}

function ProfileForm({
  draft,
  seasonOptions,
  busy,
  onChange,
  onCancel,
  onSave,
}: {
  draft: Draft;
  seasonOptions: string[];
  busy: boolean;
  onChange: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-ink-500 bg-ink-900/60 p-4">
      <div className="mb-3 text-xs font-semibold text-fg">
        {draft.id ? "Edit profile" : "New university profile"}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">University</label>
          <input
            className="input"
            value={draft.university}
            onChange={(e) => onChange("university", e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="label">Division</label>
          <input
            className="input"
            placeholder="Division I"
            value={draft.division}
            onChange={(e) => onChange("division", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Season</label>
          <input
            className="input"
            list="profile-season-list"
            placeholder="24/25"
            value={draft.season}
            onChange={(e) => onChange("season", e.target.value)}
          />
          <datalist id="profile-season-list">
            {seasonOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label">Jersey #</label>
          <input
            className="input"
            value={draft.jersey}
            onChange={(e) => onChange("jersey", e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              checked={draft.current}
              onChange={(e) => onChange("current", e.target.checked)}
            />
            Current roster
          </label>
        </div>
        <div>
          <label className="label">NCAA sport</label>
          <select
            className="input"
            value={draft.ncaaSport}
            onChange={(e) => onChange("ncaaSport", e.target.value)}
          >
            <option value="soccer-men">Men&apos;s Soccer (MSOC)</option>
            <option value="soccer-women">Women&apos;s Soccer (WSOC)</option>
          </select>
        </div>
        <div>
          <label className="label">NCAA division</label>
          <select
            className="input"
            value={draft.ncaaDivision}
            onChange={(e) => onChange("ncaaDivision", e.target.value)}
          >
            <option value="d1">D1</option>
            <option value="d2">D2</option>
            <option value="d3">D3</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Roster / profile URL</label>
          <input
            className="input"
            placeholder="https://…"
            value={draft.rosterUrl}
            onChange={(e) => onChange("rosterUrl", e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 text-[10px] uppercase tracking-wide text-muted">
        Season stats (manual, or use ↻ NCAA)
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {(
          [
            ["matchesPlayed", "GP"],
            ["minutes", "Min"],
            ["goals", "G"],
            ["assists", "A"],
            ["points", "Pts"],
            ["saves", "Saves"],
          ] as [keyof Draft, string][]
        ).map(([k, label]) => (
          <div key={k}>
            <label className="label">{label}</label>
            <input
              className="input px-2 py-1.5 text-center text-sm"
              inputMode="numeric"
              value={draft[k] as string}
              onChange={(e) => onChange(k, e.target.value as Draft[typeof k])}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="btn-ghost px-3 py-1.5 text-xs">
          Cancel
        </button>
        <button onClick={onSave} disabled={busy} className="btn-primary px-3 py-1.5 text-xs">
          {busy ? "Saving…" : draft.id ? "Save" : "Add profile"}
        </button>
      </div>
    </div>
  );
}
