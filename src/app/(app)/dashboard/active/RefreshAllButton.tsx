"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Runs the same job the weekly cron runs, on demand.
export function RefreshAllButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/cron/refresh-stats");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Refresh failed");
      setMsg(
        `Updated ${j.updated} of ${j.checked} active players` +
          (j.unmatched ? ` · ${j.unmatched} without an NCAA match` : "")
      );
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={run} disabled={busy} className="btn-ghost px-3 py-1.5 text-xs">
        {busy ? "Refreshing…" : "↻ Refresh all from NCAA"}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
