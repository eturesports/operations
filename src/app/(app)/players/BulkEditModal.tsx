"use client";

import { useState } from "react";
import { Select } from "@/components/Select";
import { useModal, MODAL_BACKDROP, MODAL_PANEL } from "@/components/useModal";

export type BulkPatch = {
  season?: string;
  program?: string;
  university?: string;
  active?: boolean;
  playingNow?: boolean;
  graduated?: boolean;
  graduationYear?: number | null;
  nationalChampion?: boolean;
};

// Tri-state selects: "" leaves the field untouched.
type TriState = "" | "yes" | "no";

const STATUS_LABEL: Record<TriState, string> = {
  "": "Keep unchanged", yes: "In database", no: "Archived",
};
const LABEL_STATUS: Record<string, TriState> = {
  "Keep unchanged": "", "In database": "yes", Archived: "no",
};
const PLAYING_LABEL: Record<TriState, string> = {
  "": "Keep unchanged", yes: "Playing now", no: "Not playing",
};
const LABEL_PLAYING: Record<string, TriState> = {
  "Keep unchanged": "", "Playing now": "yes", "Not playing": "no",
};
const CHAMP_LABEL: Record<TriState, string> = {
  "": "Keep unchanged", yes: "National champion", no: "Not a champion",
};
const LABEL_CHAMP: Record<string, TriState> = {
  "Keep unchanged": "", "National champion": "yes", "Not a champion": "no",
};
const GRAD_LABEL: Record<TriState, string> = {
  "": "Keep unchanged", yes: "Graduated", no: "Not graduated",
};
const LABEL_GRAD: Record<string, TriState> = {
  "Keep unchanged": "", Graduated: "yes", "Not graduated": "no",
};

export function BulkEditModal({
  count,
  programOptions,
  onClose,
  onApply,
}: {
  count: number;
  programOptions: string[];
  onClose: () => void;
  onApply: (patch: BulkPatch) => Promise<void>;
}) {
  useModal(onClose);

  const [season, setSeason] = useState("");
  const [program, setProgram] = useState("");
  const [university, setUniversity] = useState("");
  const [status, setStatus] = useState<TriState>("");
  const [playing, setPlaying] = useState<TriState>("");
  const [graduated, setGraduated] = useState<TriState>("");
  const [champion, setChampion] = useState<TriState>("");
  const [graduationYear, setGraduationYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    const patch: BulkPatch = {};
    if (season.trim()) patch.season = season.trim();
    if (program.trim()) patch.program = program.trim();
    if (university.trim()) patch.university = university.trim();
    if (status) patch.active = status === "yes";
    if (playing) patch.playingNow = playing === "yes";
    if (graduated) patch.graduated = graduated === "yes";
    if (champion) patch.nationalChampion = champion === "yes";
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
      className={MODAL_BACKDROP}
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`${MODAL_PANEL} sm:max-w-md`}
        onMouseDown={(e) => e.stopPropagation()}
      >
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
            <label className="label">Program</label>
            <Select
              value={program}
              options={programOptions}
              onChange={setProgram}
              placeholder="Keep unchanged"
              allowCustom
              ariaLabel="Program"
            />
          </div>
          <div>
            <label className="label">University</label>
            <input className="input" value={university} onChange={(e) => setUniversity(e.target.value)} />
          </div>

          <div className="border-t border-ink-600 pt-4">
            <label className="label">Currently playing in college soccer</label>
            <Select
              value={PLAYING_LABEL[playing]}
              options={["Keep unchanged", "Playing now", "Not playing"]}
              onChange={(v) => setPlaying(LABEL_PLAYING[v] ?? "")}
              ariaLabel="Currently playing"
            />
            <p className="mt-1 text-xs text-muted">
              Marks their current university roster. Players with no university on
              record are skipped.
            </p>
          </div>

          <div>
            <label className="label">Record</label>
            <Select
              value={STATUS_LABEL[status]}
              options={["Keep unchanged", "In database", "Archived"]}
              onChange={(v) => setStatus(LABEL_STATUS[v] ?? "")}
              ariaLabel="Record status"
            />
            <p className="mt-1 text-xs text-muted">
              Archived players stay in the database but are excluded from dashboards and analytics.
            </p>
          </div>

          <div>
            <label className="label">National champion</label>
            <Select
              value={CHAMP_LABEL[champion]}
              options={["Keep unchanged", "National champion", "Not a champion"]}
              onChange={(v) => setChampion(LABEL_CHAMP[v] ?? "")}
              ariaLabel="National champion"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Graduated</label>
              <Select
                value={GRAD_LABEL[graduated]}
                options={["Keep unchanged", "Graduated", "Not graduated"]}
                onChange={(v) => setGraduated(LABEL_GRAD[v] ?? "")}
                ariaLabel="Graduated"
              />
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
