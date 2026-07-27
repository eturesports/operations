"use client";

import { useRef, useState } from "react";

export type ShareablePlayer = {
  name: string;
  university: string | null;
  season: string | null;
  division: string | null;
  program: string | null;
  position: string | null;
  nationality: string | null;
  previousClub: string | null;
  notes: string | null;
  profileImageUrl: string | null;
  actionImageUrl: string | null;
  ncaaUrl: string | null;
  instagramUrl: string | null;
};

type Form = Record<keyof ShareablePlayer, string>;

const FIELDS: { key: keyof ShareablePlayer; label: string; placeholder?: string }[] = [
  { key: "name", label: "Full name" },
  { key: "university", label: "University" },
  { key: "season", label: "Season", placeholder: "24/25" },
  { key: "division", label: "Division", placeholder: "Division I" },
  { key: "program", label: "Program" },
  { key: "position", label: "Position", placeholder: "GK / DF / MF / FW" },
  { key: "nationality", label: "Nationality" },
  { key: "previousClub", label: "Previous club" },
];

function ImageField({
  label,
  value,
  onChange,
  token,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  token: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/share/${token}/upload`, { method: "POST", body: fd });
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
            placeholder="Paste an image URL, or upload →"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <input
              ref={ref}
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
              onClick={() => ref.current?.click()}
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

export function ShareForm({
  token,
  player,
}: {
  token: string;
  player: ShareablePlayer;
}) {
  const [form, setForm] = useState<Form>(() => {
    const f = {} as Form;
    for (const k of Object.keys(player) as (keyof ShareablePlayer)[]) {
      f[k] = player[k] ?? "";
    }
    return f;
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof ShareablePlayer, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name can't be empty.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/share/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Could not save");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          Saved. Thank you — your changes are live.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.key === "name" ? "sm:col-span-2" : ""}>
            <label className="label">{f.label}</label>
            <input
              className="input"
              placeholder={f.placeholder}
              value={form[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-ink-600 pt-5 sm:grid-cols-2">
        <ImageField
          label="Profile photo"
          value={form.profileImageUrl}
          onChange={(v) => set("profileImageUrl", v)}
          token={token}
        />
        <ImageField
          label="Action photo"
          value={form.actionImageUrl}
          onChange={(v) => set("actionImageUrl", v)}
          token={token}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">NCAA profile link</label>
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

      <div>
        <label className="label">Notes</label>
        <textarea
          className="input min-h-[80px]"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>

      <button type="submit" disabled={busy} className="btn-primary w-full py-3">
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
