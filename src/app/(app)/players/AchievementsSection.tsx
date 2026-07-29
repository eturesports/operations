"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { seasonSortKey } from "@/lib/format";

// College bios are written in prose — "broke the NJIT Division I record for
// shutouts with seven" — and that sentence is the achievement. So the text is
// free-form and only the season and a rough kind are structured, which is
// enough to sort and colour them without flattening what they say.
export type Achievement = {
  id: string;
  season: string | null;
  kind: string | null;
  text: string;
  source: string | null;
};

const KINDS = ["Award", "Record", "Academic", "Milestone", "Other"];

const KIND_STYLE: Record<string, string> = {
  Award: "bg-brand/20 text-brand",
  Record: "bg-accent/20 text-accent",
  Academic: "bg-sky-500/15 text-sky-300",
  Milestone: "bg-emerald-500/15 text-emerald-300",
};

export function AchievementsSection({
  playerId,
  editable,
}: {
  playerId: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [season, setSeason] = useState("");
  const [kind, setKind] = useState("");
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/players/${playerId}/achievements`);
        const j = await res.json();
        if (!cancelled && res.ok) setItems(j.achievements ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  const sorted = [...items].sort(
    (a, b) => seasonSortKey(b.season) - seasonSortKey(a.season)
  );

  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/players/${playerId}/achievements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, season, kind, source }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not save");
      setItems((prev) => [...prev, j.achievement]);
      setText("");
      setSeason("");
      setKind("");
      setSource("");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function save(id: string) {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/achievements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not save");
      setItems((prev) => prev.map((a) => (a.id === id ? j.achievement : a)));
      setEditing(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this achievement?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/achievements/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove");
      setItems((prev) => prev.filter((a) => a.id !== id));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-fg">Achievements</h3>
          <p className="text-xs text-muted">
            Records, honours and academic awards — what the numbers do not say.
          </p>
        </div>
        {editable && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="btn-ghost px-3 py-1.5 text-xs"
          >
            {open ? "Cancel" : "+ Add"}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-amber-400">{error}</p>}

      {open && editable && (
        <div className="card space-y-2 p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input
              className="input py-1.5 text-xs"
              placeholder="Season (2019)"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
            />
            <select
              className="input py-1.5 text-xs"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              aria-label="Kind"
            >
              <option value="">No category</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input
              className="input col-span-2 py-1.5 text-xs"
              placeholder="Source link (their college bio)"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
          <textarea
            className="input min-h-[90px] py-2 text-xs"
            placeholder="Paste it as their college wrote it — “broke the NJIT Division I record for shutouts with seven”"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={add}
              disabled={busy || !text.trim()}
              className="btn-primary px-3 py-1.5 text-xs"
            >
              {busy ? "Saving…" : "Save achievement"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : sorted.length === 0 ? (
        <p className="text-xs text-muted">
          Nothing recorded yet.{" "}
          {editable && "Their college bio is usually full of this."}
        </p>
      ) : (
        <ol className="space-y-2">
          {sorted.map((a) => (
            <li key={a.id} className="card p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                {a.season && (
                  <span className="font-display text-sm text-fg">{a.season}</span>
                )}
                {a.kind && (
                  <span className={`badge ${KIND_STYLE[a.kind] ?? "bg-ink-700 text-muted"}`}>
                    {a.kind}
                  </span>
                )}
                {a.source && (
                  <a
                    href={a.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-muted underline underline-offset-2"
                  >
                    source ↗
                  </a>
                )}
                {editable && (
                  <span className="ml-auto flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(a.id);
                        setDraft(a.text);
                      }}
                      className="btn-ghost px-2 py-0.5 text-[11px]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(a.id)}
                      disabled={busy}
                      className="btn-ghost px-2 py-0.5 text-[11px] text-amber-400"
                    >
                      Remove
                    </button>
                  </span>
                )}
              </div>

              {editing === a.id ? (
                <div className="space-y-2">
                  <textarea
                    className="input min-h-[90px] py-2 text-xs"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="btn-ghost px-3 py-1 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => save(a.id)}
                      disabled={busy}
                      className="btn-primary px-3 py-1 text-xs"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-line text-xs leading-relaxed text-muted">{a.text}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
