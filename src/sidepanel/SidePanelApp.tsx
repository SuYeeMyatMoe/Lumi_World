import { useEffect, useState } from 'react';
import { useLocalStorage } from '../shared/storage/useChromeStorage';
import { hideOverlay, isOverlayHidden, showOverlay } from '../shared/overlayVisibility';
import { BRAND } from '../shared/constants';
import { LumiMascotFull } from './LumiMascotFull';
import { MissionPanel } from './panels/MissionPanel';
import { MemoryPanel } from './panels/MemoryPanel';
import { ComparePanel } from './panels/ComparePanel';
import { FallbackPanel } from './panels/FallbackPanel';
import { TrustPanel } from './panels/TrustPanel';

function tabOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function SidePanelApp() {
  const settings = useLocalStorage('lumiSettings');
  const hiddenOrigins = useLocalStorage('hiddenOrigins');
  const memory = useLocalStorage('lumiMemory');
  const [selected, setSelected] = useState<string[]>([]);
  const [pageOrigin, setPageOrigin] = useState<string | null>(null);

  useEffect(() => {
    const readOrigin = () => {
      if (!chrome.tabs?.query) return;
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
        setPageOrigin(tabOrigin(tab?.url));
      });
    };
    readOrigin();
    chrome.tabs.onActivated?.addListener(readOrigin);
    chrome.tabs.onUpdated?.addListener(readOrigin);
    return () => {
      chrome.tabs.onActivated?.removeListener(readOrigin);
      chrome.tabs.onUpdated?.removeListener(readOrigin);
    };
  }, []);

  useEffect(() => {
    if (!chrome.tabs?.query) return;
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
      const origin = tabOrigin(tab?.url);
      if (origin) void showOverlay(origin);
    });
  }, []);

  // Drop selections for objects that were forgotten.
  useEffect(() => {
    setSelected((prev) => prev.filter((id) => memory.items.some((i) => i.id === id)));
  }, [memory.items]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev.slice(-1), id];
    });
  };

  const hasKey = settings.openaiApiKey.trim().length > 0;
  const overlayVisible = pageOrigin ? !isOverlayHidden(hiddenOrigins, pageOrigin) : true;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      {/* Bar: wordmark left, two ghost actions right. One line at every width. */}
      <header className="sticky top-0 z-10 border-b border-lumi-border/60 bg-lumi-bg/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden className="h-6 w-6 shrink-0 rounded-lg bg-cta shadow-cta" />
            <div className="min-w-0">
              <h1 className="truncate text-[13px] font-bold tracking-tight">{BRAND.name}</h1>
              <p className="hidden truncate text-[10.5px] text-lumi-muted min-[360px]:block">{BRAND.tagline}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
          <button
            className="lumi-btn !min-h-8 !py-1 !px-2.5"
            disabled={!pageOrigin}
            onClick={() => {
              if (!pageOrigin) return;
              void (overlayVisible ? hideOverlay(pageOrigin) : showOverlay(pageOrigin));
            }}
            title={overlayVisible ? 'Hide Lumi on this site' : 'Show Lumi on this site'}
          >
            {overlayVisible ? 'Hide' : 'Show'}
          </button>
          <button className="lumi-btn !min-h-8 !py-1 !px-2.5" onClick={() => chrome.runtime.openOptionsPage()} title="Options" aria-label="Options">
            Options
          </button>
          </div>
        </div>
      </header>

      {/*
        Layout: single column inside Chrome's side panel (~320-420px) and on phones.
        Opened as a full page (demo / tablet / desktop) it becomes two columns so the
        panel never stretches into a 1400px-wide strip.
      */}
      <main className="mx-auto grid w-full max-w-5xl flex-1 auto-rows-min grid-cols-1 gap-3 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 md:grid-cols-2 md:items-start md:gap-4">
        {/* Column 1: mascot, notices, mission. Trust is placed below this at md via col-start. */}
        <div className="flex flex-col gap-3 md:gap-4">
        <LumiMascotFull />

        {!overlayVisible && pageOrigin && (
          <div className="lumi-raised flex items-center justify-between gap-3 p-3 text-[11.5px]">
            <div className="min-w-0">
              <p className="font-semibold">Lumi is closed on this site</p>
              <p className="mt-0.5 text-lumi-muted">Other websites are unchanged.</p>
            </div>
            <button className="lumi-btn-primary shrink-0 !min-h-8 !py-1 !px-3" onClick={() => void showOverlay(pageOrigin)}>
              Show Lumi
            </button>
          </div>
        )}

        {!hasKey && (
          <div className="lumi-raised border-l-2 border-l-lumi-warn p-3 text-[11.5px]">
            <p className="font-semibold text-lumi-warn">No OpenAI key yet</p>
            <p className="mt-0.5 text-lumi-muted">Focus and memory work without it. Add a key to unlock compare, scoring and form fill.</p>
            <button className="lumi-btn mt-2.5 !min-h-8 !py-1 !px-3" onClick={() => chrome.runtime.openOptionsPage()}>
              Open Options
            </button>
          </div>
        )}

        <MissionPanel />
        </div>

        {/* Column 2 spans both rows so Memory + Compare flow independently of column 1. */}
        <div className="flex flex-col gap-3 md:row-span-2 md:gap-4">
        <MemoryPanel selected={selected} onToggle={toggle} />
        <ComparePanel selected={selected} />
        <FallbackPanel />
        </div>

        {/* Last in DOM (mobile order preserved), but slots under Mission on wide screens. */}
        <div className="md:col-start-1">
        <TrustPanel />
        </div>
      </main>

      <footer className="px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[10px] text-lumi-muted/70">Don't describe it. Point at it.</footer>
    </div>
  );
}
