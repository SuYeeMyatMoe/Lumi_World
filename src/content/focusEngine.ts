import { resolveFocusTarget } from '../shared/dom/elementSnapshot';

export interface FocusEngineCallbacks {
  onHover: (el: Element | null) => void;
  onPinRequest: (el: Element) => void;
}

const HOVER_DEBOUNCE_MS = 120;

// Attaches page-level listeners. Elements inside `ignoreRoot` (our own shadow host) are skipped.
export function startFocusEngine(ignoreRoot: HTMLElement, callbacks: FocusEngineCallbacks): () => void {
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let current: Element | null = null;
  let altHeld = false;

  const clearHover = () => {
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = null;
  };

  const onMove = (e: MouseEvent) => {
    const raw = e.target as Element | null;
    if (!raw || ignoreRoot.contains(raw) || raw === ignoreRoot) return;
    clearHover();
    hoverTimer = setTimeout(() => {
      const target = resolveFocusTarget(raw);
      if (target !== current) {
        current = target;
        callbacks.onHover(target);
      }
    }, HOVER_DEBOUNCE_MS);
  };

  const onLeave = () => {
    clearHover();
    current = null;
    callbacks.onHover(null);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Alt') altHeld = true;
    // Alt+L pins the currently hovered element ("Lumi, remember this")
    if (altHeld && (e.key === 'l' || e.key === 'L') && current) {
      e.preventDefault();
      callbacks.onPinRequest(current);
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Alt') altHeld = false;
  };

  const onClick = (e: MouseEvent) => {
    if (!e.altKey) return;
    const raw = e.target as Element | null;
    if (!raw || ignoreRoot.contains(raw)) return;
    const target = resolveFocusTarget(raw);
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    callbacks.onPinRequest(target);
  };

  document.addEventListener('mousemove', onMove, { passive: true, capture: true });
  document.addEventListener('mouseleave', onLeave);
  window.addEventListener('blur', onLeave);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
  document.addEventListener('click', onClick, true);

  return () => {
    clearHover();
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseleave', onLeave);
    window.removeEventListener('blur', onLeave);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('keyup', onKeyUp, true);
    document.removeEventListener('click', onClick, true);
  };
}
