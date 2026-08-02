"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);

    // Held rather than assumed: another dialog may already have locked the
    // page, and restoring a guess would scroll the page on close.
    const { body } = document;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.overflow = previous;
    };
  }, [onClose]);
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
