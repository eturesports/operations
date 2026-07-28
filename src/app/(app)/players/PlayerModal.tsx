"use client";

import { useEffect, useRef, useState } from "react";
import type { PlayerRow } from "./PlayersClient";
import { normalizePersonName } from "@/lib/names";
import { Select } from "@/components/Select";
import { ProfilesSection } from "./ProfilesSection";

export type PlayerForm = {
  sportId: string;
  name: string;
  university: string;
  season: string;
  division: string;
  program: string;
  scholarship: string;
  notes: string;
  profileImageUrl: string;
  actionImageUrl: string;
  ncaaUrl: string;
  instagramUrl: string;
  nationality: string;
  position: string;
  previousClub: string;
  active: boolean;
  playingNow: boolean;
  graduated: boolean;
  graduationYear: string;
  nationalChampion: boolean;
};

type SportOpt = { id: string; code: string; name: string };

function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Upload failed");
      onChange(j.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-start gap-3">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-ink-600 bg-ink-900">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] text-muted">No image</span>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            className="input"
            placeholder="Paste image URL, or upload →"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="btn-ghost px-3 py-1.5 text-xs"
            >
              {busy ? "Uploading…" : "Upload"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="text-xs text-muted hover:text-fg"
              >
                Remove
              </button>
            )}
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
      </div>
    </div>
  );
}

