"use client";

import { useState } from "react";

export type BulkPatch = {
  season?: string;
  division?: string;
  program?: string;
  university?: string;
};

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    const patch: BulkPatch = {};
    if (season.trim()) patch.season = season.trim();
    if (division.trim()) patch.division = division.trim();
    if (program.trim()) patch.program = program.trim();
    if (university.trim()) patch.university = university.trim();
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
