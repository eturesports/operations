"use client";

import { useState } from "react";
import { parseCSV, rowsToPlayers, type CsvPlayer } from "@/lib/csv";

type SportOpt = { id: string; code: string; name: string };

type ImportResult = {
  created: number;
  skipped: number;
  errorCount: number;
  errors: { row: number; error: string }[];
};

export function ImportModal({
  sports,
  defaultSportId,
  onClose,
  onDone,
}: {
  sports: SportOpt[];
  defaultSportId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [sportId, setSportId] = useState(defaultSportId);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [players, setPlayers] = useState<CsvPlayer[]>([]);
  const [unknownHeaders, setUnknownHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      const { players, unknownHeaders } = rowsToPlayers(rows);
      if (players.length === 0) {
        setError(
          "No players found. Make sure the first row has headers (Name, University, Season, Division, Program, Scholarship, Sport, Notes)."
        );
        setPlayers([]);
        return;
      }
      setPlayers(players);
      setUnknownHeaders(unknownHeaders);
    } catch {
      setError("Could not read the CSV file.");
    }
  }

  async function doImport() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/players/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultSportId: sportId, skipDuplicates, rows: players }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed to import");
      setResult(j as ImportResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to import");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={onClose}
    >
      <div className="card w-full max-w-lg p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-fg">Import players (CSV)</h2>
          <button onClick={onClose} className="text-muted hover:text-fg">
            ✕
          </button>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-200">
              Import complete: <b>{result.created}</b> created
              {result.skipped > 0 && (
                <>
                  , <b>{result.skipped}</b> skipped (duplicates)
                </>
              )}
              {result.errorCount > 0 && (
                <>
                  , <b>{result.errorCount}</b> with errors
                </>
              )}
              .
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-auto rounded-lg border border-ink-600 p-3 text-xs text-red-300">
                {result.errors.map((er) => (
                  <div key={er.row}>
                    Row {er.row}: {er.error}
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={onDone}
                className="btn-primary"
              >
                Close and refresh
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Upload a CSV with headers. Recognized columns: <b>Name</b> (required),
              University, Season, Division, Program, Scholarship, Sport and Notes. Same
              format produced by “Export CSV”.
            </p>

            <div>
              <label className="label">CSV file</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={onFile}
                className="block w-full text-sm text-fg file:mr-3 file:rounded-lg file:border-0 file:bg-ink-700 file:px-3 file:py-2 file:text-sm file:text-fg hover:file:bg-ink-600"
              />
            </div>

            {sports.length > 1 && (
              <div>
                <label className="label">
                  Target sport (if the row has no “Sport” column)
                </label>
                <select
                  className="input"
                  value={sportId}
                  onChange={(e) => setSportId(e.target.value)}
                >
                  {sports.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-fg">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
              />
              Skip duplicates (same name, season and university)
            </label>

            {unknownHeaders.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Ignored columns (not recognized): {unknownHeaders.join(", ")}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            {players.length > 0 && (
              <div className="rounded-lg border border-ink-600 bg-ink-900/50 px-3 py-2 text-sm text-fg">
                <b>{players.length}</b> players ready to import
                {fileName ? ` from ${fileName}` : ""}.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="btn-ghost">
                Cancel
              </button>
              <button
                onClick={doImport}
                disabled={busy || players.length === 0}
                className="btn-primary"
              >
                {busy ? "Importing…" : `Import ${players.length || ""}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
