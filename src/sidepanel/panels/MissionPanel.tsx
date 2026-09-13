import { useEffect, useState } from 'react';
import { useLocalStorage } from '../../shared/storage/useChromeStorage';
import { setLocal } from '../../shared/storage/storage';
import { sendMessage } from '../../shared/messaging/sendMessage';
import type { Mandate } from '../../shared/types/mission';
import { MissionSuggestions } from './MissionSuggestions';
import { RunMission } from '../RunMission';

export function MissionPanel() {
  const mission = useLocalStorage('mission');
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mission && !editing) setDraft(mission.goal);
  }, [mission, editing]);

  // The background parses the goal into a mandate and stores the mission, so the
  // limits Lumi will enforce are set in the same action that sets the goal.
  const save = async () => {
    const goal = draft.trim();
    if (!goal) return;
    setBusy(true);
    await sendMessage({ type: 'PARSE_MISSION', goal });
    setBusy(false);
    setEditing(false);
  };

  const clear = async () => {
    await setLocal('mission', null);
    setDraft('');
    setEditing(false);
  };

  if (mission && !editing) {
    return (
      <section className="lumi-card border-lumi-mission/30">
        <div className="mb-1 flex items-center justify-between">
          <span className="lumi-label text-lumi-mission">Mission</span>
          <div className="flex gap-1">
            <button className="lumi-btn !py-1 !px-2" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className="lumi-btn !py-1 !px-2" onClick={clear}>
              Clear
            </button>
          </div>
        </div>
        <p className="text-sm leading-snug">{mission.goal}</p>
        <MandateChips mandate={mission.mandate} />
        <RunMission mission={mission} />
        <p className="mt-2 text-[11px] text-lumi-muted">
          {mission.mandate
            ? 'Limits are enforced in code. Lumi refuses rather than exceeds them.'
            : 'Every object you remember is judged against this.'}
        </p>
      </section>
    );
  }

  return (
    <section className="lumi-card">
      <span className="lumi-label text-lumi-mission">Mission</span>
      <p className="mb-2 mt-1 text-xs text-lumi-muted">Tell Lumi what you are trying to do.</p>
      <textarea
        className="lumi-input min-h-[68px] resize-none"
        placeholder="e.g. Find a laptop under RM4,000 for machine learning"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="mt-2 flex items-center gap-2">
        <button className="lumi-btn-mission" onClick={save} disabled={busy || !draft.trim()}>
          {busy ? 'Reading your limits…' : 'Set mission'}
        </button>
        {mission && (
          <button className="lumi-btn" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>
      {!mission && <MissionSuggestions onPick={setDraft} />}
    </section>
  );
}

// The mandate made visible: what Lumi must find, and the number it will not cross.
function MandateChips({ mandate }: { mandate?: Mandate }) {
  if (!mandate) return null;
  const money = (value: number) => `${mandate.currency ?? ''}${value.toLocaleString('en-MY', { maximumFractionDigits: 2 })}`;
  const hasAny = mandate.mustHave.length > 0 || mandate.ceiling !== null || mandate.walkAway !== null;
  if (!hasAny) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {mandate.mustHave.map((item) => (
        <span key={item} className="lumi-chip border-lumi-focus/40 text-lumi-focus">
          must have · {item}
        </span>
      ))}
      {mandate.ceiling !== null && (
        <span className="lumi-chip border-lumi-mission/40 text-lumi-mission">ceiling · {money(mandate.ceiling)}</span>
      )}
      {mandate.walkAway !== null && (
        <span className="lumi-chip border-lumi-danger/40 text-lumi-danger">walk away · {money(mandate.walkAway)}</span>
      )}
    </div>
  );
}
