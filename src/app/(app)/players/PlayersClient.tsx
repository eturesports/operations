"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePagedList } from "@/components/usePagedList";
import { formatNumber, formatUSD, seasonSortKey } from "@/lib/format";
import { DIVISIONS, PROGRAMS } from "@/lib/permissions";
import { PlayerModal, type PlayerForm } from "./PlayerModal";
import { ImportModal } from "./ImportModal";
import { BulkEditModal, type BulkPatch } from "./BulkEditModal";
import { PlayerDetail } from "./PlayerDetail";
import { Select } from "@/components/Select";
import { MultiSelect } from "@/components/MultiSelect";
import { PlayerCard } from "./PlayerCard";
import { FilterStats } from "./FilterStats";

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
  career?: {
    minutes: number;
    goals: number;
    assists: number;
    matchesPlayed: number;
    colleges: number;
  } | null;
  instagramUrl: string | null;
  nationality: string | null;
  position: string | null;
  previousClub: string | null;
  active: boolean;
  graduated: boolean;
  graduationYear: number | null;
  nationalChampion: boolean;
  fullRide: boolean;
  /** drafted once, at the end of the college years — a fact about the person */
  mlsDraftYear: number | null;
  mlsDraftClub: string | null;
  mlsDraftRound: number | null;
  mlsDraftPick: number | null;
  /** the human being behind this operation; records sharing it are one career */
  personId: string | null;
  // set when the player has a profile marked as their current NCAA roster
  activeProfile: {
    university: string;
    season: string | null;
    goals: number | null;
    assists: number | null;
    matchesPlayed: number | null;
    minutes: number | null;
    saves: number | null;
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
  // Several values at once, because the questions worth asking are
  // combinations: how much of the database competes in D1 *and* D2, what the
  // last three seasons look like together.
  const [fSeason, setFSeason] = useState<string[]>([]);
  const [fDivision, setFDivision] = useState<string[]>([]);
  const [fProgram, setFProgram] = useState<string[]>([]);
  const [fActiveOnly, setFActiveOnly] = useState(false);
  const [fFullRide, setFFullRide] = useState(false);
  // Inline editing: which cell is open, and the value being typed.
  type CellField = "name" | "university" | "season" | "division" | "program" | "scholarship";
  const [editingCell, setEditingCell] = useState<
    { id: string; field: CellField; value: string } | null
  >(null);
  const [savingCell, setSavingCell] = useState(false);
  const [fGraduated, setFGraduated] = useState<"" | "yes" | "no">("");
  const [fStatus, setFStatus] = useState<"" | "active" | "inactive">("");

  // Column sorting. Season sorts chronologically, scholarship numerically,
  // everything else alphabetically; blanks always sink to the bottom.
  type SortKey = "name" | "university" | "season" | "division" | "program" | "scholarship";
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      // numbers and seasons read best newest/highest first; text A→Z
      setSortAsc(key !== "scholarship" && key !== "season");
    }
  }

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PlayerRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [statsRun, setStatsRun] = useState<{
    busy: boolean;
    done: number;
    total: number;
    ok: number;
    note: string | null;
  }>({ busy: false, done: 0, total: 0, ok: 0, note: null });
  const [detail, setDetail] = useState<PlayerRow | null>(null);
  // which record is being unpicked from a shared person, if any
  const [splitting, setSplitting] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"table" | "gallery">("table");

  // Remember the chosen view between visits. With no choice on record, the
  // screen decides: a nine-column table on a phone is a table you read
  // through a letterbox, so a phone starts on the cards.
  useEffect(() => {
    const saved = localStorage.getItem("eture-players-view");
    if (saved === "gallery" || saved === "table") setView(saved);
    else if (window.matchMedia("(max-width: 640px)").matches) setView("gallery");
  }, []);
  function chooseView(v: "table" | "gallery") {
    setView(v);
    localStorage.setItem("eture-players-view", v);
  }

  const seasonOptions = useMemo(() => [...facets.seasons].sort().reverse(), [facets.seasons]);
  const divisionOptions = useMemo(
    () => [...new Set([...DIVISIONS, ...facets.divisions])],
    [facets.divisions]
  );
  const programOptions = useMemo(
    () => [...new Set([...PROGRAMS, ...facets.programs])],
    [facets.programs]
  );

  // The field keeps up with the typing; the list is allowed to arrive a beat
  // later. Without this, every character re-filters and re-sorts the whole
  // database before the letter appears, and the search box feels broken on a
  // phone even though nothing is wrong.
  const deferredQ = useDeferredValue(q);

  const filtered = useMemo(() => {
    const needle = deferredQ.trim().toLowerCase();
    const rows = players.filter((p) => {
      if (fSport && p.sportCode !== fSport) return false;
      if (fSeason.length && !fSeason.includes(p.season ?? "")) return false;
      if (fDivision.length && !fDivision.includes(p.division ?? "")) return false;
      if (fProgram.length && !fProgram.includes(p.program ?? "")) return false;
      if (fActiveOnly && !p.activeProfile) return false;
      if (fFullRide && !p.fullRide) return false;
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

    const dir = sortAsc ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      // empty cells always sit at the bottom, whichever way we're sorting
      const aEmpty = va == null || va === "";
      const bEmpty = vb == null || vb === "";
      if (aEmpty && bEmpty) return a.name.localeCompare(b.name);
      if (aEmpty) return 1;
      if (bEmpty) return -1;

      let cmp: number;
      if (sortKey === "scholarship") {
        cmp = (va as number) - (vb as number);
      } else if (sortKey === "season") {
        cmp = seasonSortKey(va as string) - seasonSortKey(vb as string);
      } else {
        cmp = String(va).localeCompare(String(vb), undefined, { sensitivity: "base" });
      }
      // stable, predictable tie-break
      if (cmp === 0) cmp = a.name.localeCompare(b.name);
      return cmp * dir;
    });
  }, [
    players, deferredQ, fSport, fSeason, fDivision, fProgram, fActiveOnly, fFullRide, fGraduated,
    fStatus, sortKey, sortAsc,
  ]);

  // Everything below counts, exports and selects the whole filtered list;
  // only the rows on screen are paged in as you scroll.
  const { count: shownCount, sentinel, done: allShown } = usePagedList(filtered.length);
  const visible = useMemo(() => filtered.slice(0, shownCount), [filtered, shownCount]);

  const totalScholarship = filtered.reduce((a, p) => a + (p.scholarship ?? 0), 0);
  const activeFilters =
    fSport ||
    fSeason.length ||
    fDivision.length ||
    fProgram.length ||
    fActiveOnly ||
    fFullRide ||
    fGraduated ||
    fStatus ||
    q;
  const fullRideCount = useMemo(() => players.filter((p) => p.fullRide).length, [players]);
  const activeNcaaCount = useMemo(
    () => players.filter((p) => p.activeProfile).length,
    [players]
  );

  // How many records each person has, so the list can show at a glance who
  // moved around — they are one person across several operations.
  const recordsByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of players) {
      const k = p.name.trim().toLowerCase();
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [players]);

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

  // Inline editing: double-click a cell, type, Enter saves / Escape cancels.
  async function commitCell() {
    if (!editingCell) return;
    const { id, field, value } = editingCell;
    const target = players.find((p) => p.id === id);
    if (!target) {
      setEditingCell(null);
      return;
    }

    let next: string | number | null;
    if (field === "scholarship") {
      const digits = value.replace(/[^\d-]/g, "");
      next = digits === "" ? null : parseInt(digits, 10);
    } else {
      const trimmed = value.trim();
      if (field === "name" && !trimmed) {
        setEditingCell(null); // a player must keep a name
        return;
      }
      next = trimmed === "" ? null : trimmed;
    }

    if (next === (target[field] ?? null)) {
      setEditingCell(null);
      return;
    }

    setSavingCell(true);
    try {
      const res = await fetch(`/api/players/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Could not save");
      // the server normalizes (e.g. name casing) — trust what it returns
      const saved = j.player?.[field] ?? next;
      setPlayers((prev) =>
        prev.map((p) => (p.id === id ? { ...p, [field]: saved } : p))
      );
      setEditingCell(null);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSavingCell(false);
    }
  }

  // Clickable column header that sorts by that column.
  function sortableTh(key: SortKey, label: string, right = false) {
    const active = sortKey === key;
    return (
      <th
        key={key}
        aria-sort={active ? (sortAsc ? "ascending" : "descending") : "none"}
        className={`px-4 py-3 font-medium ${right ? "text-right" : ""}`}
      >
        <button
          onClick={() => toggleSort(key)}
          className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-fg ${
            active ? "text-fg" : ""
          }`}
          title={`Sort by ${label}`}
        >
          {label}
          <span className={active ? "text-brand" : "opacity-30"}>
            {active ? (sortAsc ? "↑" : "↓") : "↕"}
          </span>
        </button>
      </th>
    );
  }

  // Renders a table cell that turns into an input on double-click (editors).
  function cell(
    p: PlayerRow,
    field: Exclude<CellField, "scholarship">,
    className = "",
    opts: { list?: string; render?: (v: string | null) => React.ReactNode } = {}
  ) {
    const value = p[field];
    const isEditing = editingCell?.id === p.id && editingCell.field === field;
    return (
      <td
        className={`px-4 py-3 ${className} ${editable && !isEditing ? "cursor-pointer" : ""}`}
        onDoubleClick={() =>
          editable && setEditingCell({ id: p.id, field, value: value ?? "" })
        }
        title={editable && !isEditing ? "Double-click to edit" : undefined}
      >
        {isEditing ? (
          <>
            <input
              autoFocus
              disabled={savingCell}
              list={opts.list}
              className="input w-full min-w-[7rem] px-2 py-1 text-sm"
              value={editingCell.value}
              onChange={(e) =>
                setEditingCell({ id: p.id, field, value: e.target.value })
              }
              onBlur={commitCell}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitCell();
                } else if (e.key === "Escape") {
                  setEditingCell(null);
                }
              }}
              aria-label={`${field} for ${p.name}`}
            />
          </>
        ) : opts.render ? (
          opts.render(value)
        ) : (
          (value ?? "—")
        )}
      </td>
    );
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
    // Division, the amount and the full ride belong to the college profile.
    // On an existing player the form only *shows* them — there is no control
    // to change them here — so sending them back can do one thing only:
    // overwrite what the profile just set with the copy this form loaded when
    // it opened. That is what put Mario Vazquez's scholarship back to
    // $3,200,000 fifteen seconds after it was corrected to $320,000.
    //
    // A new player has no profile yet, so there they are typed here and the
    // profile created underneath carries them from the start.
    const owned = editing
      ? {}
      : {
          division: form.division,
          scholarship: form.scholarship,
          fullRide: form.fullRide,
        };

    const payload = {
      sportId: form.sportId,
      name: form.name,
      university: form.university,
      season: form.season,
      program: form.program,
      notes: form.notes,
      profileImageUrl: form.profileImageUrl,
      actionImageUrl: form.actionImageUrl,
      ncaaUrl: form.ncaaUrl,
      instagramUrl: form.instagramUrl,
      nationality: form.nationality,
      position: form.position,
      previousClub: form.previousClub,
      active: form.active,
      playingNow: form.playingNow,
      graduated: form.graduated,
      graduationYear: form.graduationYear,
      nationalChampion: form.nationalChampion,
      mlsDraftYear: form.mlsDraftYear,
      mlsDraftClub: form.mlsDraftClub,
      mlsDraftRound: form.mlsDraftRound,
      mlsDraftPick: form.mlsDraftPick,
      ...owned,
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
    const { player, warning, syncedTo, syncedFields } = await res.json();
    const row: PlayerRow = {
      id: player.id,
      personId: player.personId ?? null,
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
      nationalChampion: player.nationalChampion,
      fullRide: player.fullRide,
      mlsDraftYear: player.mlsDraftYear,
      mlsDraftClub: player.mlsDraftClub,
      mlsDraftRound: player.mlsDraftRound,
      mlsDraftPick: player.mlsDraftPick,
      // reflect the playing-now toggle immediately; router.refresh() then
      // replaces this with the authoritative profile from the server
      activeProfile: form.playingNow
        ? (editing?.activeProfile ?? {
            university: player.university ?? "",
            season: player.season,
            goals: null,
            assists: null,
            matchesPlayed: null,
            minutes: null,
            saves: null,
          })
        : null,
    };
    setPlayers((prev) => (editing ? prev.map((p) => (p.id === row.id ? row : p)) : [row, ...prev]));
    setModalOpen(false);
    if (warning) alert(warning);
    // Editing one record can change several: say so rather than letting the
    // editor discover it later.
    if (syncedTo > 0) {
      setStatsRun({
        busy: false,
        done: 0,
        total: 0,
        ok: 0,
        note: `${syncedFields.join(", ")} also applied to ${syncedTo} other record${
          syncedTo === 1 ? "" : "s"
        } of ${row.name}.`,
      });
    }
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

  // Two people can share a name, and the career path was built from names —
  // so it sometimes joins strangers. This unpicks one record from the rest.
  async function handleSplitPerson(p: PlayerRow) {
    const ok = confirm(
      `Separate this record?\n\n${p.name} — ${p.university ?? "no university"}${
        p.season ? ` (${p.season})` : ""
      }\n\nIt becomes its own person, so it no longer shares a career or the ` +
        `fields that follow a person (nationality, position, Instagram, graduation, MLS draft).`
    );
    if (!ok) return;

    setSplitting(p.id);
    try {
      const res = await fetch(`/api/players/${p.id}/person`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        personId?: string;
        error?: string;
      };
      if (!res.ok || !data.personId) {
        alert(data.error ?? "Could not separate this record.");
        return;
      }
      // Only this record moves; every other record keeps the person it had.
      setPlayers((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, personId: data.personId! } : x))
      );
      setDetail((d) => (d && d.id === p.id ? { ...d, personId: data.personId! } : d));
      router.refresh();
    } finally {
      setSplitting(null);
    }
  }

  // Pulls each selected player's figures from their college roster page. The
  // server allows itself up to a minute per player, so this runs a few at a
  // time and reports as it goes rather than freezing behind one request.
  async function bulkRefreshStats() {
    await refreshStatsFor([...selected]);
  }

  // From the toolbar: whoever the filters are showing, since that is the
  // selection the screen is already about.
  async function refreshFilteredStats() {
    const ids = filtered.filter((p) => p.ncaaUrl).map((p) => p.id);
    if (ids.length === 0) {
      alert("None of these players has a college link yet. Add links first.");
      return;
    }
    if (
      ids.length > 20 &&
      !confirm(
        `Pull stats for ${ids.length} players? Each one is read from their college site, so this takes a few minutes.`
      )
    ) {
      return;
    }
    await refreshStatsFor(ids);
  }

  async function refreshStatsFor(ids: string[]) {
    if (ids.length === 0) return;
    setStatsRun({ busy: true, done: 0, total: ids.length, ok: 0, note: null });

    let done = 0;
    let ok = 0;
    let photos = 0;
    const CONCURRENCY = 3;

    async function worker(queue: string[]) {
      for (const id of queue) {
        try {
          const res = await fetch(`/api/players/${id}/refresh-stats`, { method: "POST" });
          const j = await res.json().catch(() => ({}));
          if (res.ok && j.matched) ok += 1;
          if (j.photoAdded) photos += 1;
        } catch {
          // A player we could not reach is reported in the count, not thrown.
        }
        done += 1;
        setStatsRun((prev) => ({ ...prev, done, ok }));
      }
    }

    const lanes: string[][] = Array.from({ length: CONCURRENCY }, () => []);
    ids.forEach((id, i) => lanes[i % CONCURRENCY].push(id));
    await Promise.all(lanes.map(worker));

    setStatsRun({
      busy: false,
      done,
      total: ids.length,
      ok,
      note:
        `${ok} of ${ids.length} updated` +
        (photos > 0 ? ` · ${photos} photo${photos === 1 ? "" : "s"} added` : "") +
        (ok < ids.length ? " — the rest have no usable college link yet." : "."),
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
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error ?? "Failed to update");

    const idSet = new Set(ids);
    // playingNow isn't a player column; reflect it on the row's activeProfile
    const { playingNow, ...columns } = patch;
    setPlayers((prev) =>
      prev.map((p) => {
        if (!idSet.has(p.id)) return p;
        const next = { ...p, ...columns };
        if (playingNow === false) next.activeProfile = null;
        else if (playingNow === true && !next.activeProfile && next.university) {
          next.activeProfile = {
            university: next.university,
            season: next.season,
            goals: null,
            assists: null,
            matchesPlayed: null,
            minutes: null,
            saves: null,
          };
        }
        return next;
      })
    );
    setBulkEditOpen(false);
    clearSelection();
    if (j.playingSkipped) {
      alert(
        `${j.playingSkipped} player${j.playingSkipped === 1 ? " was" : "s were"} skipped: add a university before marking them as playing.`
      );
    }
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
    const headers = ["Name", "University", "Season", "Division", "Program", "Scholarship USD", "Sport", "Position", "Nationality", "Previous club", "Graduated", "Graduation year", "National champion", "Full ride", "Status", "Notes"];
    const rows = (selectedCount > 0 ? filtered.filter((p) => selected.has(p.id)) : filtered);
    const lines = rows.map((p) =>
      [p.name, p.university ?? "", p.season ?? "", p.division ?? "", p.program ?? "", p.scholarship ?? "", p.sportCode, p.position ?? "", p.nationality ?? "", p.previousClub ?? "", p.graduated ? "Yes" : "No", p.graduationYear ?? "", p.nationalChampion ? "Yes" : "No", p.fullRide ? "Yes" : "No", p.active ? "Active" : "Inactive", (p.notes ?? "").replace(/\n/g, " ")]
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
          {statsRun.note && !statsRun.busy && (
            <p className="mt-1 text-xs text-muted">{statsRun.note}</p>
          )}
        </div>
        {/* Two even columns on a phone, where five buttons of different
            widths otherwise wrap into a ragged stack. */}
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          {editable && (
            <button
              onClick={refreshFilteredStats}
              disabled={busy || statsRun.busy}
              className="btn-ghost"
              title="Pull stats and photos from every college roster page in this selection"
            >
              {statsRun.busy
                ? `Refreshing ${statsRun.done}/${statsRun.total}…`
                : "Refresh college stats"}
            </button>
          )}
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

      {/* Filters — lifted above the panels below, whose backdrop-filter creates
          a stacking context that would otherwise cover an open dropdown. */}
      <div className="card relative z-30 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            className="input lg:col-span-2"
            placeholder="Search by name, university or notes…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {sports.length > 1 && (
            <Select
              value={fSport ? (sports.find((s) => s.code === fSport)?.name ?? "") : "All sports"}
              options={["All sports", ...sports.map((s) => s.name)]}
              onChange={(v) =>
                setFSport(v === "All sports" ? "" : (sports.find((s) => s.name === v)?.code ?? ""))
              }
              ariaLabel="Filter by sport"
            />
          )}
          <MultiSelect
            values={fSeason}
            options={seasonOptions}
            onChange={setFSeason}
            placeholder={fSeason.length ? "Seasons" : "All seasons"}
            ariaLabel="Filter by season"
          />
          <MultiSelect
            values={fDivision}
            options={divisionOptions}
            onChange={setFDivision}
            placeholder={fDivision.length ? "Divisions" : "All divisions"}
            ariaLabel="Filter by division"
          />
          <MultiSelect
            values={fProgram}
            options={programOptions}
            onChange={setFProgram}
            placeholder={fProgram.length ? "Programs" : "All programs"}
            ariaLabel="Filter by program"
          />
          <Select
            value={fGraduated === "yes" ? "Graduated" : fGraduated === "no" ? "Not graduated" : "Graduated: all"}
            options={["Graduated: all", "Graduated", "Not graduated"]}
            onChange={(v) =>
              setFGraduated(v === "Graduated" ? "yes" : v === "Not graduated" ? "no" : "")
            }
            ariaLabel="Filter by graduation"
          />
          <Select
            value={fStatus === "active" ? "In database" : fStatus === "inactive" ? "Archived" : "Record: all"}
            options={["Record: all", "In database", "Archived"]}
            onChange={(v) =>
              setFStatus(v === "In database" ? "active" : v === "Archived" ? "inactive" : "")
            }
            ariaLabel="Filter by record status"
          />
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
          {/* Which scholarships were full rides — the ones worth pulling out
              on their own, and the set you would then act on together. */}
          <button
            onClick={() => setFFullRide((v) => !v)}
            aria-pressed={fFullRide}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              fFullRide
                ? "border-accent/60 bg-accent/15 text-accent"
                : "border-ink-600 text-muted hover:text-fg"
            }`}
          >
            Full ride ({fullRideCount})
          </button>
          {activeFilters && (
            <button
              onClick={() => {
                setQ("");
                setFSport("");
                setFSeason([]);
                setFDivision([]);
                setFProgram([]);
                setFActiveOnly(false);
                setFFullRide(false);
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
        <div className="glass glass-rim sticky top-20 z-20 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
          <span className="text-sm font-medium text-fg">
            {selectedCount} selected
          </span>
          {/* Full width and a finger-sized target on a phone; a tidy row on
              the right at desk width. */}
          <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto sm:flex-wrap">
            <button
              onClick={bulkRefreshStats}
              disabled={busy || statsRun.busy}
              className="btn-ghost px-3 py-2.5 text-xs sm:py-1.5"
              title="Pull stats and photos from each player's college roster page"
            >
              {statsRun.busy
                ? `Refreshing ${statsRun.done}/${statsRun.total}…`
                : "Refresh college stats"}
            </button>
            <button
              onClick={() => setBulkEditOpen(true)}
              className="btn-ghost px-3 py-2.5 text-xs sm:py-1.5"
            >
              Bulk edit
            </button>
            <button
              onClick={bulkDelete}
              disabled={busy}
              className="btn-danger px-3 py-2.5 text-xs sm:py-1.5"
            >
              Delete selected
            </button>
            <button
              onClick={clearSelection}
              className="btn-ghost px-3 py-2.5 text-xs sm:py-1.5"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <FilterStats rows={players} filtered={filtered} />

      {/* Suggestions shared by every inline cell editor */}
      <datalist id="cell-season-list">
        {seasonOptions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <datalist id="cell-division-list">
        {divisionOptions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <datalist id="cell-program-list">
        {programOptions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {/* View switch */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">
          {allShown
            ? `${filtered.length} player${filtered.length === 1 ? "" : "s"}`
            : `${shownCount} of ${filtered.length} shown`}
        </span>
        <div className="flex gap-1 rounded-full border border-ink-600 p-1">
          {([
            ["table", "Table"],
            ["gallery", "Gallery"],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => chooseView(v)}
              aria-pressed={view === v}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                view === v ? "bg-brand text-white" : "text-muted hover:text-fg"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "gallery" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => (
            <PlayerCard
              key={p.id}
              player={p}
              onOpen={() => setDetail(p)}
              selected={selected.has(p.id)}
              onToggleSelect={() => toggleOne(p.id)}
              selectable={editable}
            />
          ))}
          {filtered.length === 0 && (
            <div className="card col-span-full p-10 text-center text-sm text-muted">
              No players match the current filters.
            </div>
          )}
          {!allShown && <div ref={sentinel} className="col-span-full h-px" aria-hidden />}
        </div>
      ) : (
      /* Table */
      <div className="card overflow-hidden">
        <div className="scroll-area overflow-x-auto">
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
                {sortableTh("name", "Name")}
                {sortableTh("university", "University")}
                {sortableTh("season", "Season")}
                {sortableTh("division", "Division")}
                {sortableTh("program", "Program")}
                {sortableTh("scholarship", "Scholarship", true)}
                {sports.length > 1 && <th className="px-4 py-3 font-medium">Sport</th>}
                {editable && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
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
                    <td
                      className="px-4 py-3 font-medium text-fg"
                      onDoubleClick={() =>
                        editable &&
                        setEditingCell({ id: p.id, field: "name", value: p.name })
                      }
                    >
                      {editingCell?.id === p.id && editingCell.field === "name" ? (
                        <input
                          autoFocus
                          disabled={savingCell}
                          className="input w-full min-w-[9rem] px-2 py-1 text-sm"
                          value={editingCell.value}
                          onChange={(e) =>
                            setEditingCell({ id: p.id, field: "name", value: e.target.value })
                          }
                          onBlur={commitCell}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitCell();
                            } else if (e.key === "Escape") {
                              setEditingCell(null);
                            }
                          }}
                          aria-label={`Name for ${p.name}`}
                        />
                      ) : (
                      <button
                        onClick={() => setDetail(p)}
                        className="flex items-center gap-2.5 text-left hover:text-brand"
                        title="Click to open · double-click to rename"
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
                            <span className="ml-1.5 badge bg-ink-700 text-muted">Archived</span>
                          )}
                          {(recordsByName.get(p.name.trim().toLowerCase()) ?? 1) > 1 && (
                            <span
                              className="ml-1.5 badge bg-accent/15 text-accent"
                              title={`${recordsByName.get(p.name.trim().toLowerCase())} records for this player — see Career path`}
                            >
                              ×{recordsByName.get(p.name.trim().toLowerCase())}
                            </span>
                          )}
                          {p.notes && (
                            <span className="ml-1.5 text-xs text-muted" title={p.notes}>
                              ✎
                            </span>
                          )}
                        </span>
                      </button>
                      )}
                      {/* Straight to their Instagram, without opening the
                          record first. Its own link, so the click does not
                          also open the profile behind it. */}
                      {p.instagramUrl && (
                        <a
                          href={p.instagramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title={`Open ${p.name}'s Instagram`}
                          aria-label={`Open ${p.name}'s Instagram`}
                          className="ml-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink-700/60 hover:text-fg"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="2" width="20" height="20" rx="5" />
                            <circle cx="12" cy="12" r="4" />
                            <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
                          </svg>
                        </a>
                      )}
                    </td>
                    {cell(p, "university", "text-fg")}
                    {cell(p, "season", "text-muted", { list: "cell-season-list" })}
                    {/* Not editable here: the division comes from the player's
                        college profile, which is the one place it is set. */}
                    <td className="px-4 py-3">
                      {p.division ? (
                        <span className="badge bg-ink-700 text-fg">{p.division}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    {cell(p, "program", "text-muted", { list: "cell-program-list" })}
                    <td
                      className={`px-4 py-3 text-right tabular-nums text-accent ${
                        editable ? "cursor-pointer" : ""
                      }`}
                      onDoubleClick={() =>
                        editable &&
                        setEditingCell({
                          id: p.id,
                          field: "scholarship",
                          value: p.scholarship != null ? String(p.scholarship) : "",
                        })
                      }
                      title={editable ? "Double-click to edit" : undefined}
                    >
                      {editingCell?.id === p.id && editingCell.field === "scholarship" ? (
                        <input
                          autoFocus
                          inputMode="numeric"
                          disabled={savingCell}
                          className="input w-28 px-2 py-1 text-right text-sm"
                          value={editingCell.value}
                          onChange={(e) =>
                            setEditingCell({ id: p.id, field: "scholarship", value: e.target.value })
                          }
                          onBlur={commitCell}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitCell();
                            } else if (e.key === "Escape") {
                              setEditingCell(null);
                            }
                          }}
                          aria-label={`Scholarship for ${p.name}`}
                        />
                      ) : p.scholarship != null || p.fullRide ? (
                        <span className="inline-flex items-center justify-end gap-1.5">
                          {p.fullRide && (
                            <span
                              className="badge bg-accent/20 text-accent"
                              title="Full ride — covers the whole cost"
                            >
                              Full
                            </span>
                          )}
                          {p.scholarship != null && formatUSD(p.scholarship)}
                        </span>
                      ) : (
                        <span className={editable ? "text-muted" : ""}>—</span>
                      )}
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
        {!allShown && <div ref={sentinel} className="h-px" aria-hidden />}
      </div>
      )}

      {modalOpen && (
        <PlayerModal
          sports={sports}
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
          related={players.filter((x) =>
            x.id === detail.id
              ? false
              : detail.personId
                ? x.personId === detail.personId
                : // Only records saved before people existed fall back to the
                  // name, which is what used to lose a player to a nickname.
                  x.name.trim().toLowerCase() === detail.name.trim().toLowerCase()
          )}
          onOpenRelated={(p) => setDetail(p)}
          onSplit={handleSplitPerson}
          splitting={splitting}
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
