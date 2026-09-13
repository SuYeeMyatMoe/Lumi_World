import { useEffect, useRef, type RefObject } from 'react';

export interface LookTarget {
  yaw: number;
  pitch: number;
}

// Either a viewport-space point in the same window as the mascot, or a
// pre-normalized direction (-1..1) when the focus lives in another window (side panel).
export type MascotTarget = { x: number; y: number; normalized?: false } | { nx: number; ny: number; normalized: true };

const MAX_YAW = (35 * Math.PI) / 180;
const MAX_PITCH = (15 * Math.PI) / 180;

export function useLookAt(
  containerRef: RefObject<HTMLElement>,
  target: MascotTarget | null,
  cursorFallback = true,
): RefObject<LookTarget | null> {
  const lookRef = useRef<LookTarget | null>(null);
  const cursorRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!cursorFallback) return;
    const onMove = (e: MouseEvent) => {
      cursorRef.current = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => {
      cursorRef.current = null;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, [cursorFallback]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = containerRef.current;
      if (target?.normalized) {
        lookRef.current = { yaw: clamp(target.nx) * MAX_YAW, pitch: clamp(target.ny) * MAX_PITCH };
      } else {
        const point = target ?? cursorRef.current;
        if (!el || !point) {
          lookRef.current = null;
        } else {
          const rect = el.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const nx = clamp((point.x - cx) / (window.innerWidth * 0.6));
          const ny = clamp((point.y - cy) / (window.innerHeight * 0.6));
          lookRef.current = { yaw: nx * MAX_YAW, pitch: ny * MAX_PITCH };
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [containerRef, target]);

  return lookRef;
}

function clamp(v: number): number {
  return Math.max(-1, Math.min(1, v));
}
