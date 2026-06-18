import { useEffect, type RefObject } from "react";

/** Keep new log lines visible without scrolling the page. */
export function useLogViewerScroll(
  viewerRef: RefObject<HTMLDivElement | null>,
  itemCount: number,
) {
  useEffect(() => {
    if (itemCount === 0) return;
    const el = viewerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [itemCount, viewerRef]);
}
