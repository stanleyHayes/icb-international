/**
 * Hand-rolled windowing for DataTable.
 *
 * @tanstack/react-virtual is deliberately not a dependency: rows here are a fixed height, so a
 * scroll offset and a viewport height are all the maths a window needs. `enabled` keeps the hook
 * inert for short tables, where rendering every row is cheaper than measuring.
 */
import { useEffect, useRef, useState } from 'react';

export interface VirtualRowsOptions {
  rowCount: number;
  rowHeight: number;
  overscan: number;
  enabled: boolean;
}

export interface VirtualRows {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  startIndex: number;
  endIndex: number;
  paddingTop: number;
  paddingBottom: number;
}

export function useVirtualRows({ rowCount, rowHeight, overscan, enabled }: VirtualRowsOptions): VirtualRows {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || container === null) {
      return;
    }
    setViewportHeight(container.clientHeight);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setViewportHeight(entry.contentRect.height);
      }
    });
    observer.observe(container);
    return () => { observer.disconnect(); };
  }, [enabled]);

  if (!enabled) {
    return { containerRef, onScroll: () => undefined, startIndex: 0, endIndex: rowCount, paddingTop: 0, paddingBottom: 0 };
  }

  const firstVisible = Math.floor(scrollTop / rowHeight);
  const startIndex = Math.max(0, firstVisible - overscan);
  const endIndex = Math.min(rowCount, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);

  return {
    containerRef,
    onScroll: (event) => { setScrollTop(event.currentTarget.scrollTop); },
    startIndex,
    endIndex,
    paddingTop: startIndex * rowHeight,
    paddingBottom: (rowCount - endIndex) * rowHeight,
  };
}
