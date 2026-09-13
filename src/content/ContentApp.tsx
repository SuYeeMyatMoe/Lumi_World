import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LumiMascot } from '../mascot/LumiMascot';
import { useAgentState } from '../mascot/useAgentState';
import type { MascotTarget } from '../mascot/useLookAt';
import { useLocalStorage } from '../shared/storage/useChromeStorage';
import { hideOverlay, isOverlayHidden, showOverlay } from '../shared/overlayVisibility';
import { sendMessage } from '../shared/messaging/sendMessage';
import { createSnapshot } from '../shared/dom/elementSnapshot';
import { startFocusEngine } from './focusEngine';
import { HighlightOverlay } from './highlightOverlay';
import { PreviewOverlay } from './previewOverlay';
import { LUMI_HIGHLIGHT_EVENT } from './events';

interface Props {
  shadowHost: HTMLElement;
}

export function ContentApp({ shadowHost }: Props) {
  const live = useAgentState();
  const hiddenOrigins = useLocalStorage('hiddenOrigins');
  const overlayVisible = !isOverlayHidden(hiddenOrigins);
  const pendingPreview = useLocalStorage('pendingPreview');
  const actionLog = useLocalStorage('actionLog');
  const [hoverTarget, setHoverTarget] = useState<Element | null>(null);
  const [pinnedTarget, setPinnedTarget] = useState<Element | null>(null);
  // Set while the background is acting on this element; cleared when it releases it.
  const [workingTarget, setWorkingTarget] = useState<Element | null>(null);
  const [localBubble, setLocalBubble] = useState<string | null>(null);
  const [tabId, setTabId] = useState<number | null>(null);
  const pinnedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    sendMessage({ type: 'GET_TAB_ID' }).then((r) => {
      if (r.ok) setTabId(r.data);
    });
  }, []);

  const reportHover = useCallback((el: Element | null) => {
    if (!el) {
      sendMessage({ type: 'FOCUS_HOVER', pos: null });
      return;
    }
    const r = el.getBoundingClientRect();
    sendMessage({
      type: 'FOCUS_HOVER',
      pos: { x: r.left + r.width / 2, y: r.top + r.height / 2, vw: window.innerWidth, vh: window.innerHeight },
    });
  }, []);

  const pin = useCallback(async (el: Element) => {
    const snapshot = createSnapshot(el);
    if (!snapshot) {
      setLocalBubble("I won't touch that. It looks sensitive.");
      setTimeout(() => setLocalBubble(null), 2200);
      return;
    }
    const result = await sendMessage({ type: 'FOCUS_PINNED', snapshot });
    if (result.ok) {
      setPinnedTarget(el);
      if (pinnedTimer.current) clearTimeout(pinnedTimer.current);
      pinnedTimer.current = setTimeout(() => setPinnedTarget(null), 1600);
    }
  }, []);

  const closeLumi = useCallback((e: React.MouseEvent) => {
    if (e.detail > 1) return;
    e.stopPropagation();
    void hideOverlay();
    void sendMessage({ type: 'FOCUS_HOVER', pos: null });
  }, []);

  const openLumi = useCallback(() => {
    void showOverlay();
  }, []);

  const openSidePanel = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    void showOverlay();
    try {
      if (tabId !== null && chrome.sidePanel?.open) {
        void chrome.sidePanel.open({ tabId }).catch(() => {
          void sendMessage({ type: 'OPEN_SIDE_PANEL' });
        });
        return;
      }
    } catch {
      /* sidePanel may be missing in preview or after a reload */
    }
    void sendMessage({ type: 'OPEN_SIDE_PANEL' });
  }, [tabId]);

  const openSidePanelRef = useRef(openSidePanel);
  openSidePanelRef.current = openSidePanel;

  useEffect(() => {
    if (!overlayVisible) {
      setHoverTarget(null);
      setPinnedTarget(null);
      void sendMessage({ type: 'FOCUS_HOVER', pos: null });
      return;
    }
    const stop = startFocusEngine(shadowHost, {
      onHover: (el) => {
        setHoverTarget(el);
        reportHover(el);
      },
      onPinRequest: pin,
      onOpenPanel: () => openSidePanelRef.current(),
    });
    return stop;
  }, [shadowHost, reportHover, pin, overlayVisible]);

  // "Show on page" from the side panel: flash the remembered element.
  useEffect(() => {
    const onHighlight = (e: Event) => {
      const detail = (e as CustomEvent<{ el: Element | null; mode: 'focus' | 'working' } | Element | null>).detail;
      const el = detail && 'el' in (detail as object) ? (detail as { el: Element | null }).el : (detail as Element | null);
      const mode = detail && 'mode' in (detail as object) ? (detail as { mode: 'focus' | 'working' }).mode : 'focus';

      if (mode === 'working') {
        // Held, not timed out: the amber outline stays for as long as the action does,
        // and a null selector is how the background says it has finished.
        setWorkingTarget(el);
        return;
      }
      if (!el) return;
      setPinnedTarget(el);
      if (pinnedTimer.current) clearTimeout(pinnedTimer.current);
      pinnedTimer.current = setTimeout(() => setPinnedTarget(null), 2400);
    };
    window.addEventListener(LUMI_HIGHLIGHT_EVENT, onHighlight);
    return () => window.removeEventListener(LUMI_HIGHLIGHT_EVENT, onHighlight);
  }, []);

  // Keep the reported focus position fresh while scrolling.
  useEffect(() => {
    if (!hoverTarget) return;
    const onScroll = () => reportHover(hoverTarget);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [hoverTarget, reportHover]);

  const target = useMemo<MascotTarget | null>(() => {
    const el = workingTarget ?? pinnedTarget ?? hoverTarget;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, [hoverTarget, pinnedTarget, workingTarget]);

  const previewForThisTab = pendingPreview && tabId !== null && pendingPreview.tabId === tabId ? pendingPreview : null;
  const previewAction = previewForThisTab ? actionLog.find((a) => a.id === previewForThisTab.actionId) ?? null : null;

  const bubble = localBubble ?? live.message ?? null;
  const bubbleClass = localBubble ? 'warning' : live.state;

  const snapshotLabel = useMemo(() => (hoverTarget ? createSnapshot(hoverTarget)?.extracted.label?.slice(0, 32) : undefined), [hoverTarget]);

  if (!overlayVisible) {
    return (
      <button
        type="button"
        className="lumi-reopen"
        title="Open Lumi"
        aria-label="Open Lumi"
        onClick={openLumi}
        onDoubleClick={openSidePanel}
      >
        Lumi
      </button>
    );
  }

  return (
    <>
      <HighlightOverlay
        target={workingTarget ?? pinnedTarget ?? hoverTarget}
        pinned={pinnedTarget !== null}
        working={workingTarget !== null}
        label={snapshotLabel}
      />

      {previewForThisTab && <PreviewOverlay preview={previewForThisTab} action={previewAction} />}

      <div className="lumi-widget">
        {bubble && <div className={`lumi-bubble ${bubbleClass}`}>{bubble}</div>}
        <button type="button" className="lumi-widget-close" title="Close Lumi" aria-label="Close Lumi" onClick={closeLumi}>
          ×
        </button>
        <div
          className="lumi-widget-canvas"
          title="Open Lumi Space"
          onClick={openSidePanel}
          onDoubleClick={openSidePanel}
        >
          <LumiMascot state={live.state} target={target} size="mini" />
        </div>
      </div>
    </>
  );
}
