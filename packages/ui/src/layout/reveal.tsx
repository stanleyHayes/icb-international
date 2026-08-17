'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '../lib/cn';

/**
 * Scroll-triggered reveal.
 *
 * Content starts at opacity 0 / translateY(14px) and transitions in the first time it enters
 * the viewport (IntersectionObserver, once, then disconnects). The `delay` prop staggers
 * siblings — 30–80ms steps, never blocking interaction. Without JS or IntersectionObserver
 * the content renders visible (fails open, never hides content).
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: Readonly<{ children: ReactNode; className?: string; delay?: number }>) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-visible={visible}
      className={cn('icb-reveal', className)}
      style={delay > 0 ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
