"use client";

import { useEffect, useState } from "react";

type Link = {
  url: string;
  expiresAt: string | null;
  useCount: number;
  lastUsedAt?: string | null;
};

export function ShareLinkPanel({ playerId }: { playerId: string }) {
  const [link, setLink] = useState<Link | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/players/${playerId}/share`);
        const j = await res.json();
        if (!cancelled && res.ok) setLink(j.link);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/players/${playerId}/share`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not create the link");
      setLink(j.link);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the link");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!confirm("Revoke this link? Anyone holding it will lose access immediately.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/players/${playerId}/share`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not revoke the link");
      setLink(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke the link");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy — select the link and copy it manually.");
    }
  }

  if (loading) return null;

  return (
    <div className="mt-6 border-t border-ink-600 pt-4">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-fg">Share for editing</h3>
        <p className="text-[11px] text-muted">
          Send a link so someone without an account can update this player&apos;s details.
          Scholarship and status stay private.
        </p>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {link ? (
        <div className="space-y-2 rounded-xl border border-ink-600 bg-ink-800/40 p-3">
          <input
            readOnly
            value={link.url}
            onFocus={(e) => e.currentTarget.select()}
            className="input text-xs"
            aria-label="Share link"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={copy} className="btn-primary px-3 py-1.5 text-xs">
              {copied ? "Copied ✓" : "Copy link"}
            </button>
            <button
              onClick={create}
              disabled={busy}
              className="btn-ghost px-3 py-1.5 text-xs"
              title="Generate a new link and invalidate this one"
            >
              Regenerate
            </button>
            <button
              onClick={revoke}
              disabled={busy}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Revoke
            </button>
          </div>
          <p className="text-[10px] text-muted">
            {link.expiresAt
              ? `Expires ${new Date(link.expiresAt).toLocaleDateString()}`
              : "No expiry"}
            {" · "}
            {link.useCount > 0 ? `opened ${link.useCount}×` : "not opened yet"}
          </p>
        </div>
      ) : (
        <button onClick={create} disabled={busy} className="btn-ghost px-3 py-1.5 text-xs">
          {busy ? "Creating…" : "🔗 Create edit link"}
        </button>
      )}
    </div>
  );
}
