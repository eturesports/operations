"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * True on a touch screen. Read after mount so the server render and the first
 * client render agree, then kept live for a tablet that gains a mouse.
 */
function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const apply = () => setCoarse(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return coarse;
}

/**
 * Search-and-pick list allowing several values — seasons, divisions and
 * programmes in the filters, nationality on the player form. Selected values
 * show as removable chips.
 *
 * On a phone the list closes as soon as something is picked. Leaving it open
 * was the desktop behaviour applied where it does not work: with the keyboard
 * up, the panel fills what is left of the screen, and picking a season only
 * removed that season from the list — the panel stayed, so it read as though
 * nothing had happened, and there was no click-away to close it. One tap adds
 * one value; tap the field again to add another.
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
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const coarse = useCoarsePointer();

  // A short list needs no search box, and on a phone the keyboard it summons
  // is what squeezes the panel into a strip. Seasons, divisions and
  // programmes are all under a dozen; nationality is not, and keeps typing.
  const searchable = !coarse || options.length > 12;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = options.filter((o) => !values.includes(o));
    return q ? pool.filter((o) => o.toLowerCase().includes(q)) : pool;
  }, [options, values, query]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: Event) {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
    setHighlight(0);
  }

  /** Close and give the keyboard back the screen. */
  function dismiss() {
    inputRef.current?.blur();
    close();
  }

  function add(v: string) {
    onChange([...values, v]);
    setQuery("");
    setHighlight(0);
    if (coarse) dismiss();
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
          ref={inputRef}
          className="min-w-[6rem] flex-1 bg-transparent text-sm outline-none"
          placeholder={values.length ? "" : placeholder}
          value={query}
          readOnly={!searchable}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={ariaLabel}
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
              close();
            }
          }}
        />
        <span
          className={`ml-auto shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </div>

      {open && shown.length > 0 && (
        <div className="glass glass-rim popover-in absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl">
          {/* A way out that does not depend on knowing you can tap the page
              behind. Only on touch, where that gesture is not discoverable. */}
          {coarse && (
            <div className="flex items-center justify-between gap-3 border-b border-ink-600/60 px-3 py-2">
              <span className="text-[11px] uppercase tracking-wide text-muted">
                {values.length
                  ? `${values.length} selected · pick another`
                  : "Pick one"}
              </span>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-full bg-ink-700 px-3 py-1 text-xs font-medium text-fg"
              >
                Done
              </button>
            </div>
          )}

          <ul id={listId} role="listbox" className="scroll-area max-h-64 overflow-y-auto p-1">
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
        </div>
      )}
    </div>
  );
}
