"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * Glass dropdown used across the app.
 *
 * Replaces two things that didn't work well:
 *  - native <select>, whose option list is drawn by the OS and can't be styled
 *  - <input list=…> datalists, which the browser filters by the value already
 *    in the field, so a field reading "Becas EEUU" only ever offered that one
 *
 * Opening always shows the full list. Typing filters it only when the user
 * actually types (allowCustom), so an existing value never hides the options.
 */
export function Select({
  value,
  options,
  onChange,
  placeholder = "Select…",
  allowCustom = false,
  className = "",
  ariaLabel,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  /** let the user type a value that isn't in the list (e.g. a new season) */
  allowCustom?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options; // open → always the whole list
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: Event) {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    }
    document.addEventListener("pointerdown", onDocMouseDown);
    return () => document.removeEventListener("pointerdown", onDocMouseDown);
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
    setHighlight(0);
  }

  function commit(v: string) {
    onChange(v);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) return setOpen(true);
      setHighlight((h) => Math.min(h + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!open) return setOpen(true);
      if (shown[highlight]) commit(shown[highlight]);
      else if (allowCustom && query.trim()) commit(query.trim());
    } else if (e.key === "Escape") {
      close();
    }
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div
        className="input flex cursor-pointer items-center gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <input
            autoFocus
            className="min-w-0 flex-1 bg-transparent outline-none"
            value={query}
            placeholder={value || "Type to search…"}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={onKeyDown}
            onClick={(e) => e.stopPropagation()}
            aria-label={ariaLabel}
          />
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left outline-none"
            onKeyDown={onKeyDown}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={ariaLabel}
          >
            {value || <span className="text-muted">{placeholder}</span>}
          </button>
        )}
        <span
          className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="glass glass-rim scroll-area popover-in absolute z-50 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl p-1"
        >
          {shown.map((o, i) => {
            const selected = o === value;
            return (
              <li key={o} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => commit(o)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    i === highlight ? "bg-brand/15 text-fg" : "text-fg hover:bg-brand/10"
                  }`}
                >
                  <span className="truncate">{o}</span>
                  {selected && <span className="shrink-0 text-brand">✓</span>}
                </button>
              </li>
            );
          })}

          {allowCustom && query.trim() && !options.some((o) => o.toLowerCase() === query.trim().toLowerCase()) && (
            <li role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => commit(query.trim())}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-brand hover:bg-brand/10"
              >
                Add “{query.trim()}”
              </button>
            </li>
          )}

          {shown.length === 0 && !allowCustom && (
            <li className="px-3 py-2 text-sm text-muted">No matches</li>
          )}
        </ul>
      )}
    </div>
  );
}
