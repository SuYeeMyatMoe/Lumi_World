import { useEffect, useState } from 'react';
import { useLocalStorage } from '../../shared/storage/useChromeStorage';
import { setLocal } from '../../shared/storage/storage';
import { uid } from '../../shared/constants';

const EXAMPLES = [
  'Find a laptop under RM4,000 for machine learning and university.',
  'Pick a camera under RM9,000 for travel and low-light video.',
  'Help me submit my hackathon project correctly.',
];

export function MissionPanel() {
  const mission = useLocalStorage('mission');
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (mission && !editing) setDraft(mission.goal);
  }, [mission, editing]);

  const save = async () => {
    const goal = draft.trim();
    if (!goal) return;
    await setLocal('mission', { id: mission?.id ?? uid('mission'), goal, createdAt: mission?.createdAt ?? Date.now(), status: 'active' });
    setEditing(false);
  };

  const clear = async () => {
    await setLocal('mission', null);
    setDraft('');
    setEditing(false);
  };

  if (mission && !editing) {
    return (
      <section className="lumi-card border-l-2 border-l-lumi-focus">
        <div className="lumi-section-head">
          <span className="lumi-label text-lumi-focus">Mission</span>
          <div className="flex gap-1">
            <button className="lumi-btn !min-h-8 !py-1 !px-2.5" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className="lumi-btn !min-h-8 !py-1 !px-2.5" onClick={clear}>
              Clear
            </button>
          </div>
        </div>
        <p className="text-sm font-medium leading-snug">{mission.goal}</p>
        <p className="mt-2 text-[11px] text-lumi-muted">Every object you remember is judged against this.</p>
      </section>
    );
  }

  return (
    <section className="lumi-card">
      <span className="lumi-label text-lumi-focus">Mission</span>
      <p className="mb-2.5 mt-1 text-xs text-lumi-muted">Tell Lumi what you are trying to do.</p>
      <textarea
        className="lumi-input min-h-[68px] resize-none"
        placeholder="e.g. Find a laptop under RM4,000 for machine learning"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="mt-2.5 flex items-center gap-2">
        <button className="lumi-btn-mission" onClick={save} disabled={!draft.trim()}>
          Set mission
        </button>
        {mission && (
          <button className="lumi-btn" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>
      {!mission && (
        <div className="mt-3 flex flex-col divide-y divide-lumi-border/50 border-t border-lumi-border/50">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              className="py-2 text-left text-[11px] leading-snug text-lumi-muted transition hover:text-lumi-text"
              onClick={() => setDraft(ex)}
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
