"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatNumber, formatUSD } from "@/lib/format";
import { DIVISIONS, PROGRAMS } from "@/lib/permissions";
import { PlayerModal, type PlayerForm } from "./PlayerModal";
import { ImportModal } from "./ImportModal";

export type PlayerRow = {
  id: string;
  name: string;
  university: string | null;
  season: string | null;
  division: string | null;
  program: string | null;
  scholarship: number | null;
  notes: string | null;
  legacyNumber: number | null;
  sportCode: string;
  sportId: string;
};

type SportOpt = { id: string; code: string; name: string };

export function PlayersClient({
  editable,
  sports,
  initialPlayers,
  facets,
}: {
  editable: boolean;
  sports: SportOpt[];
  initialPlayers: PlayerRow[];
  facets: { seasons: string[]; divisions: string[]; programs: string[] };
}) {
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerRow[]>(initialPlayers);
  const [q, setQ] = useState("");
  const [fSport, setFSport] = useState("");
  const [fSeason, setFSeason] = useState("");
  const [fDivision, setFDivision] = useState("");
  const [fProgram, setFProgram] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PlayerRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const seasonOptions = useMemo(
    () => [...facets.seasons].sort().reverse(),
    [facets.seasons]
  );
  const divisionOptions = useMemo(
    () => [...new Set([...DIVISIONS, ...facets.divisions])],
    [facets.divisions]
  );
  const programOptions = useMemo(
    () => [...new Set([...PROGRAMS, ...facets.programs])],
    [facets.programs]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return players.filter((p) => {
      if (fSport && p.sportCode !== fSport) return false;
      if (fSeason && p.season !== fSeason) return false;
      if (fDivision && p.division !== fDivision) return false;
      if (fProgram && p.program !== fProgram) return false;
      if (needle) {
        const hay = `${p.name} ${p.university ?? ""} ${p.notes ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [players, q, fSport, fSeason, fDivision, fProgram]);

  const totalScholarship = filtered.reduce((a, p) => a + (p.scholarship ?? 0), 0);

  const activeFilters = fSport || fSeason || fDivision || fProgram || q;

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(p: PlayerRow) {
    setEditing(p);
    setModalOpen(true);
  }

  async function handleSave(form: PlayerForm) {
    const payload = {
      sportId: form.sportId,
      name: form.name,
      university: form.university,
      season: form.season,
      division: form.division,
      program: form.program,
      scholarship: form.scholarship,
      notes: form.notes,
    };
    const res = editing
      ? await fetch(`/api/players/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch(`/api/players`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? "Failed to save");
    }
    const { player } = await res.json();
    const row: PlayerRow = {
      id: player.id,
      name: player.name,
      university: player.university,
      season: player.season,
      division: player.division,
      program: player.program,
      scholarship: player.scholarship,
      notes: player.notes,
      legacyNumber: player.legacyNumber,
      sportCode: player.sport.code,
      sportId: player.sportId,
    };
    setPlayers((prev) =>
      editing ? prev.map((p) => (p.id === row.id ? row : p)) : [row, ...prev]
    );
    setModalOpen(false);
    router.refresh();
  }

  async function handleDelete(p: PlayerRow) {
    if (!confirm(`Delete "${p.name}"? This action cannot be undone.`)) return;
    const res = await fetch(`/api/players/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Could not delete the player.");
      return;
    }
    setPlayers((prev) => prev.filter((x) => x.id !== p.id));
    router.refresh();
  }

  function exportCSV() {
    const headers = [
      "Name",
      "University",
      "Season",
      "Division",
      "Program",
      "Scholarship USD",
      "Sport",
      "Notes",
    ];
    const lines = filtered.map((p) =>
      [
        p.name,
        p.university ?? "",
        p.season ?? "",
        p.division ?? "",
        p.program ?? "",
        p.scholarship ?? "",
        p.sportCode,
        (p.notes ?? "").replace(/\n/g, " "),
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eture-players-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">Players</h1>
          <p className="text-sm text-muted">
            {formatNumber(filtered.length)} of {formatNumber(players.length)} ·{" "}
            <span className="text-accent">{formatUSD(totalScholarship)}</span> in scholarships
            {activeFilters ? " (filtered)" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-ghost">
            Export CSV
          </button>
          {editable && (
            <button onClick={() => setImportOpen(true)} className="btn-ghost">
              Import CSV
            </button>
          )}
          {editable && (
            <button onClick={openCreate} className="btn-primary">
              + Add player
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            className="input lg:col-span-2"
            placeholder="Search by name, university or notes…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {sports.length > 1 && (
            <select className="input" value={fSport} onChange={(e) => setFSport(e.target.value)}>
              <option value="">All sports</option>
              {sports.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <select className="input" value={fSeason} onChange={(e) => setFSeason(e.target.value)}>
            <option value="">All seasons</option>
            {seasonOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={fDivision}
            onChange={(e) => setFDivision(e.target.value)}
          >
            <option value="">All divisions</option>
            {divisionOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={fProgram}
            onChange={(e) => setFProgram(e.target.value)}
          >
            <option value="">All programs</option>
            {programOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {activeFilters && (
          <button
            onClick={() => {
              setQ("");
              setFSport("");
              setFSeason("");
              setFDivision("");
              setFProgram("");
            }}
            className="mt-3 text-xs text-muted hover:text-fg"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-600 bg-ink-900/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">University</th>
                <th className="px-4 py-3 font-medium">Season</th>
                <th className="px-4 py-3 font-medium">Division</th>
                <th className="px-4 py-3 font-medium">Program</th>
                <th className="px-4 py-3 text-right font-medium">Scholarship</th>
                {sports.length > 1 && <th className="px-4 py-3 font-medium">Sport</th>}
                {editable && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-ink-700/60 hover:bg-ink-800/40"
                >
                  <td className="px-4 py-3 font-medium text-fg">
                    {p.name}
                    {p.notes && (
                      <span className="ml-2 text-xs text-muted" title={p.notes}>
                        ✎
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-fg">{p.university ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{p.season ?? "—"}</td>
                  <td className="px-4 py-3">
                    {p.division ? (
                      <span className="badge bg-ink-700 text-fg">{p.division}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{p.program ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-accent">
                    {p.scholarship != null ? formatUSD(p.scholarship) : "—"}
                  </td>
                  {sports.length > 1 && (
                    <td className="px-4 py-3">
                      <span className="badge bg-ink-700 text-fg">{p.sportCode}</span>
                    </td>
                  )}
                  {editable && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="text-xs text-fg hover:text-fg"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Borrar
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-muted"
                  >
                    No players match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <PlayerModal
          sports={sports}
          divisionOptions={divisionOptions}
          programOptions={programOptions}
          initial={editing}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}

      {importOpen && (
        <ImportModal
          sports={sports}
          defaultSportId={sports[0]?.id ?? ""}
          onClose={() => setImportOpen(false)}
          onDone={() => {
            setImportOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
