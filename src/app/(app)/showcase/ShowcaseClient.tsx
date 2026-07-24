"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/format";
import { StatCard } from "@/components/StatCard";

export type ShowcaseItem = {
  id: string;
  year: number;
  name: string;
  logoUrl: string | null;
  order: number;
};

type Editing = { id?: string; year: number; name: string; logoUrl: string } | null;

export function ShowcaseClient({
  editable,
  items: initial,
}: {
  editable: boolean;
  items: ShowcaseItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<ShowcaseItem[]>(initial);
  const [editing, setEditing] = useState<Editing>(null);

  const years = useMemo(
    () => [...new Set(items.map((i) => i.year))].sort((a, b) => b - a),
    [items]
  );
  const byYear = useMemo(() => {
    const m = new Map<number, ShowcaseItem[]>();
    for (const it of items) {
      const arr = m.get(it.year) ?? [];
      arr.push(it);
      m.set(it.year, arr);
    }
    return m;
  }, [items]);

  const uniqueCount = useMemo(
    () => new Set(items.map((i) => i.name.trim().toLowerCase())).size,
    [items]
  );

  async function save(e: Editing) {
    if (!e) return;
    const isEdit = !!e.id;
    const res = await fetch(isEdit ? `/api/showcase/${e.id}` : "/api/showcase", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: e.year, name: e.name, logoUrl: e.logoUrl }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "Failed to save");
    const item = j.item as ShowcaseItem;
    setItems((prev) =>
      isEdit ? prev.map((x) => (x.id === item.id ? item : x)) : [...prev, item]
    );
    setEditing(null);
    router.refresh();
  }

  async function remove(it: ShowcaseItem) {
    if (!confirm(`Remove "${it.name}" from Showcase ${it.year}?`)) return;
    const res = await fetch(`/api/showcase/${it.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Could not remove.");
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== it.id));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg sm:text-3xl">Showcase history</h1>
          <p className="text-sm text-muted">
            Universities that attended the annual Eture showcase.
          </p>
        </div>
        {editable && (
          <button
            onClick={() =>
              setEditing({ year: years[0] ?? new Date().getFullYear(), name: "", logoUrl: "" })
            }
            className="btn-primary"
          >
            + Add university
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total attendances" value={formatNumber(items.length)} />
        <StatCard label="Unique universities" value={formatNumber(uniqueCount)} />
        <StatCard
          label="Editions"
          value={years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "—"}
          sub={`${years.length} showcases`}
        />
      </div>

      {years.map((year) => {
        const list = byYear.get(year) ?? [];
        return (
          <section key={year} className="card p-5">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="font-display text-2xl text-fg">Showcase {year}</h2>
              <span className="badge bg-ink-700 text-muted">{list.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {list.map((it) => (
                <div
                  key={it.id}
                  className="group flex items-center gap-2 rounded-full border border-ink-600 bg-ink-800/60 py-1 pl-1.5 pr-3 text-sm text-fg"
                >
                  <span className="grid h-6 w-6 place-items-center overflow-hidden rounded-full bg-ink-700 text-[9px] text-muted">
                    {it.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.logoUrl} alt="" className="h-full w-full object-contain" />
                    ) : (
                      it.name.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span>{it.name}</span>
                  {editable && (
                    <span className="ml-1 hidden gap-1.5 group-hover:inline-flex">
                      <button
                        onClick={() =>
                          setEditing({
                            id: it.id,
                            year: it.year,
                            name: it.name,
                            logoUrl: it.logoUrl ?? "",
                          })
                        }
                        className="text-xs text-muted hover:text-fg"
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => remove(it)}
                        className="text-xs text-red-400 hover:text-red-300"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </div>
              ))}
              {list.length === 0 && (
                <p className="text-sm text-muted">No universities recorded.</p>
              )}
            </div>
          </section>
        );
      })}

      {items.length === 0 && (
        <div className="card p-8 text-center text-muted">No showcase data yet.</div>
      )}

      {editing && (
        <EditModal
          editing={editing}
          years={years}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function EditModal({
  editing,
  years,
  onChange,
  onClose,
  onSave,
}: {
  editing: NonNullable<Editing>;
  years: number[];
  onChange: (e: Editing) => void;
  onClose: () => void;
  onSave: (e: Editing) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const yearChoices = [...new Set([...years, editing.year, new Date().getFullYear() + 1])].sort(
    (a, b) => b - a
  );

  async function submit() {
    if (!editing.name.trim()) {
      setError("University name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(editing);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={onClose}
    >
      <div className="card w-full max-w-md p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-fg">
            {editing.id ? "Edit university" : "Add university"}
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
        <div className="space-y-4">
          <div>
            <label className="label">Showcase year</label>
            <input
              className="input"
              list="year-list"
              value={editing.year}
              onChange={(e) => onChange({ ...editing, year: parseInt(e.target.value || "0", 10) })}
            />
            <datalist id="year-list">
              {yearChoices.map((y) => (
                <option key={y} value={y} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">University name</label>
            <input
              className="input"
              value={editing.name}
              onChange={(e) => onChange({ ...editing, name: e.target.value })}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Logo URL (optional)</label>
            <input
              className="input"
              placeholder="https://…"
              value={editing.logoUrl}
              onChange={(e) => onChange({ ...editing, logoUrl: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button onClick={submit} disabled={busy} className="btn-primary">
            {busy ? "Saving…" : editing.id ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
