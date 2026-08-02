"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * How much of a long list is actually put on the screen.
 *
 * The database is held in the browser so that filtering is instant, but
 * holding seven hundred records is not the same as drawing them: every one
 * that exists in the document is laid out, painted and re-rendered on each
 * keystroke, which is what makes a phone stutter and the search box lag
 * behind the typing.
 *
 * So the list grows as it is read. `sentinel` goes at the end of the rendered
 * rows; when it comes into view the next page is added, a screenful ahead of
 * where the reader is. Nothing else changes: filters, counts, selection, the
 * CSV and the stats all still work on the whole list, because only the
 * drawing is paged.
 */
export function usePagedList(total: number, page = 60) {
  const [count, setCount] = useState(page);
  const sentinel = useRef<HTMLDivElement>(null);

  // A new filter is a new list, and it starts at the top.
  useEffect(() => {
    setCount(page);
  }, [total, page]);

  const more = useCallback(() => setCount((c) => Math.min(c + page, total)), [page, total]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || count >= total) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) more();
      },
      // Loaded before it is reached, so the list never visibly runs out.
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [count, total, more]);

  return { count: Math.min(count, total), sentinel, more, done: count >= total };
}
