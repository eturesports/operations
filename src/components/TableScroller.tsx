"use client";

import { useEffect, useRef } from "react";

/**
 * The box a wide table scrolls sideways in — and the reason the page still
 * scrolls when the mouse is over it.
 *
 * The cause is in `.scroll-x` (globals.css): asking for `overflow-x: auto`
 * silently makes the box a scroll container vertically as well, and a
 * downward wheel over it is then swallowed by a box with nowhere to go.
 * `overflow-y: clip` is the value that takes that away, and with it gone the
 * browser scrolls the page itself, with its own smoothing.
 *
 * The handler below is what happens where `clip` is not understood — Safari
 * before 16, Chrome before 90. There it does by hand what the CSS does
 * everywhere else: takes a vertical wheel that the box cannot use and gives
 * it to the page. It costs one `CSS.supports` call to find out, and on every
 * current browser it attaches nothing at all.
 *
 * An earlier version ran this handler unconditionally, and before that, one
 * that walked up from the event target guessing which ancestor owned the
 * gesture. Imitating a scroll is the part to avoid: it is right in a test
 * page and wrong on a real screen, in ways that depend on the browser, the
 * mouse and the moment. Removing the reason the browser withheld the scroll
 * is not.
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
    // Where the CSS above holds, there is no vertical scroll container left
    // to rescue the gesture from.
    if (typeof CSS !== "undefined" && CSS.supports?.("overflow-y", "clip")) return;

    function onWheel(e: WheelEvent) {
      const box = ref.current;
      if (!box) return;
      // Sideways gestures belong to the table. Shift+wheel is one of them by
      // convention, and some platforms deliver it as a vertical delta, so it
      // is named rather than inferred.
      if (!e.deltaY || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (e.shiftKey) return;
      if (e.defaultPrevented || e.ctrlKey) return; // ctrl+wheel is a zoom

      // Deltas are not always pixels: Firefox reports lines, some setups pages.
      const px =
        e.deltaMode === 1
          ? e.deltaY * 16
          : e.deltaMode === 2
            ? e.deltaY * window.innerHeight
            : e.deltaY;

      e.preventDefault();
      window.scrollBy(0, px);
    }

    // Not passive: taking the gesture over means being allowed to cancel it.
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div ref={ref} className={`scroll-area scroll-x ${className}`.trim()}>
      {children}
    </div>
  );
}
