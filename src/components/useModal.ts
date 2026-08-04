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

/** The shell every dialog shares: a sheet rising from the bottom edge on a
 *  phone, a centred card on a desktop, never taller than the visible window.
 *
 *  Real glass here, unlike the panels on the page: a dialog is the one place
 *  the blur has something to do, since the page it covers shows through. */
export const MODAL_BACKDROP =
  "scrim-in fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4";

export const MODAL_PANEL =
  "glass glass-rim sheet-in scroll-area max-h-[92dvh] w-full overflow-y-auto rounded-2xl rounded-b-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-h-[90dvh] sm:rounded-b-2xl sm:p-6 sm:pb-6";
