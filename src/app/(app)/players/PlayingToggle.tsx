"use client";

import { useState } from "react";

/**
 * Whether this player is on a college roster right now, switched from the
 * list rather than from inside the edit form.
 *
 * It was four steps: open the record, open Edit, scroll past the photos and
 * the links to "Currently playing in college soccer", choose, save. For a
 * fact that changes every August across the whole database, that is three
 * steps too many.
 *
 * It answers immediately and puts itself back if the server disagrees. The
 * one way it can disagree is worth knowing: "playing now" is not a flag on
 * the player, it is a college profile marked as current — so a player with no
 * university has nothing to mark, and the server says so rather than
 * inventing one.
 */
export function PlayingToggle({
  playing,
  disabled,
  onChange,
  name,
}: {
  playing: boolean;
  disabled?: boolean;
  /** resolves false when the server refused, so the switch can go back */
  onChange: (next: boolean) => Promise<boolean>;
  name: string;
}) {
  const [busy, setBusy] = useState(false);
  // What the switch shows while the request is in the air.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const on = optimistic ?? playing;

  async function flip() {
    if (busy || disabled) return;
    const next = !on;
    setOptimistic(next);
    setBusy(true);
    try {
      const ok = await onChange(next);
      if (!ok) setOptimistic(null);
    } finally {
      setBusy(false);
      // The row's own value has caught up by now; stop overriding it.
      setOptimistic(null);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${name} is ${on ? "playing now" : "not playing"}`}
      title={
        disabled
          ? undefined
          : on
            ? "On a roster now — click to clear"
            : "Click to mark as playing now"
      }
      disabled={disabled || busy}
      onClick={(e) => {
        e.stopPropagation();
        flip();
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        on ? "bg-emerald-500" : "bg-ink-600"
      } ${disabled ? "" : "cursor-pointer"}`}
    >
      <span
        aria-hidden
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          on ? "translate-x-[1.125rem]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
