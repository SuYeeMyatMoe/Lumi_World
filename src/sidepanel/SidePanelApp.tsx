import { useEffect, useState } from 'react';
import { useLocalStorage } from '../shared/storage/useChromeStorage';
import { BRAND } from '../shared/constants';
import { LumiMascotFull } from './LumiMascotFull';
import { MissionPanel } from './panels/MissionPanel';
import { MemoryPanel } from './panels/MemoryPanel';
import { ComparePanel } from './panels/ComparePanel';
import { TrustPanel } from './panels/TrustPanel';

export function SidePanelApp() {
  const settings = useLocalStorage('lumiSettings');
  const memory = useLocalStorage('lumiMemory');
  const [selected, setSelected] = useState<string[]>([]);

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

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-lumi-border bg-lumi-bg/90 px-4 py-2.5 backdrop-blur">
        <div>
          <h1 className="text-sm font-bold tracking-tight">{BRAND.name}</h1>
          <p className="text-[10.5px] text-lumi-muted">{BRAND.tagline}</p>
        </div>
        <button className="lumi-btn !py-1 !px-2" onClick={() => chrome.runtime.openOptionsPage()} title="Options">
          ⚙
        </button>
      </header>

      <main className="flex flex-1 flex-col gap-3 p-3">
        <LumiMascotFull />

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
        <TrustPanel />
      </main>

      <footer className="px-4 py-3 text-center text-[10px] text-lumi-muted">Don't describe it. Point at it.</footer>
    </div>
  );
}
