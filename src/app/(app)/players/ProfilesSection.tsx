"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/Select";
import { NCAA_UNIVERSITIES, conferenceFor, divisionFor } from "@/lib/conferences";

export type Profile = {
  id: string;
  university: string;
  division: string | null;
  season: string | null;
  current: boolean;
  jersey: string | null;
  scholarship: number | null;
  fullRide: boolean;
  byEture: boolean;
  conferenceChampion: boolean;
  conferenceName: string | null;
  profileImageUrl: string | null;
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
  scholarship: string;
  fullRide: boolean;
  byEture: boolean;
  conferenceChampion: boolean;
  conferenceName: string;
  profileImageUrl: string;
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
  scholarship: "",
  fullRide: false,
  byEture: true,
  conferenceChampion: false,
  conferenceName: "",
  profileImageUrl: "",
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
    scholarship: p.scholarship != null ? String(p.scholarship) : "",
    fullRide: p.fullRide ?? false,
    byEture: p.byEture ?? true,
    conferenceChampion: p.conferenceChampion ?? false,
    conferenceName: p.conferenceName ?? "",
    profileImageUrl: p.profileImageUrl ?? "",
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

const DIVISIONS = [
  "Division I",
  "Division II",
  "Division III",
  "NAIA",
  "NJCAA",
  "JUCO",
  "MLS Next Pro",
];

export function ProfilesSection({
  playerId,
  seasonOptions,
  editable,
  defaults,
  playerNcaaUrl,
  onMoneyChange,
  onPlayingChange,
  requestedPlaying,
}: {
  playerId: string;
  seasonOptions: string[];
  editable: boolean;
  /** the single place the NCAA link lives — shown here, edited on the player */
  playerNcaaUrl?: string | null;
  /** The player form above shows the amount but does not own it. Without
   *  this it keeps showing what it loaded, so a correction made here looks
   *  like it did not take. */
  onMoneyChange?: (money: { scholarship: number | null; fullRide: boolean }) => void;
  /** Whether any stint is now marked as the roster they are on.
   *
   *  The player form above carries the same yes/no, read once when it opened.
   *  Without this it keeps the answer it started with, and saving the form
   *  writes that stale answer back — clearing the very profile that was just
   *  set as current here. */
  onPlayingChange?: (playing: boolean) => void;
  /** The same yes/no as it currently stands on the form above. Flipping it
   *  there acts on the stints here straight away, so the card and the control
   *  never sit on screen disagreeing with each other. */
  requestedPlaying?: boolean;
  // seeded from the player record so "mark as playing" is one click, not a form
  defaults?: { university?: string | null; season?: string | null; division?: string | null };
}) {
  const router = useRouter();
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

  // One place to answer "is any stint current?", rather than remembering to
  // tell the form at each of the five spots that can change it — promoting a
  // profile, saving one, deleting one, refreshing stats, or the first load.
  //
  // The ref is what makes it safe to depend on `profiles`: the callback comes
  // in as an inline closure, so a new one arrives every render, and firing on
  // every render would set state in a loop.
  const reported = useRef<boolean | null>(null);
  const playing = profiles.some((p) => p.current);
  useEffect(() => {
    if (loading) return;
    if (reported.current === playing) return;
    reported.current = playing;
    onPlayingChange?.(playing);
  }, [playing, loading, onPlayingChange]);

  // ...and the same link read the other way. The first value seen is only
  // adopted, never acted on: it is what the form loaded with, not a decision
  // anybody made, and acting on it would rewrite the stints on open.
  const applied = useRef<boolean | null>(null);
  useEffect(() => {
    if (loading || requestedPlaying === undefined) return;
    if (applied.current === null) {
      applied.current = requestedPlaying;
      return;
    }
    if (applied.current === requestedPlaying) return;
    applied.current = requestedPlaying;
    if (requestedPlaying !== playing) void applyPlaying(requestedPlaying);
    // `playing` is read, not depended on: this must run when the form changes
    // its mind, not every time the stints settle — that is the other effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedPlaying, loading]);

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  }

  // New profile pre-filled from the player's own university/season/division.
  function newDraft(current: boolean): Draft {
    return {
      ...empty,
      current,
      university: defaults?.university ?? "",
      season: defaults?.season ?? "",
      division: defaults?.division ?? "",
    };
  }

  // Player-level refresh: uses the player's own NCAA profile link, and creates
  // their first university profile if they don't have one yet.
  async function refreshFromPlayerLink() {
    setRefreshing("player");
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/players/${playerId}/refresh-stats`, {
        method: "POST",
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Refresh failed");
        return;
      }
      if (!j.matched) {
        setNotice(
          (j.reason ?? "No stats found for this player.") +
            (j.photoAdded
              ? " Their photo was copied from the roster page."
              : j.photoBlocked
                ? " Their photo could not be copied: image storage is not enabled in Vercel."
                : "")
        );
        if (j.photoAdded) router.refresh();
        return;
      }
      const saved = j.profile as Profile;
      setProfiles((prev) => {
        const exists = prev.some((p) => p.id === saved.id);
        const next = exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev];
        return saved.current
          ? next.map((p) => (p.id === saved.id ? p : { ...p, current: false }))
          : next;
      });
      setNotice(
        (j.createdProfile ? "Created their profile and updated stats" : "Stats updated") +
          ` from ${j.source === "roster-site" ? "their college profile page" : "the national leaderboards"} — ${j.matchedLabel}` +
          (j.seasonsCounted > 1 ? ` · career totals across ${j.seasonsCounted} seasons.` : ".") +
          (j.photoAdded
            ? " Photo copied from the roster page."
            : j.photoBlocked
              ? " Photo not copied: image storage is not enabled in Vercel."
              : "")
      );
      router.refresh();
    } catch {
      setError("Could not reach the stats service.");
    } finally {
      setRefreshing(null);
    }
  }

  // One-click promote an existing profile to "playing now".
  async function setCurrent(p: Profile) {
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/profiles/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: true }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not update");
      if (j.player) onMoneyChange?.(j.player);
      setProfiles((prev) =>
        prev.map((x) => ({ ...x, current: x.id === p.id }))
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    }
  }

  /**
   * The form's toggle, applied to the stints.
   *
   * Turning it on promotes the stint that already reads as theirs — the
   * current one if there is one, otherwise the top of the list, which the
   * server sorted by season for exactly this. With no stints at all there is
   * nothing to promote and saving the form will build the first one from the
   * player's own university, so this steps aside.
   */
  async function applyPlaying(next: boolean) {
    const target = profiles.find((p) => p.current) ?? profiles[0];
    if (!target) return;
    if (next) {
      await setCurrent(target);
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/profiles/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: false }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not update");
      if (j.player) onMoneyChange?.(j.player);
      setProfiles((prev) => prev.map((x) => ({ ...x, current: false })));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    }
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
      scholarship: draft.scholarship.trim() === "" ? null : Number(draft.scholarship),
      fullRide: draft.fullRide,
      byEture: draft.byEture,
      // Sent at last: the form has always had the checkbox, but the payload
      // never carried these two, so every title ticked here was dropped on
      // save without a word.
      conferenceChampion: draft.conferenceChampion,
      conferenceName: draft.conferenceName.trim() || null,
      profileImageUrl: draft.profileImageUrl.trim() || null,
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
      // The server has already re-derived what the player record mirrors.
      // Pass that up rather than working the same rule out again here.
      if (j.player) onMoneyChange?.(j.player);
      setProfiles((prev) => {
        const next = draft.id
          ? prev.map((p) => (p.id === saved.id ? saved : p))
          : [saved, ...prev];
        // keep a single current profile in the UI
        return saved.current ? next.map((p) => (p.id === saved.id ? p : { ...p, current: false })) : next;
      });
      setDraft(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Profile) {
    if (!confirm(`Remove ${p.university} profile?`)) return;
    const res = await fetch(`/api/profiles/${p.id}`, { method: "DELETE" });
    if (res.ok) {
      const j = (await res.json().catch(() => ({}))) as {
        player?: { scholarship: number | null; fullRide: boolean };
      };
      if (j.player) onMoneyChange?.(j.player);
      setProfiles((prev) => prev.filter((x) => x.id !== p.id));
      router.refresh();
    }
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
        setNotice(
          (j.reason ?? "No match found on NCAA leaderboards.") +
            cand +
            (j.photoAdded
              ? " Their photo was copied from the roster page."
              : j.photoBlocked
                ? " Their photo could not be copied: image storage is not enabled in Vercel."
                : "")
        );
        if (j.photoAdded) router.refresh();
        return;
      }
      setProfiles((prev) => prev.map((x) => (x.id === p.id ? (j.profile as Profile) : x)));
      setNotice(
        (j.source === "roster-site"
          ? `Updated from the university roster page — ${j.ncaa.name}.`
          : `Updated from the national leaderboards — matched ${j.ncaa.name}.`) +
          (j.photoAdded
            ? " Photo copied from the roster page."
            : j.photoBlocked
              ? " Photo not copied: image storage is not enabled in Vercel."
              : "")
      );
      if (j.photoAdded) router.refresh();
    } catch {
      setError("Could not reach the NCAA stats service.");
    } finally {
      setRefreshing(null);
    }
  }

  // Titles won across every stint, gathered where the profiles already are.
  const titles = profiles.filter((p) => p.conferenceChampion);

  return (
    <div className="mt-6 border-t border-ink-600 pt-4">
      {titles.length > 0 && (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent/5 p-3">
          <div className="text-[10px] uppercase tracking-wide text-accent">
            Conference champion{titles.length === 1 ? "" : "s"}
          </div>
          <ul className="mt-1.5 space-y-1">
            {titles.map((t) => (
              <li key={t.id} className="text-sm text-fg">
                🏆 {t.conferenceName || conferenceFor(t.university) || "Conference"}
                <span className="text-muted">
                  {" "}&middot; {t.university}
                  {t.season ? ` · ${t.season}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-fg">College profiles &amp; stats</h3>
          <p className="text-[11px] text-muted">
            Mark the roster the player is on right now to track their live stats.
          </p>
        </div>
        {editable && !draft && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={refreshFromPlayerLink}
              disabled={refreshing === "player"}
              className="btn-ghost px-3 py-1 text-xs"
              title="Read this player's college profile link and pull their season stats"
            >
              {refreshing === "player" ? "Refreshing…" : "↻ Refresh stats"}
            </button>
            {profiles.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setDraft(newDraft(false));
                }}
                className="btn-ghost px-3 py-1 text-xs"
              >
                + Add profile
              </button>
            )}
          </div>
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
        <div className="rounded-xl border border-dashed border-ink-500 bg-ink-900/30 p-4 text-center">
          <p className="text-xs text-muted">
            No college profiles yet. A player can hold several — one per college
            they&apos;ve played for.
          </p>
          {editable && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setDraft(newDraft(false));
                }}
                className="btn-primary px-4 py-1.5 text-xs"
              >
                + Add college profile
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setDraft(newDraft(true));
                }}
                className="btn-ghost px-4 py-1.5 text-xs"
              >
                ✓ Add as playing now
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => (
            <div key={p.id} className="rounded-xl border border-ink-600 bg-ink-800/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-fg">{p.university}</span>
                    {p.current ? (
                      <span className="badge inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Playing now
                      </span>
                    ) : (
                      editable && (
                        <button
                          type="button"
                          onClick={() => setCurrent(p)}
                          className="text-[11px] text-muted underline-offset-2 hover:text-fg hover:underline"
                          aria-label={`Mark ${p.university} as the roster this player is on now`}
                        >
                          Set as playing now
                        </button>
                      )
                    )}
                  </div>
                  <div className="text-[11px] text-muted">
                    {[p.division, p.season, p.jersey ? `#${p.jersey}` : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                  {/* Only the exception is marked. Badging every stint "Eture"
                      would put a label on almost every row and make the one
                      that matters harder to spot, not easier. */}
                  {!p.byEture && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-ink-600 bg-ink-900/60 px-2 py-0.5 text-[10px] text-muted">
                      <span aria-hidden>↷</span>
                      Transfer arranged by the player — not an Eture operation
                    </div>
                  )}
                </div>
                {editable && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => refresh(p)}
                      disabled={refreshing === p.id}
                      className="btn-ghost px-2 py-1 text-[11px]"
                      title="Pull season stats from this college's roster page"
                      aria-label={`Refresh ${p.university} stats`}
                    >
                      {refreshing === p.id ? "Refreshing…" : "↻ Refresh"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setNotice(null);
                        setDraft(toDraft(p));
                      }}
                      className="text-xs text-muted hover:text-fg"
                      title="Edit profile"
                      aria-label={`Edit ${p.university} profile`}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(p)}
                      className="text-xs text-red-400 hover:text-red-300"
                      title="Remove profile"
                      aria-label={`Remove ${p.university} profile`}
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
                    {p.statsSource === "roster-site"
                      ? "University site"
                      : p.statsSource === "manual"
                        ? "Manual"
                        : "NCAA"}
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
          playerNcaaUrl={playerNcaaUrl}
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
  playerNcaaUrl,
  busy,
  onChange,
  onCancel,
  onSave,
}: {
  draft: Draft;
  seasonOptions: string[];
  playerNcaaUrl?: string | null;
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
          <Select
            value={draft.university}
            options={NCAA_UNIVERSITIES}
            onChange={(v) => {
              onChange("university", v);
              // The division belongs to the university, so choosing one
              // brings it along instead of being typed a second time. Only
              // when the directory knows the school: JUCO and NAIA are not
              // members, and their divisions stay hand-set.
              const d = divisionFor(v);
              if (d) onChange("division", d);
            }}
            placeholder="Search a university, or type one"
            allowCustom
            ariaLabel="University"
          />
          {(divisionFor(draft.university) || conferenceFor(draft.university)) && (
            <p className="mt-1 text-[11px] text-muted">
              {[divisionFor(draft.university), conferenceFor(draft.university)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
        <div>
          <label className="label">
            Division
            {divisionFor(draft.university) && (
              <span className="ml-1 text-[9px] uppercase tracking-wide text-muted">
                &middot; from the university
              </span>
            )}
          </label>
          <input
            className="input"
            list="profile-division-list"
            placeholder={divisionFor(draft.university) ?? "Division I"}
            value={draft.division}
            onChange={(e) => onChange("division", e.target.value)}
          />
          {/* The divisions already in the database, so the same competition is
              not typed three different ways across the years. */}
          <datalist id="profile-division-list">
            {DIVISIONS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
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
          {/* Each university agrees its own figure, so it is asked for here
              rather than once on the player. */}
          <label className="label">Scholarship at this university (USD)</label>
          <input
            className="input"
            inputMode="numeric"
            placeholder="120000"
            value={draft.scholarship}
            onChange={(e) => onChange("scholarship", e.target.value)}
          />
          <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-xs text-fg">
            <input
              type="checkbox"
              className="h-4 w-4 accent-accent"
              checked={draft.fullRide}
              onChange={(e) => onChange("fullRide", e.target.checked)}
            />
            Full ride
          </label>
        </div>
        {/* A conference title is won with this team, in this season, so it is
            recorded here rather than on the person. The conference is filled
            in from the university but stays editable: a school's soccer
            conference can differ from its primary one, and they realign. */}
        <div className="col-span-2 rounded-lg border border-ink-600 bg-ink-900/40 px-3 py-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              className="h-4 w-4 accent-accent"
              checked={draft.conferenceChampion}
              onChange={(e) => {
                onChange("conferenceChampion", e.target.checked);
                if (e.target.checked && !draft.conferenceName) {
                  const c = conferenceFor(draft.university);
                  if (c) onChange("conferenceName", c);
                }
              }}
            />
            🏆 Conference champion
          </label>
          {draft.conferenceChampion && (
            <input
              className="input mt-2"
              placeholder={conferenceFor(draft.university) ?? "Conference name"}
              value={draft.conferenceName}
              onChange={(e) => onChange("conferenceName", e.target.value)}
              aria-label="Conference"
            />
          )}
        </div>
        <div>
          <label className="label">Photo in this shirt</label>
          <input
            className="input"
            placeholder="https://…"
            value={draft.profileImageUrl}
            onChange={(e) => onChange("profileImageUrl", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Jersey #</label>
          <input
            className="input"
            value={draft.jersey}
            onChange={(e) => onChange("jersey", e.target.value)}
          />
        </div>
        <div className="col-span-2 flex items-center rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-500"
              checked={draft.current}
              onChange={(e) => onChange("current", e.target.checked)}
            />
            <span>
              Playing here now
              <span className="ml-1 text-xs text-muted">
                — shows on the Active players dashboard
              </span>
            </span>
          </label>
        </div>

        {/* Who arranged this move. It is asked here, on the stint, because a
            career can mix the two: we take a player to the United States and
            he transfers on his own two years later. Untick it and the stint
            stays on his record but stops counting as an operation of ours. */}
        <div className="col-span-2 rounded-lg border border-ink-600 bg-ink-900/40 px-3 py-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand"
              checked={draft.byEture}
              onChange={(e) => onChange("byEture", e.target.checked)}
            />
            <span>Eture arranged this move</span>
          </label>
          <p className="mt-1 text-[11px] text-muted">
            {draft.byEture
              ? "Counts as an Eture operation: totals, scholarships and the division split."
              : "The player arranged this transfer himself. It stays in his career and on the Active players dashboard, but no count of our operations includes it."}
          </p>
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
        <div className="col-span-2">
          <label className="label">College profile link</label>
          <input
            className="input"
            placeholder={playerNcaaUrl || "https://university.com/sports/mens-soccer/roster/…"}
            value={draft.rosterUrl}
            onChange={(e) => onChange("rosterUrl", e.target.value)}
          />
          <p className="mt-1 text-[11px] text-muted">
            This college&apos;s own roster page, used for these stats. Leave empty to
            use the player&apos;s main link
            {playerNcaaUrl ? "" : " (none set yet)"}.
          </p>
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
        <button type="button" onClick={onCancel} className="btn-ghost px-3 py-1.5 text-xs">
          Cancel
        </button>
        <button type="button" onClick={onSave} disabled={busy} className="btn-primary px-3 py-1.5 text-xs">
          {busy ? "Saving…" : draft.id ? "Save" : "Add profile"}
        </button>
      </div>
    </div>
  );
}
