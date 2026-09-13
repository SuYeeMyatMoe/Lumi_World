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
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-lumi-border bg-lumi-bg/90 px-4 py-2.5 backdrop-blur">
        <div>
          <h1 className="text-sm font-bold tracking-tight">{BRAND.name}</h1>
          <p className="text-[10.5px] text-lumi-muted">{BRAND.tagline}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className="lumi-btn !py-1 !px-2"
            disabled={!pageOrigin}
            onClick={() => {
              if (!pageOrigin) return;
              void (overlayVisible ? hideOverlay(pageOrigin) : showOverlay(pageOrigin));
            }}
            title={overlayVisible ? 'Hide Lumi on this site' : 'Show Lumi on this site'}
          >
            {overlayVisible ? 'Hide' : 'Show'}
          </button>
          <button className="lumi-btn !py-1 !px-2" onClick={() => chrome.runtime.openOptionsPage()} title="Options">
            ⚙
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 p-3">
        <LumiMascotFull />

        {!overlayVisible && pageOrigin && (
          <div className="rounded-lg border border-lumi-border bg-black/20 p-2.5 text-[11.5px]">
            <p className="font-semibold">Lumi is closed on this site</p>
            <p className="mt-0.5 text-lumi-muted">Other websites are unchanged. Click Show to bring it back here.</p>
            <button className="lumi-btn-primary mt-2 !py-1 !px-2" onClick={() => void showOverlay(pageOrigin)}>
              Show Lumi
            </button>
          </div>
        )}

        {!hasKey && (
          <div className="rounded-lg border border-lumi-warn/40 bg-lumi-warn/5 p-2.5 text-[11.5px]">
            <p className="font-semibold text-lumi-warn">No OpenAI key yet</p>
            <p className="mt-0.5 text-lumi-muted">Focus and memory work without it. Add a key in Options to unlock compare, scoring and form fill.</p>
            <button className="lumi-btn mt-2 !py-1 !px-2" onClick={() => chrome.runtime.openOptionsPage()}>
              Open Options
            </button>
          </div>
        )}

        <MissionPanel />
        <MemoryPanel selected={selected} onToggle={toggle} />
        <ComparePanel selected={selected} />
        <FallbackPanel />
        <TrustPanel />
      </main>

      <footer className="px-4 py-3 text-center text-[10px] text-lumi-muted">Don't describe it. Point at it.</footer>
    </div>
  );
}
