"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * The moving highlight behind a set of tabs: one surface that flows to where
 * you are, rather than a colour switching off in one place and on in another.
 *
 * The measurements come from the live elements, so a tab bar can hold any
 * labels at any width and the pill still fits. Give the container
 * `position: relative` and render the pill as its first child.
 */
export function useTravellingPill<T extends HTMLElement = HTMLDivElement>(
  activeIndex: number
) {
  const container = useRef<T>(null);
  const items = useRef<(HTMLElement | null)[]>([]);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  // The first paint places the pill without animating it; only later moves
  // should travel, or every page load would begin with it sliding in.
  const [settled, setSettled] = useState(false);

  const place = useCallback(() => {
    const el = activeIndex >= 0 ? items.current[activeIndex] : null;
    setPill(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
  }, [activeIndex]);

  useLayoutEffect(place, [place]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setSettled(true));
    // Labels reflow between breakpoints, so the pill is re-measured with them.
    const observer = new ResizeObserver(place);
    if (container.current) observer.observe(container.current);
    return () => {
      cancelAnimationFrame(id);
      observer.disconnect();
    };
  }, [place]);

  return { container, items, pill, settled };
}

/** Puts the specular highlight where the pointer is. */
export function trackPointer(e: React.PointerEvent<HTMLElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
}
