"use client";

import { useEffect, useState } from "react";
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
};

type SportOpt = { id: string; code: string; name: string };

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
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
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
        className="card w-full max-w-lg p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            {initial ? "Editar jugador" : "Nuevo jugador"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
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
              <label className="label">Nombre *</label>
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
                <label className="label">Deporte</label>
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
              <label className="label">Universidad</label>
              <input
                className="input"
                value={form.university}
                onChange={(e) => set("university", e.target.value)}
              />
            </div>

            <div>
              <label className="label">Temporada</label>
              <input
                className="input"
                placeholder="24/25"
                value={form.season}
                onChange={(e) => set("season", e.target.value)}
              />
            </div>

            <div>
              <label className="label">Beca (USD)</label>
              <input
                className="input"
                inputMode="numeric"
                placeholder="120000"
                value={form.scholarship}
                onChange={(e) => set("scholarship", e.target.value)}
              />
            </div>

            <div>
              <label className="label">División</label>
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
              <label className="label">Programa</label>
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
              <label className="label">Notas</label>
              <textarea
                className="input min-h-[80px]"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear jugador"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