export function PlayerModal({
  sports,
  divisionOptions,
  programOptions,
  seasonOptions = [],
  initial,
  onClose,
  onSave,
}: {
  sports: SportOpt[];
  divisionOptions: string[];
  programOptions: string[];
  seasonOptions?: string[];
  initial: PlayerRow | null;
  onClose: () => void;
  onSave: (form: PlayerForm) => Promise<void>;
}) {
  const [form, setForm] = useState<PlayerForm>({
    sportId: initial?.sportId ?? sports[0]?.id ?? "",
    name: initial?.name ?? "",
    university: initial?.university ?? "",
    season: initial?.season ?? "",
    division: initial?.division ?? "",
    program: initial?.program ?? "",
    scholarship: initial?.scholarship != null ? String(initial.scholarship) : "",
    notes: initial?.notes ?? "",
    profileImageUrl: initial?.profileImageUrl ?? "",
    actionImageUrl: initial?.actionImageUrl ?? "",
    ncaaUrl: initial?.ncaaUrl ?? "",
    instagramUrl: initial?.instagramUrl ?? "",
    nationality: initial?.nationality ?? "",
    position: initial?.position ?? "",
    previousClub: initial?.previousClub ?? "",
    active: initial?.active ?? true,
    playingNow: initial?.activeProfile != null,
    graduated: initial?.graduated ?? false,
    nationalChampion: initial?.nationalChampion ?? false,
    graduationYear:
      initial?.graduationYear != null ? String(initial.graduationYear) : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set<K extends keyof PlayerForm>(k: K, v: PlayerForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-fg">
            {initial ? "Edit player" : "New player"}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-fg">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Name *</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                // tidy the casing once the user leaves the field, so what they
                // see is what gets stored
                onBlur={(e) => set("name", normalizePersonName(e.target.value))}
                autoFocus
                required
              />
            </div>

            {sports.length > 1 && (
              <div>
                <label className="label">Sport</label>
                <Select
                  value={(() => {
                    const s = sports.find((x) => x.id === form.sportId);
                    return s ? `${s.name} (${s.code})` : "";
                  })()}
                  options={sports.map((s) => `${s.name} (${s.code})`)}
                  onChange={(v) => {
                    const found = sports.find((s) => `${s.name} (${s.code})` === v);
                    if (found) set("sportId", found.id);
                  }}
                  ariaLabel="Sport"
                />
              </div>
            )}

            <div>
              <label className="label">University</label>
              <input
                className="input"
                value={form.university}
                onChange={(e) => set("university", e.target.value)}
              />
            </div>

            <div>
              <label className="label">Season</label>
              <Select
                value={form.season}
                options={seasonOptions}
                onChange={(v) => set("season", v)}
                placeholder="24/25 — or type a new one"
                allowCustom
                ariaLabel="Season"
              />
            </div>

            <div>
              <label className="label">Scholarship (USD)</label>
              <input
                className="input"
                inputMode="numeric"
                placeholder="120000"
                value={form.scholarship}
                onChange={(e) => set("scholarship", e.target.value)}
              />
            </div>

            <div>
              <label className="label">Division</label>
              <Select
                value={form.division}
                options={divisionOptions}
                onChange={(v) => set("division", v)}
                placeholder="Select a division"
                allowCustom
                ariaLabel="Division"
              />
            </div>

            <div>
              <label className="label">Program</label>
              <Select
                value={form.program}
                options={programOptions}
                onChange={(v) => set("program", v)}
                placeholder="Select a program"
                allowCustom
                ariaLabel="Program"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <textarea
                className="input min-h-[70px]"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
          </div>

          {/* Segmentation */}
          <div className="grid grid-cols-1 gap-4 border-t border-ink-600 pt-4 sm:grid-cols-3">
            <div>
              <label className="label">Position</label>
              <input
                className="input"
                list="position-list"
                placeholder="GK / DF / MF / FW"
                value={form.position}
                onChange={(e) => set("position", e.target.value)}
              />
              <datalist id="position-list">
                <option value="GK" />
                <option value="DF" />
                <option value="MF" />
                <option value="FW" />
              </datalist>
            </div>
            <div>
              <label className="label">Nationality</label>
              <input
                className="input"
                value={form.nationality}
                onChange={(e) => set("nationality", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Previous club</label>
              <input
                className="input"
                value={form.previousClub}
                onChange={(e) => set("previousClub", e.target.value)}
              />
            </div>
          </div>

          {/* Status & outcome */}
          <div className="space-y-4 border-t border-ink-600 pt-4">
            <div>
              <label className="label">Currently playing in college soccer</label>
              <div className="flex gap-2">
                {[
                  { value: true, label: "Playing now" },
                  { value: false, label: "Not playing" },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => set("playingNow", opt.value)}
                    aria-pressed={form.playingNow === opt.value}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      form.playingNow === opt.value
                        ? opt.value
                          ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
                          : "border-ink-500 bg-ink-700 text-fg"
                        : "border-ink-600 text-muted hover:text-fg"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">
                Counts them in the Active players dashboard and pulls their NCAA season stats.
                Uses the university above unless they already have a profile.
              </p>
            </div>

            <div>
              <label className="label">Record</label>
              <div className="flex gap-2">
                {[
                  { value: true, label: "In database" },
                  { value: false, label: "Archived" },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => set("active", opt.value)}
                    aria-pressed={form.active === opt.value}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      form.active === opt.value
                        ? "border-ink-500 bg-ink-700 text-fg"
                        : "border-ink-600 text-muted hover:text-fg"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">
                Archived players stay in the database but are excluded from every dashboard and
                analytic.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-center rounded-lg border border-ink-600 bg-ink-900/40 px-3 py-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-fg">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand"
                    checked={form.graduated}
                    onChange={(e) => set("graduated", e.target.checked)}
                  />
                  Graduated
                </label>
              </div>
              <div className="flex items-center rounded-lg border border-ink-600 bg-ink-900/40 px-3 py-2 sm:col-span-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-fg">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-accent"
                    checked={form.nationalChampion}
                    onChange={(e) => set("nationalChampion", e.target.checked)}
                  />
                  🏆 Won an NCAA national championship
                </label>
              </div>
              <div>
                <label className="label">Graduation year</label>
                <input
                  className="input"
                  inputMode="numeric"
                  placeholder="2025"
                  value={form.graduationYear}
                  onChange={(e) => set("graduationYear", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Media & links */}
          <div className="space-y-4 border-t border-ink-600 pt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ImageField
                label="Profile photo"
                value={form.profileImageUrl}
                onChange={(v) => set("profileImageUrl", v)}
              />
              <ImageField
                label="Action photo"
                value={form.actionImageUrl}
                onChange={(v) => set("actionImageUrl", v)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">NCAA profile</label>
                <input
                  className="input"
                  placeholder="https://university.com/sports/mens-soccer/roster/…"
                  value={form.ncaaUrl}
                  onChange={(e) => set("ncaaUrl", e.target.value)}
                />
                <p className="mt-1 text-[11px] text-muted">
                  Their roster page. This is the only place the link goes — stats are
                  pulled from it.
                </p>
              </div>
              <div>
                <label className="label">Instagram</label>
                <input
                  className="input"
                  placeholder="https://instagram.com/…"
                  value={form.instagramUrl}
                  onChange={(e) => set("instagramUrl", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* University profiles & NCAA stats — the same form, so there is one
              place to edit a player. Only for saved players: a profile needs an
              id to attach to. */}
          {initial && (
            <ProfilesSection
              playerId={initial.id}
              seasonOptions={seasonOptions}
              editable
              playerNcaaUrl={form.ncaaUrl || initial.ncaaUrl}
              defaults={{
                university: form.university || initial.university,
                season: form.season || initial.season,
                division: form.division || initial.division,
              }}
            />
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving…" : initial ? "Save changes" : "Create player"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
