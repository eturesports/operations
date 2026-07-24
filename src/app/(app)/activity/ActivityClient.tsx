"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type LogRow = {
  id: string;
  entity: string;
  entityName: string | null;
  action: string;
  summary: string | null;
  changes: string | null;
  userEmail: string | null;
  userName: string | null;
  createdAt: string;
};

const ACTION_STYLE: Record<string, string> = {
  create: "bg-green-500/15 text-green-300",
  update: "bg-accent/20 text-accent",
  approve: "bg-green-500/15 text-green-300",
  import: "bg-accent/20 text-accent",
  delete: "bg-red-500/15 text-red-300",
  bulk_delete: "bg-red-500/15 text-red-300",
  delete_all: "bg-red-500/20 text-red-300",
  bulk_update: "bg-accent/20 text-accent",
};

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivityClient({ rows }: { rows: LogRow[] }) {
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");

  const entities = useMemo(() => [...new Set(rows.map((r) => r.entity))].sort(), [rows]);
  const actions = useMemo(() => [...new Set(rows.map((r) => r.action))].sort(), [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (entity && r.entity !== entity) return false;
      if (action && r.action !== action) return false;
      if (needle) {
        const hay = `${r.userEmail ?? ""} ${r.userName ?? ""} ${r.summary ?? ""} ${r.entityName ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, entity, action]);

  function exportCSV() {
    const headers = ["When", "User", "Action", "Entity", "Item", "Summary", "Changes"];
    const lines = filtered.map((r) =>
      [when(r.createdAt), r.userEmail ?? "", r.action, r.entity, r.entityName ?? "", r.summary ?? "", r.changes ?? ""]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eture-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="kicker mb-1">Audit</div>
          <h1 className="text-2xl font-bold text-fg sm:text-3xl">Activity log</h1>
          <p className="text-sm text-muted">
            Every change to the database — who, what and when. Kept permanently.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/users" className="btn-ghost">
            ← Access
          </Link>
          <button onClick={exportCSV} className="btn-ghost">
            Export CSV
          </button>
        </div>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            className="input"
            placeholder="Search user, item or summary…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="input" value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="">All types</option>
            {entities.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <select className="input" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-600 bg-ink-900/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-ink-700/60 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{when(r.createdAt)}</td>
                  <td className="px-4 py-3 text-fg">{r.userEmail ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${ACTION_STYLE[r.action] ?? "bg-ink-700 text-muted"}`}>
                      {r.action}
                    </span>
                    <span className="ml-2 text-xs text-muted">{r.entity}</span>
                  </td>
                  <td className="px-4 py-3 text-fg">
                    {r.summary ?? r.entityName ?? "—"}
                    {r.changes && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-muted">changes</summary>
                        <pre className="mt-1 max-w-full overflow-x-auto whitespace-pre-wrap rounded-lg bg-ink-950/60 p-2 text-[11px] text-muted">
                          {r.changes}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted">
                    No activity matches the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted">
        Showing the {rows.length} most recent entries. The full history is stored and exportable.
      </p>
    </div>
  );
}
