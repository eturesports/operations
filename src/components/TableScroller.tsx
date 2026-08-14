"use client";

import { useEffect, useRef } from "react";

/**
 * The box a wide table scrolls sideways in — and the reason the page still
 * scrolls when the mouse is over it.
 *
 * `overflow-x: auto` cannot be asked for on its own: the moment it is set,
 * `overflow-y` computes to `auto` too, and the box becomes a scroll container
 * in both directions. The browser then hands the whole wheel gesture to it,
 * including a straight-down scroll it has no room to absorb, and the gesture
 * dies there. On the players list that reads as: the page moves everywhere
 * except over the players.
 *
 * The listener sits on this element rather than on the document. An earlier
 * version walked up from the event target looking for a box like this one,
 * which meant a chain of guesses about which ancestor owned the gesture — it
 * worked in a test page and not on the real screen. Here there is nothing to
 * work out: this is the box, it never scrolls vertically, so a vertical wheel
 * over it belongs to the page.
 *
 * It only takes over when there is something to take over from — a table that
 * fits needs no help, and native scrolling should keep its own smoothing.
 */
export function TableScroller({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      const box = ref.current;
      if (!box) return;
      // Sideways gestures belong to the table. Shift+wheel is one of them by
      // convention, and some platforms deliver it as a vertical delta, so it
      // is named rather than inferred.
      if (!e.deltaY || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (e.shiftKey) return;
      if (e.defaultPrevented || e.ctrlKey) return; // ctrl+wheel is a zoom
      // Nothing to scroll sideways means nothing swallowed the wheel.
      if (box.scrollWidth <= box.clientWidth) return;

      // Deltas are not always pixels: Firefox reports lines, some setups pages.
      const px =
        e.deltaMode === 1
          ? e.deltaY * 16
          : e.deltaMode === 2
            ? e.deltaY * window.innerHeight
            : e.deltaY;

      const doc = document.scrollingElement ?? document.documentElement;
      e.preventDefault();
      doc.scrollTop += px;
    }

    // Not passive: taking the gesture over means being allowed to cancel it.
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div ref={ref} className={`scroll-area overflow-x-auto ${className}`.trim()}>
      {children}
    </div>
  );
}
