"use client";

import { useEffect, useRef } from "react";

// Shared by every dialog on the page, so the page is released once.
let openModals = 0;
let restoreOverflow = "";

/**
 * What every dialog in the app owes the person using it: Escape closes it,
 * and the page behind stops moving while it is open.
 *
 * The second half matters most on a phone. Without it, a scroll that starts
 * on the dialog carries on into the page underneath, so closing the dialog
 * leaves you somewhere you never navigated to — and on iOS the page can be
 * left scrolled under the address bar with no way back.
 */
export function useModal(onClose: () => void) {
  // Escape is re-read through a ref so the lock below never depends on it.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close.current();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // The lock is counted, not remembered.
  //
  // Remembering it was the bug: this effect used to depend on `onClose`,
  // which callers pass as an inline arrow and is therefore a new function on
  // every render. The effect re-ran, captured `overflow` while the page was
  // *already* locked, and on close restored that — leaving `hidden` behind
  // and the players list unable to scroll until a reload. Counting depth
  // also makes a dialog opened from a dialog behave: the page is released
  // when the last one goes, not when the first does.
  useEffect(() => {
    const { body } = document;
    if (openModals === 0) restoreOverflow = body.style.overflow;
    openModals += 1;
    body.style.overflow = "hidden";

    return () => {
      openModals -= 1;
      if (openModals === 0) body.style.overflow = restoreOverflow;
    };
  }, []);
}

/**
 * The shell every dialog shares: a sheet rising from the bottom edge on a
 * phone, a centred card on a desktop, never taller than the visible window.
 *
 * It is built in three parts — a title that stays, a middle that scrolls, and
 * the actions held at the bottom — rather than one scrolling box with things
 * stuck to its edges. That was the earlier version, and the seam showed: the
 * bar at the bottom had to be widened past the panel's own padding with
 * negative margins to cover the full width, which made the panel scrollable
 * sideways and left the bar hanging over the rounded corner, cut off beside
 * the scrollbar. Here the panel does not scroll at all. Only the middle does,
 * so the scrollbar starts below the title and ends above the actions, and
 * nothing has to reach past anything.
 *
 * Opaque, too. Glass is for chrome that floats over content you are meant to
 * keep seeing; a form is not that. Reading a long form through a table of
 * other players' names is not a texture, it is noise.
 */
export const MODAL_BACKDROP =
  "scrim-in fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4";

export const MODAL_PANEL =
  "sheet sheet-in flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-2xl rounded-b-none sm:max-h-[90dvh] sm:rounded-b-2xl";

export const MODAL_HEADER =
  "flex shrink-0 items-start justify-between gap-3 border-b border-ink-600 px-5 py-3.5 sm:px-6";

export const MODAL_BODY = "scroll-area min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6";

export const MODAL_FOOTER =
  "flex shrink-0 justify-end gap-2 border-t border-ink-600 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-3";
