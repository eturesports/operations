"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * Search-and-pick list allowing several values — used for nationality, where
 * dual citizenship is common. Selected values show as removable chips.
 */
export function MultiSelect({
  values,
  options,
  onChange,
  placeholder = "Search…",
  renderPrefix,
  ariaLabel,
}: {
  values: string[];
  options: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** e.g. a flag emoji shown before each option */
  renderPrefix?: (option: string) => string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = options.filter((o) => !values.includes(o));
    return q ? pool.filter((o) => o.toLowerCase().includes(q)) : pool;
  }, [options, values, query]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function add(v: string) {
    onChange([...values, v]);
    setQuery("");
    setHighlight(0);
  }
  function remove(v: string) {
    onChange(values.filter((x) => x !== v));
  }

  return (
    <div ref={wrapRef} className="relative">
      <div
        className="input flex min-h-[2.75rem] flex-wrap items-center gap-1.5"
        onClick={() => setOpen(true)}
      >
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-xs text-fg"
          >
            {renderPrefix?.(v)} {v}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(v);
              }}
              className="text-muted hover:text-fg"
              aria-label={`Remove ${v}`}
            >
              ✕
            </button>
          </span>
        ))}
        <input
          className="min-w-[6rem] flex-1 bg-transparent text-sm outline-none"
          placeholder={values.length ? "" : placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, shown.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (shown[highlight]) add(shown[highlight]);
            } else if (e.key === "Backspace" && !query && values.length) {
              remove(values[values.length - 1]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          aria-label={ariaLabel}
          aria-controls={listId}
        />
      </div>

      {open && shown.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="glass absolute z-50 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl p-1"
        >
          {shown.slice(0, 80).map((o, i) => (
            <li key={o} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => add(o)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  i === highlight ? "bg-brand/15 text-fg" : "text-fg hover:bg-brand/10"
                }`}
              >
                {renderPrefix?.(o)} {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
