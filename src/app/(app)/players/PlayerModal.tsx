"use client";

import { useEffect, useRef, useState } from "react";
import type { PlayerRow } from "./PlayersClient";

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
  initial,
  onClose,
  onSave,
}: {
  sports: SportOpt[];
  divisionOptions: string[];
  programOptions: string[];
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
                autoFocus
                required
              />
            </div>

            {sports.length > 1 && (
              <div>
                <label className="label">Sport</label>
                <select
                  className="input"
                  value={form.sportId}
                  onChange={(e) => set("sportId", e.target.value)}
                >
                  {sports.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
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
              <input
                className="input"
                placeholder="24/25"
                value={form.season}
                onChange={(e) => set("season", e.target.value)}
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
              <input
                className="input"
                list="division-list"
                value={form.division}
                onChange={(e) => set("division", e.target.value)}
              />
              <datalist id="division-list">
                {divisionOptions.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="label">Program</label>
              <input
                className="input"
                list="program-list"
                value={form.program}
                onChange={(e) => set("program", e.target.value)}
              />
              <datalist id="program-list">
                {programOptions.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
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
                  placeholder="https://…"
                  value={form.ncaaUrl}
                  onChange={(e) => set("ncaaUrl", e.target.value)}
                />
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
