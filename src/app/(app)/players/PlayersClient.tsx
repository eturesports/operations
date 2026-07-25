"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatNumber, formatUSD } from "@/lib/format";
import { DIVISIONS, PROGRAMS } from "@/lib/permissions";
import { PlayerModal, type PlayerForm } from "./PlayerModal";
import { ImportModal } from "./ImportModal";
import { BulkEditModal, type BulkPatch } from "./BulkEditModal";
import { PlayerDetail } from "./PlayerDetail";

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
  profileImageUrl: string | null;
  actionImageUrl: string | null;
  ncaaUrl: string | null;
  instagramUrl: string | null;
  nationality: string | null;
  position: string | null;
  previousClub: string | null;
  active: boolean;
  graduated: boolean;
  graduationYear: number | null;
  // set when the player has a profile marked as their current NCAA roster
  activeProfile: {
    university: string;
    season: string | null;
    goals: number | null;
    assists: number | null;
  } | null;
};

type SportOpt = { id: string; code: string; name: string };

export function PlayersClient({
  editable,
  isAdmin,
  sports,
  initialPlayers,
  facets,
}: {
  editable: boolean;
  isAdmin: boolean;
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
  const [fActiveOnly, setFActiveOnly] = useState(false);
  const [fGraduated, setFGraduated] = useState<"" | "yes" | "no">("");
  const [fStatus, setFStatus] = useState<"" | "active" | "inactive">("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PlayerRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [detail, setDetail] = useState<PlayerRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const seasonOptions = useMemo(() => [...facets.seasons].sort().reverse(), [facets.seasons]);
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
      if (fActiveOnly && !p.activeProfile) return false;
      if (fGraduated === "yes" && !p.graduated) return false;
      if (fGraduated === "no" && p.graduated) return false;
      if (fStatus === "active" && !p.active) return false;
      if (fStatus === "inactive" && p.active) return false;
      if (needle) {
        const hay = `${p.name} ${p.university ?? ""} ${p.notes ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [players, q, fSport, fSeason, fDivision, fProgram, fActiveOnly, fGraduated, fStatus]);

  const totalScholarship = filtered.reduce((a, p) => a + (p.scholarship ?? 0), 0);
  const activeFilters =
    fSport || fSeason || fDivision || fProgram || fActiveOnly || fGraduated || fStatus || q;
  const activeNcaaCount = useMemo(
    () => players.filter((p) => p.activeProfile).length,
    [players]
  );

  const filteredIds = useMemo(() => filtered.map((p) => p.id), [filtered]);
  const selectedCount = selected.size;
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });
  }
  function clearSelection() {
    setSelected(new Set());
  }

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
      profileImageUrl: form.profileImageUrl,
      actionImageUrl: form.actionImageUrl,
      ncaaUrl: form.ncaaUrl,
      instagramUrl: form.instagramUrl,
      nationality: form.nationality,
      position: form.position,
      previousClub: form.previousClub,
      active: form.active,
      graduated: form.graduated,
      graduationYear: form.graduationYear,
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
      profileImageUrl: player.profileImageUrl,
      actionImageUrl: player.actionImageUrl,
      ncaaUrl: player.ncaaUrl,
      instagramUrl: player.instagramUrl,
      nationality: player.nationality,
      position: player.position,
      previousClub: player.previousClub,
      active: player.active,
      graduated: player.graduated,
      graduationYear: player.graduationYear,
      // profiles aren't touched by this form; keep whatever the row already had
      activeProfile: editing?.activeProfile ?? null,
    };
    setPlayers((prev) => (editing ? prev.map((p) => (p.id === row.id ? row : p)) : [row, ...prev]));
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
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(p.id);
      return n;
    });
    router.refresh();
  }

  async function bulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected player${ids.length === 1 ? "" : "s"}? This cannot be undone.`))
      return;
    setBusy(true);
    try {
      const res = await fetch("/api/players/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to delete");
      }
      const idSet = new Set(ids);
      setPlayers((prev) => prev.filter((p) => !idSet.has(p.id)));
      clearSelection();
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  async function bulkUpdate(patch: BulkPatch) {
    const ids = [...selected];
    const res = await fetch("/api/players/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", ids, patch }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? "Failed to update");
    }
    const idSet = new Set(ids);
    setPlayers((prev) =>
      prev.map((p) => (idSet.has(p.id) ? { ...p, ...patch } : p))
    );
    setBulkEditOpen(false);
    clearSelection();
    router.refresh();
  }

  async function deleteAll() {
    const answer = prompt(
      `This deletes ALL ${players.length} players permanently. Type DELETE to confirm.`
    );
    if (answer !== "DELETE") return;
    setBusy(true);
    try {
      const res = await fetch("/api/players/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", all: true }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to delete");
      }
      setPlayers([]);
      clearSelection();
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  function exportCSV() {
    const headers = ["Name", "University", "Season", "Division", "Program", "Scholarship USD", "Sport", "Position", "Nationality", "Previous club", "Graduated", "Graduation year", "Status", "Notes"];
    const rows = (selectedCount > 0 ? filtered.filter((p) => selected.has(p.id)) : filtered);
    const lines = rows.map((p) =>
      [p.name, p.university ?? "", p.season ?? "", p.division ?? "", p.program ?? "", p.scholarship ?? "", p.sportCode, p.position ?? "", p.nationality ?? "", p.previousClub ?? "", p.graduated ? "Yes" : "No", p.graduationYear ?? "", p.active ? "Active" : "Inactive", (p.notes ?? "").replace(/\n/g, " ")]
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

  const colCount = 6 + (sports.length > 1 ? 1 : 0) + (editable ? 2 : 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg sm:text-3xl">Players</h1>
          <p className="text-sm text-muted">
            {formatNumber(filtered.length)} of {formatNumber(players.length)} ·{" "}
            <span className="text-accent">{formatUSD(totalScholarship)}</span> in scholarships
            {activeFilters ? " (filtered)" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCSV} className="btn-ghost">
            Export CSV
          </button>
          {editable && (
            <button onClick={() => setImportOpen(true)} className="btn-ghost">
              Import CSV
            </button>
          )}
          {isAdmin && players.length > 0 && (
            <button onClick={deleteAll} disabled={busy} className="btn-danger">
              Delete all
            </button>
          )}
          {editable && (
            <button onClick={openCreate} className="btn-primary">
              + Add player
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
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
          <select className="input" value={fDivision} onChange={(e) => setFDivision(e.target.value)}>
            <option value="">All divisions</option>
            {divisionOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select className="input" value={fProgram} onChange={(e) => setFProgram(e.target.value)}>
            <option value="">All programs</option>
            {programOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={fGraduated}
            onChange={(e) => setFGraduated(e.target.value as "" | "yes" | "no")}
          >
            <option value="">Graduated: all</option>
            <option value="yes">Graduated</option>
            <option value="no">Not graduated</option>
          </select>
          <select
            className="input"
            value={fStatus}
            onChange={(e) => setFStatus(e.target.value as "" | "active" | "inactive")}
          >
            <option value="">Status: all</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setFActiveOnly((v) => !v)}
            aria-pressed={fActiveOnly}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              fActiveOnly
                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
                : "border-ink-600 text-muted hover:text-fg"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Playing now ({activeNcaaCount})
          </button>
          {activeFilters && (
            <button
              onClick={() => {
                setQ("");
                setFSport("");
                setFSeason("");
                setFDivision("");
                setFProgram("");
                setFActiveOnly(false);
                setFGraduated("");
                setFStatus("");
              }}
              className="text-xs text-muted hover:text-fg"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {editable && selectedCount > 0 && (
        <div className="glass sticky top-20 z-20 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
          <span className="text-sm font-medium text-fg">
            {selectedCount} selected
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button onClick={() => setBulkEditOpen(true)} className="btn-ghost px-3 py-1.5 text-xs">
              Bulk edit
            </button>
            <button onClick={bulkDelete} disabled={busy} className="btn-danger px-3 py-1.5 text-xs">
              Delete selected
            </button>
            <button onClick={clearSelection} className="btn-ghost px-3 py-1.5 text-xs">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-600 bg-ink-900/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                {editable && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand"
                      checked={allFilteredSelected}
                      ref={(el) => {
                        if (el)
                          el.indeterminate =
                            !allFilteredSelected && filteredIds.some((id) => selected.has(id));
                      }}
                      onChange={toggleAllFiltered}
                      aria-label="Select all"
                    />
                  </th>
                )}
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
              {filtered.map((p) => {
                const isSel = selected.has(p.id);
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-ink-700/60 hover:bg-ink-800/40 ${
                      isSel ? "bg-brand/5" : ""
                    }`}
                  >
                    {editable && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-brand"
                          checked={isSel}
                          onChange={() => toggleOne(p.id)}
                          aria-label={`Select ${p.name}`}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-fg">
                      <button
                        onClick={() => setDetail(p)}
                        className="flex items-center gap-2.5 text-left hover:text-brand"
                        title="View profile"
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-ink-600 bg-ink-800 text-[10px] text-muted">
                          {p.profileImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.profileImageUrl}
                              alt=""
                              width={32}
                              height={32}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            p.name.slice(0, 1).toUpperCase()
                          )}
                        </span>
                        <span>
                          {p.name}
                          {p.activeProfile && (
                            <span
                              className="ml-1.5 inline-block h-2 w-2 rounded-full bg-emerald-400 align-middle"
                              title={`Playing now at ${p.activeProfile.university}`}
                              aria-label={`Currently playing at ${p.activeProfile.university}`}
                            />
                          )}
                          {p.graduated && (
                            <span
                              className="ml-1.5 text-xs"
                              title={
                                p.graduationYear
                                  ? `Graduated ${p.graduationYear}`
                                  : "Graduated"
                              }
                              aria-label={
                                p.graduationYear
                                  ? `Graduated in ${p.graduationYear}`
                                  : "Graduated"
                              }
                            >
                              🎓
                            </span>
                          )}
                          {!p.active && (
                            <span className="ml-1.5 badge bg-ink-700 text-muted">Inactive</span>
                          )}
                          {p.notes && (
                            <span className="ml-1.5 text-xs text-muted" title={p.notes}>
                              ✎
                            </span>
                          )}
                        </span>
                      </button>
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
                        <div className="flex justify-end gap-3">
                          <button onClick={() => openEdit(p)} className="text-xs text-fg hover:text-brand">
                            Edit
                          </button>
                          <button onClick={() => handleDelete(p)} className="text-xs text-red-400 hover:text-red-300">
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="px-4 py-10 text-center text-sm text-muted">
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
          seasonOptions={seasonOptions}
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

      {bulkEditOpen && (
        <BulkEditModal
          count={selectedCount}
          divisionOptions={divisionOptions}
          programOptions={programOptions}
          onClose={() => setBulkEditOpen(false)}
          onApply={bulkUpdate}
        />
      )}

      {detail && (
        <PlayerDetail
          player={detail}
          editable={editable}
          seasonOptions={seasonOptions}
          onClose={() => setDetail(null)}
          onEdit={() => {
            const p = detail;
            setDetail(null);
            openEdit(p);
          }}
        />
      )}
    </div>
  );
}
