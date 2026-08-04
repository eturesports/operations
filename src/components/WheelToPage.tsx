"use client";

import { useEffect } from "react";

/**
 * Lets the wheel reach the page when the pointer is resting on a table.
 *
 * Every table here sits in a wrapper that scrolls sideways, because the
 * columns need more width than a narrow window has. That wrapper is a scroll
 * container, and the browser hands the whole wheel gesture to the innermost
 * scroll container under the pointer — including a straight-down scroll it
 * has no room to absorb. The gesture is swallowed: put the mouse on the
 * players list and the page stops moving.
 *
 * Measured on the real players screen in Chromium. At 1024px and wider the
 * table fits and six notches of the wheel moved the page 720px. At 960px the
 * table needed 17px more than it had, and the same six notches moved the page
 * 240px — it scrolled until the table slid under the pointer, then stopped
 * dead. Narrower windows, or a browser zoomed in, make it worse. Widening
 * `overscroll-behavior` changes nothing, which is why the CSS was not the fix.
 *
 * So when the wheel lands on something that can only scroll sideways, we
 * scroll the page ourselves. Anything that can genuinely scroll up and down —
 * a dialog, a dropdown — is left alone, and so is a sideways trackpad swipe.
 */
export function WheelToPage() {
  useEffect(() => {
    function scrolls(overflow: string, room: boolean) {
      return room && (overflow === "auto" || overflow === "scroll");
    }

    /** The element that swallowed the wheel, or null if nothing did. */
    function sidewaysOnlyBox(from: Element): Element | null {
      for (let n: Element | null = from; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        // Something that can scroll down takes its own wheel; leave it be.
        if (scrolls(cs.overflowY, n.scrollHeight > n.clientHeight)) return null;
        if (scrolls(cs.overflowX, n.scrollWidth > n.clientWidth)) return n;
      }
      return null;
    }

    /** What should have taken the scroll: the nearest ancestor with somewhere
     *  to go, or the page. */
    function receiverFor(el: Element): Element {
      for (let n = el.parentElement; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (scrolls(cs.overflowY, n.scrollHeight > n.clientHeight)) return n;
      }
      return document.scrollingElement ?? document.documentElement;
    }

    // Answering the question means reading layout, and a trackpad can fire a
    // hundred times a second. A gesture stays over the same element, so the
    // answer is worked out once and reused until the pointer moves on.
    let cachedFor: Element | null = null;
    let cachedBox: Element | null = null;
    let cachedAt = 0;

    function onWheel(e: WheelEvent) {
      // Sideways gestures belong to the table; let them through untouched.
      if (!e.deltaY || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (e.defaultPrevented || e.ctrlKey) return; // ctrl+wheel is a zoom
      if (!(e.target instanceof Element)) return;

      const now = e.timeStamp;
      if (e.target !== cachedFor || now - cachedAt > 250) {
        cachedFor = e.target;
        cachedBox = sidewaysOnlyBox(e.target);
      }
      cachedAt = now;
      if (!cachedBox) return; // nothing swallowed it; the browser is fine

      // Deltas are not always pixels: Firefox reports lines, and some setups
      // report pages. Taken literally, either would crawl.
      const px =
        e.deltaMode === 1
          ? e.deltaY * 16
          : e.deltaMode === 2
            ? e.deltaY * window.innerHeight
            : e.deltaY;

      e.preventDefault();
      receiverFor(cachedBox).scrollTop += px;
    }

    // Not passive: taking the gesture over means being allowed to cancel it.
    document.addEventListener("wheel", onWheel, { passive: false });
    return () => document.removeEventListener("wheel", onWheel);
  }, []);

  return null;
}
