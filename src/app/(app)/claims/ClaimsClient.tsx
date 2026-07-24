"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClaimStatus } from "@prisma/client";

export type Suggested = {
  text: string;
  metric: string;
  definition: string;
  population: string;
  period: string;
  denominator: string;
  source: string;
  coverage: string;
  footer: string;
};

export type SavedClaim = {
  id: string;
  text: string;
  metric: string | null;
  definition: string | null;
  population: string | null;
  period: string | null;
  denominator: string | null;
  source: string | null;
  coverage: string | null;
  authorizedUse: string | null;
  owner: string | null;
  status: ClaimStatus;
  asOf: string | null;
  footer: string;
};

const STATUS_STYLE: Record<ClaimStatus, string> = {
  DRAFT: "bg-ink-700 text-muted",
  APPROVED: "bg-green-500/15 text-green-300",
  ARCHIVED: "bg-red-500/15 text-red-300",
};

function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className={`btn-ghost px-3 py-1.5 text-xs ${className}`}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

export function ClaimsClient({
  editable,
  saved: initialSaved,
  suggested,
}: {
  editable: boolean;
  saved: SavedClaim[];
  suggested: Suggested[];
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<SavedClaim[]>(initialSaved);
  const [modal, setModal] = useState<Partial<SavedClaim> | null>(null);

  const savedTexts = new Set(saved.map((s) => s.text));

  async function saveSuggested(s: Suggested) {
    const res = await fetch("/api/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...s, status: "APPROVED" }),
    });
    if (res.ok) {
      const { item } = await res.json();
      setSaved((p) => [{ ...item, footer: s.footer }, ...p]);
      router.refresh();
    }
  }

  async function del(c: SavedClaim) {
    if (!confirm("Delete this claim?")) return;
    const res = await fetch(`/api/claims/${c.id}`, { method: "DELETE" });
    if (res.ok) {
      setSaved((p) => p.filter((x) => x.id !== c.id));
      router.refresh();
    }
  }

  async function cycleStatus(c: SavedClaim) {
    const next: ClaimStatus =
      c.status === "DRAFT" ? "APPROVED" : c.status === "APPROVED" ? "ARCHIVED" : "DRAFT";
    const res = await fetch(`/api/claims/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      setSaved((p) => p.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="kicker mb-1">Data Intelligence</div>
          <h1 className="text-2xl font-bold text-fg sm:text-3xl">Claims Library</h1>
          <p className="text-sm text-muted">
            Every public figure as a versioned record with definition, denominator and source.
          </p>
        </div>
        {editable && (
          <button onClick={() => setModal({ status: "DRAFT" })} className="btn-primary">
            + New claim
          </button>
        )}
      </div>

      {/* Suggested from live data */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-fg">Suggested from live data</h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {suggested.map((s) => {
            const already = savedTexts.has(s.text);
            return (
              <div key={s.text} className="card space-y-2 p-4">
                <p className="font-medium text-fg">{s.text}</p>
                <p className="text-xs leading-relaxed text-muted">{s.footer}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <CopyButton text={`${s.text}\n\n${s.footer}`} />
                  {editable && (
                    <button
                      onClick={() => saveSuggested(s)}
                      disabled={already}
                      className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
                    >
                      {already ? "In library" : "Save to library"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Library */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-fg">Library</h2>
        {saved.length === 0 ? (
          <div className="card p-8 text-center text-muted">
            No saved claims yet. Save a suggested one or create a new claim.
          </div>
        ) : (
          <div className="space-y-3">
            {saved.map((c) => (
              <div key={c.id} className="card space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="font-medium text-fg">{c.text}</p>
                  <button
                    onClick={() => editable && cycleStatus(c)}
                    className={`badge ${STATUS_STYLE[c.status]} ${editable ? "hover:opacity-80" : ""}`}
                    title={editable ? "Change status" : undefined}
                  >
                    {c.status}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {c.metric && <Chip>{c.metric}</Chip>}
                  {c.denominator && c.denominator !== "—" && <Chip>den: {c.denominator}</Chip>}
                  {c.coverage && <Chip>cov: {c.coverage}</Chip>}
                  {c.authorizedUse && <Chip>{c.authorizedUse}</Chip>}
                  {c.owner && <Chip>owner: {c.owner}</Chip>}
                </div>
                <p className="text-xs leading-relaxed text-muted">{c.footer}</p>
                <div className="flex flex-wrap gap-2">
                  <CopyButton text={`${c.text}\n\n${c.footer}`} />
                  {editable && (
                    <>
                      <button onClick={() => setModal(c)} className="btn-ghost px-3 py-1.5 text-xs">
                        Edit
                      </button>
                      <button onClick={() => del(c)} className="btn-danger px-3 py-1.5 text-xs">
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {modal && (
        <ClaimModal
          initial={modal}
          onClose={() => setModal(null)}
          onSaved={(item, footer) => {
            setSaved((p) => {
              const exists = p.some((x) => x.id === item.id);
              return exists ? p.map((x) => (x.id === item.id ? { ...item, footer } : x)) : [{ ...item, footer }, ...p];
            });
            setModal(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-ink-600 bg-ink-800/60 px-2 py-0.5 text-muted">
      {children}
    </span>
  );
}

const FIELDS: { key: keyof SavedClaim; label: string; area?: boolean }[] = [
  { key: "text", label: "Public claim", area: true },
  { key: "metric", label: "Metric" },
  { key: "denominator", label: "Denominator" },
  { key: "definition", label: "Definition", area: true },
  { key: "population", label: "Population" },
  { key: "period", label: "Period" },
  { key: "source", label: "Source" },
  { key: "coverage", label: "Coverage" },
  { key: "authorizedUse", label: "Authorized use (web, social, PR…)" },
  { key: "owner", label: "Owner" },
];

function ClaimModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Partial<SavedClaim>;
  onClose: () => void;
  onSaved: (item: SavedClaim, footer: string) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const f: Record<string, string> = {};
    for (const { key } of FIELDS) f[key] = (initial[key] as string) ?? "";
    return f;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!form.text.trim()) {
      setError("Claim text is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const isEdit = !!initial.id;
      const res = await fetch(isEdit ? `/api/claims/${initial.id}` : "/api/claims", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed to save");
      onSaved(j.item as SavedClaim, j.item.footer ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-fg">{initial.id ? "Edit claim" : "New claim"}</h2>
          <button onClick={onClose} className="text-muted hover:text-fg">✕</button>
        </div>
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
        <div className="space-y-3">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              {f.area ? (
                <textarea
                  className="input min-h-[64px]"
                  value={form[f.key]}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                />
              ) : (
                <input
                  className="input"
                  value={form[f.key]}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} disabled={busy} className="btn-primary">
            {busy ? "Saving…" : initial.id ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
