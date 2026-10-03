"use client";

import { useRef, useEffect, useState } from "react";

const DESKTOP_ZOOM = 0.7;

/**
 * Single DOM tree for SSR + client (avoids React hydration #423).
 * Desktop scale is applied only after mount via inline styles.
 */
export function ExcelPreviewViewport({ children, scrollToStart = false }) {
  const frameRef = useRef(null);
  const scrollHostRef = useRef(null);
  const innerRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [layoutHeight, setLayoutHeight] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      const desktop = mq.matches;
      setIsDesktop(desktop);

      if (!desktop) {
        setLayoutHeight(0);
        return;
      }

      const inner = innerRef.current;
      if (!inner) return;
      setLayoutHeight(inner.offsetHeight * DESKTOP_ZOOM);
    };

    update();

    const inner = innerRef.current;
    const ro = inner ? new ResizeObserver(update) : null;
    if (ro && inner) ro.observe(inner);

    mq.addEventListener("change", update);
    return () => {
      mq.removeEventListener("change", update);
      ro?.disconnect();
    };
  }, [mounted, children]);

  useEffect(() => {
    if (!mounted || !scrollToStart) return;
    const scrollEl = scrollHostRef.current || frameRef.current;
    if (!scrollEl) return;
    scrollEl.scrollLeft = 0;
    scrollEl.scrollTop = 0;
  }, [mounted, scrollToStart, children]);

  const scaleStyle =
    mounted && isDesktop
      ? {
          transform: `scale(${DESKTOP_ZOOM})`,
          transformOrigin: "top center",
        }
      : undefined;

  const wrapperStyle =
    mounted && isDesktop && layoutHeight > 0
      ? { height: layoutHeight, width: "100%", display: "flex", justifyContent: "center" }
      : undefined;

  return (
    <div
      ref={frameRef}
      className="excel-preview-frame excel-preview-frame--responsive min-h-0 flex-1 rounded-none border border-[#a6a6a6]"
    >
      <p className="no-print excel-mobile-hint">Swipe left/right to view all columns</p>
      <div ref={scrollHostRef} className="excel-preview-scroll-host">
        <div className="excel-scale-outer" style={wrapperStyle}>
          <div ref={innerRef} className="excel-preview-inner" style={scaleStyle}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
