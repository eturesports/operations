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
          "No se encontraron jugadores. Asegúrate de que la primera fila tiene cabeceras (Nombre, Universidad, Temporada, División, Programa, Beca, Deporte, Notas)."
        );
        setPlayers([]);
        return;
      }
      setPlayers(players);
      setUnknownHeaders(unknownHeaders);
    } catch {
      setError("No se pudo leer el archivo CSV.");
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
      if (!res.ok) throw new Error(j.error ?? "Error al importar");
      setResult(j as ImportResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al importar");
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
          <h2 className="text-lg font-bold text-white">Importar jugadores (CSV)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-200">
              Importación completada: <b>{result.created}</b> creados
              {result.skipped > 0 && (
                <>
                  , <b>{result.skipped}</b> omitidos (duplicados)
                </>
              )}
              {result.errorCount > 0 && (
                <>
                  , <b>{result.errorCount}</b> con error
                </>
              )}
              .
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-auto rounded-lg border border-ink-600 p-3 text-xs text-red-300">
                {result.errors.map((er) => (
                  <div key={er.row}>
                    Fila {er.row}: {er.error}
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={onDone}
                className="btn-primary"
              >
                Cerrar y actualizar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Sube un CSV con cabeceras. Columnas reconocidas: <b>Nombre</b> (obligatorio),
              Universidad, Temporada, División, Programa, Beca, Deporte y Notas. Es el
              mismo formato que genera «Exportar CSV».
            </p>

            <div>
              <label className="label">Archivo CSV</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={onFile}
                className="block w-full text-sm text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-700 file:px-3 file:py-2 file:text-sm file:text-white hover:file:bg-ink-600"
              />
            </div>

            {sports.length > 1 && (
              <div>
                <label className="label">
                  Deporte de destino (si la fila no indica «Deporte»)
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

            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
              />
              Omitir duplicados (mismo nombre, temporada y universidad)
            </label>

            {unknownHeaders.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Columnas ignoradas (no reconocidas): {unknownHeaders.join(", ")}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            {players.length > 0 && (
              <div className="rounded-lg border border-ink-600 bg-ink-900/50 px-3 py-2 text-sm text-gray-300">
                <b>{players.length}</b> jugadores listos para importar
                {fileName ? ` desde ${fileName}` : ""}.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="btn-ghost">
                Cancelar
              </button>
              <button
                onClick={doImport}
                disabled={busy || players.length === 0}
                className="btn-primary"
              >
                {busy ? "Importando…" : `Importar ${players.length || ""}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
