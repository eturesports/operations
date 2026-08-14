"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// The measurement has to happen before the browser paints, or a wide table
// spills for a frame before the box is told to scroll. On the server there is
// no layout to measure, so it degrades to the ordinary effect.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * The box a wide table scrolls sideways in — and the reason the page still
 * scrolls when the mouse is over it.
 *
 * This has been wrong three times, each time because the box kept being a
 * scroll container. Two things make that fatal, and only one of them is CSS:
 *
 *  1. `overflow-x: auto` cannot be asked for on its own. `overflow-y`
 *     computes to `auto` beside it, so the box becomes a scroll container
 *     vertically as well, with no room to scroll — and a downward wheel dies
 *     in it. `overflow-y: clip` is the only value CSS allows here that takes
 *     that away, and `.scroll-x` uses it.
 *
 *  2. Chrome latches a wheel gesture to the scroll container under the
 *     cursor when the gesture begins, and keeps it there for the rest of the
 *     gesture — it will not hand it up to the page until the wheel stops.
 *     Spin a mouse wheel steadily on Windows and the stop never comes. No
 *     CSS property changes this. It is also invisible to a synthetic wheel
 *     event, which is one event and therefore a gesture that ends
 *     immediately: this reproduces on a real desktop and not in a test.
 *
 * So the box is only a scroll container while it has something to scroll.
 * A table that fits gets no `overflow` at all — nothing to latch onto,
 * nothing to swallow the wheel, the page scrolls natively. A table that does
 * not fit gets the sideways scroll it needs, and a wheel handler that takes
 * the vertical part of the gesture and gives it to the page by hand, which
 * is the one thing latching cannot interfere with.
 */
export function TableScroller({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  // The handler is attached once and reads this, so it never goes stale.
  const wideRef = useRef(false);
  wideRef.current = wide;

  // Does the table need the sideways scroll? It depends on the window, on
  // which columns are showing and on rows still arriving, so it is watched
  // rather than decided once.
  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Measured on the table, not on the box: `scrollWidth` is the width of a
    // scrolling area, and while the box is not scrolling there is not one to
    // report. The table's own width is the same either way.
    const measure = () => {
      const table = el.firstElementChild;
      const need = table ? table.getBoundingClientRect().width : el.scrollWidth;
      setWide(need > el.clientWidth + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      // Nothing is scrolling sideways, so nothing has taken the gesture.
      if (!wideRef.current) return;
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
    <div ref={ref} className={`${wide ? "scroll-area scroll-x" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}
