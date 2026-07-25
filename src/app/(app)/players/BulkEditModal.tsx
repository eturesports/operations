"use client";

import { useState } from "react";

export type BulkPatch = {
  season?: string;
  division?: string;
  program?: string;
  university?: string;
  active?: boolean;
  graduated?: boolean;
  graduationYear?: number | null;
};

// Tri-state selects: "" leaves the field untouched.
type TriState = "" | "yes" | "no";

export function BulkEditModal({
  count,
  divisionOptions,
  programOptions,
  onClose,
  onApply,
}: {
  count: number;
  divisionOptions: string[];
  programOptions: string[];
  onClose: () => void;
  onApply: (patch: BulkPatch) => Promise<void>;
}) {
  const [season, setSeason] = useState("");
  const [division, setDivision] = useState("");
  const [program, setProgram] = useState("");
  const [university, setUniversity] = useState("");
  const [status, setStatus] = useState<TriState>("");
  const [graduated, setGraduated] = useState<TriState>("");
  const [graduationYear, setGraduationYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    const patch: BulkPatch = {};
    if (season.trim()) patch.season = season.trim();
    if (division.trim()) patch.division = division.trim();
    if (program.trim()) patch.program = program.trim();
    if (university.trim()) patch.university = university.trim();
    if (status) patch.active = status === "yes";
    if (graduated) patch.graduated = graduated === "yes";
    if (graduationYear.trim()) {
      const y = parseInt(graduationYear.replace(/[^\d]/g, ""), 10);
      if (Number.isNaN(y) || y < 1950 || y > 2100) {
        setError("Graduation year must be a four-digit year.");
        return;
      }
      patch.graduationYear = y;
    }
    if (Object.keys(patch).length === 0) {
      setError("Fill at least one field to apply.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onApply(patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
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
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-fg">Bulk edit</h2>
          <button onClick={onClose} className="text-muted hover:text-fg">
            ✕
          </button>
        </div>
        <p className="mb-4 text-sm text-muted">
          Applies to <b className="text-fg">{count}</b> selected player
          {count === 1 ? "" : "s"}. Leave a field empty to keep it unchanged.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="label">Season</label>
            <input className="input" placeholder="24/25" value={season} onChange={(e) => setSeason(e.target.value)} />
          </div>
          <div>
            <label className="label">Division</label>
            <input className="input" list="bulk-division" value={division} onChange={(e) => setDivision(e.target.value)} />
            <datalist id="bulk-division">
              {divisionOptions.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">Program</label>
            <input className="input" list="bulk-program" value={program} onChange={(e) => setProgram(e.target.value)} />
            <datalist id="bulk-program">
              {programOptions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">University</label>
            <input className="input" value={university} onChange={(e) => setUniversity(e.target.value)} />
          </div>

          <div className="border-t border-ink-600 pt-4">
            <label className="label">Status</label>
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value as TriState)}
            >
              <option value="">Keep unchanged</option>
              <option value="yes">Active</option>
              <option value="no">Inactive</option>
            </select>
            <p className="mt-1 text-xs text-muted">
              Inactive players stay in the database but are excluded from dashboards and analytics.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Graduated</label>
              <select
                className="input"
                value={graduated}
                onChange={(e) => setGraduated(e.target.value as TriState)}
              >
                <option value="">Keep unchanged</option>
                <option value="yes">Graduated</option>
                <option value="no">Not graduated</option>
              </select>
            </div>
            <div>
              <label className="label">Graduation year</label>
              <input
                className="input"
                inputMode="numeric"
                placeholder="2025"
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button onClick={apply} disabled={busy} className="btn-primary">
            {busy ? "Applying…" : `Apply to ${count}`}
          </button>
        </div>
      </div>
    </div>
  );
}
