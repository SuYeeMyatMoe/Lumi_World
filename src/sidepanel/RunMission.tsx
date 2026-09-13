import { useRef, useState } from 'react';
import { sendMessage, sendTabMessage } from '../shared/messaging/sendMessage';
import { useLocalStorage } from '../shared/storage/useChromeStorage';
import type { AgentState } from '../shared/types/agentState';
import type { Mission } from '../shared/types/mission';
import { runMission, type RunMissionIO, type RunOutcome } from './runMissionPlan';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function activeTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id ?? null;
}

// Wires the orchestrator to the RPCs that already exist. Nothing here decides anything;
// every decision lives in runMission.ts.
function chromeIO(tabId: number, cancelled: () => boolean): RunMissionIO {
  return {
    readPageContext: () => sendTabMessage(tabId, { type: 'READ_PAGE_CONTEXT' }),
    highlight: async (selector) => {
      await sendTabMessage(tabId, { type: 'HIGHLIGHT_SELECTOR', selector });
    },
    pin: (selector) => sendTabMessage(tabId, { type: 'PIN_SELECTOR', selector }),
    score: (objectId) => sendMessage({ type: 'REQUEST_SCORE', objectId }),
    compare: (objectAId, objectBId) => sendMessage({ type: 'REQUEST_COMPARE', objectAId, objectBId }),
    hasChat: async () => (await sendTabMessage(tabId, { type: 'READ_CHAT', selector: '' })).ok,
    offer: (objectId) => sendMessage({ type: 'REQUEST_OFFER', objectId }),
    forget: async (objectId) => {
      await sendMessage({ type: 'REMOVE_MEMORY_ITEM', id: objectId });
    },
    narrate: async (state: AgentState, message: string) => {
      await sendMessage({ type: 'SET_AGENT_STATE', state, message });
    },
    pause: sleep,
    cancelled,
  };
}

export function RunMission({ mission }: { mission: Mission | null }) {
  const pending = useLocalStorage('pendingPreview');
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const cancelledRef = useRef(false);

  const run = async () => {
    setOutcome(null);
    cancelledRef.current = false;
    setRunning(true);
    try {
      const tabId = await activeTabId();
      if (tabId === null) {
        setOutcome({ status: 'stopped', message: 'No active tab to run on.' });
        return;
      }
      const result = await runMission(chromeIO(tabId, () => cancelledRef.current), mission);
      setOutcome(result);
    } catch (err) {
      // A thrown error would otherwise leave the button stuck mid-run.
      setOutcome({ status: 'stopped', message: `Run failed: ${String(err)}` });
    } finally {
      setRunning(false);
    }
  };

  // Something already waiting for approval means a previous run got as far as it should.
  const blocked = !running && pending !== null;

  return (
    <div className="mt-3 border-t border-lumi-border pt-3">
      <div className="flex items-center gap-2">
        <button className="lumi-btn-mission" onClick={run} disabled={running || blocked}>
          {running ? 'Running…' : 'Run my mission'}
        </button>
        {running && (
          <button className="lumi-btn !py-1 !px-2" onClick={() => (cancelledRef.current = true)}>
            Stop
          </button>
        )}
      </div>

      <p className="mt-2 text-[11px] text-lumi-muted">
        {blocked
          ? 'Approve or reject what’s waiting before running again.'
          : 'Lumi looks at each listing, drops the ones your mandate rules out, compares what’s left and opens the negotiation. She stops at anything needing your approval.'}
      </p>

      {outcome && (
        <p className={`mt-1 text-[11px] ${outcome.status === 'stopped' ? 'text-lumi-warn' : 'text-lumi-success'}`}>
          {outcome.message}
        </p>
      )}
    </div>
  );
}
