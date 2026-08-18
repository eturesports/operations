"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Which columns the players table shows, and the control for changing it.
 *
 * The table has to serve people looking at different things — one person
 * wants money and division, another wants where everyone is from and who is
 * on a roster right now. Rather than widening it until it fits everyone
 * (which is what made it scroll sideways in the first place), each person
 * chooses. The choice is theirs and it is remembered.
 *
 * Name is not in this list. A row of a players table without the player is
 * not a row, so it is always there, along with the checkbox and the actions
 * at the end.
 */
export type ColumnKey =
  | "university"
  | "season"
  | "division"
  | "program"
  | "scholarship"
  | "playing"
  | "sport"
  | "position"
  | "nationality"
  | "previousClub"
  | "graduation";

export const COLUMNS: {
  key: ColumnKey;
  label: string;
  /** shown until someone says otherwise */
  on: boolean;
  hint?: string;
}[] = [
  { key: "university", label: "University", on: true },
  { key: "season", label: "Season", on: true },
  { key: "division", label: "Division", on: true },
  { key: "program", label: "Program", on: true },
  { key: "scholarship", label: "Scholarship", on: true },
  {
    key: "playing",
    label: "Playing now",
    on: true,
    hint: "On a college roster right now — switch it here",
  },
  { key: "sport", label: "Sport", on: true },
  // Off by default: real fields, but a table showing all of them at once is a
  // table nobody can read. They are here for the days they are the question.
  { key: "position", label: "Position", on: false },
  { key: "nationality", label: "Nationality", on: false },
  { key: "previousClub", label: "Previous club", on: false },
  { key: "graduation", label: "Graduation", on: false },
];

const STORAGE_KEY = "eture-players-columns";
const DEFAULTS = COLUMNS.filter((c) => c.on).map((c) => c.key);

export function usePlayerColumns() {
  const [shown, setShown] = useState<ColumnKey[]>(DEFAULTS);

  // Read after mounting, not while rendering. The server has no localStorage,
  // so a choice read during render would make its markup and the first client
  // render disagree — React's word for that is a hydration error.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      // Filter against the current list: a key from an older version of the
      // app must not resurrect a column that no longer exists.
      const valid = parsed.filter((k): k is ColumnKey =>
        COLUMNS.some((c) => c.key === k)
      );
      setShown(valid);
    } catch {
      /* a corrupt or unavailable store just means the defaults */
    }
  }, []);

  function persist(next: ColumnKey[]) {
    setShown(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode, a full quota — the session still works, it just forgets */
    }
  }

  return {
    isOn: (k: ColumnKey) => shown.includes(k),
    toggle: (k: ColumnKey) =>
      persist(shown.includes(k) ? shown.filter((x) => x !== k) : [...shown, k]),
    reset: () => persist(DEFAULTS),
    count: shown.length,
  };
}

export function ColumnPicker({
  isOn,
  toggle,
  reset,
  /** `sport` is meaningless in a database with one sport */
  available,
}: {
  isOn: (k: ColumnKey) => boolean;
  toggle: (k: ColumnKey) => void;
  reset: () => void;
  available: ColumnKey[];
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: Event) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const options = COLUMNS.filter((c) => available.includes(c.key));
  // Only the columns someone has actually taken away. Counting the ones that
  // are off by default would open the page announcing "4 off", which reads as
  // something being wrong rather than as a choice not yet made.
  const hidden = options.filter((c) => c.on && !isOn(c.key)).length;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-1.5 rounded-full border border-ink-600 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-fg"
      >
        <ColumnsIcon />
        Columns
        {hidden > 0 && (
          <span className="badge bg-brand/15 px-1.5 py-0 text-[10px] text-brand">
            {hidden} off
          </span>
        )}
      </button>

      {open && (
        <div
          // Opaque, like the dialogs. This one sits directly over the table
          // it is changing, and a list of column names read through a list of
          // player names is two lists and no reading.
          className="sheet scroll-area popover-in absolute right-0 z-50 mt-1.5 max-h-80 w-56 overflow-y-auto rounded-xl p-1"
          role="group"
          aria-label="Columns shown in the table"
        >
          {options.map((c) => {
            const on = isOn(c.key);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.key)}
                role="switch"
                aria-checked={on}
                title={c.hint}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-ink-700/60"
              >
                <span
                  aria-hidden
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] leading-none ${
                    on
                      ? "border-brand bg-brand text-white"
                      : "border-ink-600 text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className={on ? "text-fg" : "text-muted"}>{c.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={reset}
            className="mt-1 w-full rounded-lg border-t border-ink-600 px-3 py-2 text-left text-xs text-muted hover:text-fg"
          >
            Reset to default
          </button>
        </div>
      )}
    </div>
  );
}

function ColumnsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16M15 4v16" />
    </svg>
  );
}
