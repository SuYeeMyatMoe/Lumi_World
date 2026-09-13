import { checkMandate } from '../shared/riskClassifier';
import { firstUnmetRequirement } from './mustHave';
import { parsePrice } from '../shared/dom/price';
import type { AgentState } from '../shared/types/agentState';
import type { CompareResult } from '../shared/types/compare';
import type { LumiFocusSnapshot } from '../shared/types/lumiFocus';
import type { LumiResult } from '../shared/types/messages';
import type { Mission } from '../shared/types/mission';
import type { PageContext } from '../shared/types/pageContext';

// Nothing on this page is worth more than eight cards of attention, and a run that walks
// more than that stops reading as deliberate on camera.
export const MAX_CARDS = 8;
export const STEP_PAUSE_MS = 1200;

// The orchestrator only ever calls these. Injecting them keeps the sequence — which is
// the part that can go wrong — testable without a browser.
export interface RunMissionIO {
  readPageContext(): Promise<LumiResult<PageContext>>;
  highlight(selector: string | null): Promise<void>;
  pin(selector: string): Promise<LumiResult<LumiFocusSnapshot>>;
  score(objectId: string): Promise<LumiResult<LumiFocusSnapshot>>;
  compare(objectAId: string, objectBId: string): Promise<LumiResult<CompareResult>>;
  hasChat(): Promise<boolean>;
  offer(objectId: string): Promise<LumiResult<unknown>>;
  /** Drops a remembered object again — a card Lumi refuses must not stay in memory. */
  forget(objectId: string): Promise<void>;
  narrate(state: AgentState, message: string): Promise<void>;
  pause(ms: number): Promise<void>;
  cancelled(): boolean;
}

export type RunOutcome =
  | { status: 'awaiting-approval'; message: string }
  | { status: 'done'; message: string }
  | { status: 'stopped'; message: string };

const STOPWORDS = new Set([
  'the', 'a', 'an', 'our', 'your', 'my', 'best', 'top', 'new', 'all', 'shop', 'buy',
  'find', 'browse', 'explore', 'featured', 'popular', 'latest', 'for', 'and', 'with',
  'in', 'on', 'at', 'to', 'of', 'from', 'by',
]);

// What to call the things on this page, already plural: "Laptops for students" -> laptops.
// The first h1 is usually the site name, so a heading of several words wins.
export function pageNoun(context: PageContext): string {
  const source = context.headings.find((h) => h.split(/\s+/).length >= 2) ?? context.headings[0] ?? '';
  const word = source
    .split(/[\s—–·|,:]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}-]/gu, ''))
    .find((w) => w.length > 2 && !STOPWORDS.has(w.toLowerCase()));
  return word ? word.toLowerCase() : 'things';
}

// Highest mission score first; an unscored object sorts last rather than winning by luck.
export function rankByScore(items: LumiFocusSnapshot[]): LumiFocusSnapshot[] {
  return [...items].sort((a, b) => (b.missionScore?.score ?? -1) - (a.missionScore?.score ?? -1));
}

function plural(n: number, word: string): string {
  return n === 1 ? `1 ${word}` : `${n} ${word}s`;
}

function quote(s: string): string {
  return `\u201c${s}\u201d`;
}

/**
 * Runs the mission end to end over the tools Lumi already has: read the page, look at
 * each card in turn, refuse the ones the mandate rules out, score and compare what is
 * left, then open a negotiation on the winner.
 *
 * It never retries and never loops: the first failure stops the run and says why. It
 * stops at the first thing needing approval, because approving is the user's job.
 */
export async function runMission(io: RunMissionIO, mission: Mission | null): Promise<RunOutcome> {
  const stop = async (message: string): Promise<RunOutcome> => {
    await io.narrate('warning', message);
    await io.highlight(null);
    return { status: 'stopped', message };
  };
  // A cancelled run leaves the page as it found it.
  const cancelledOutcome = async (): Promise<RunOutcome> => {
    await io.highlight(null);
    await io.narrate('idle', 'Stopped.');
    return { status: 'stopped', message: 'Stopped.' };
  };

  console.info('[run-mission] mandate', mission?.mandate ?? '(none)');
  await io.narrate('thinking', 'Reading this page…');
  const context = await io.readPageContext();
  if (!context.ok) return stop(context.error);

  const cards = context.data.cards.filter((c) => c.selector).slice(0, MAX_CARDS);
  if (cards.length === 0) return stop('I can’t find anything on this page to compare.');

  const noun = pageNoun(context.data);
  await io.narrate('thinking', `Looking at ${plural(cards.length, noun.replace(/s$/, ''))}…`);
  await io.pause(STEP_PAUSE_MS);

  // Look at each card in turn. The outline moving from one to the next is the visible
  // part; the mandate check is the part that decides.
  const kept: LumiFocusSnapshot[] = [];
  let refused = 0;
  for (const card of cards) {
    if (io.cancelled()) return cancelledOutcome();

    await io.highlight(card.selector);
    // Pinning first is what gives us the full card text to judge; a card that then fails
    // the mandate is forgotten again below, so memory only ever holds what Lumi accepted.
    const pinned = await io.pin(card.selector);
    if (!pinned.ok) return stop(pinned.error);

    // The snapshot's text is the whole card (innerText, capped at 600 chars). The page
    // context's card carries only a label and a price, which is not enough to judge a
    // must-have against — checking that instead refuses everything.
    const text = pinned.data.text;
    const price = parsePrice(card.price ?? pinned.data.extracted.price ?? null);

    // Price stays with the strict shared check. The must-have is matched tolerantly here,
    // because "16 GB RAM" has to match a card that says "16 GB DDR5".
    const priceVerdict = checkMandate({ price }, mission);
    const unmet = priceVerdict.ok ? firstUnmetRequirement(mission?.mandate?.mustHave ?? [], text) : null;
    const reason = !priceVerdict.ok
      ? priceVerdict.reason
      : unmet
        ? `I can’t confirm ${quote(unmet.requirement)} on this one${unmet.missing.length > 0 ? ` — no ${unmet.missing.join(', ')}` : ''}, and you told me that’s non-negotiable.`
        : null;

    // Logged so a live run can be debugged from the side panel console without guessing.
    console.info('[run-mission]', card.label, {
      price,
      rawPrice: card.price ?? pinned.data.extracted.price ?? null,
      textLength: text.length,
      text: text.slice(0, 200),
      mustHave: mission?.mandate?.mustHave ?? [],
      missing: unmet?.missing ?? [],
      verdict: reason ? 'REFUSE' : 'KEEP',
      reason,
    });

    if (reason) {
      refused += 1;
      await io.forget(pinned.data.id);
      // The refusal is the interesting moment — hold it on screen with the card still lit.
      await io.narrate('warning', reason);
      await io.pause(STEP_PAUSE_MS);
      continue;
    }

    kept.push(pinned.data);
    await io.pause(STEP_PAUSE_MS);
  }

  await io.highlight(null);
  if (kept.length === 0) {
    return stop(refused > 0 ? 'None of these fit your limits.' : 'Nothing here I could remember.');
  }
  await io.narrate('thinking', `${kept.length} fit your limits${refused > 0 ? `, ${refused} didn’t` : ''}.`);
  await io.pause(STEP_PAUSE_MS);

  // Score what survived, so the comparison is between the two best candidates.
  const scored: LumiFocusSnapshot[] = [];
  for (const item of kept) {
    if (io.cancelled()) return cancelledOutcome();
    await io.narrate('thinking', `Scoring ${item.extracted.label ?? 'this one'}…`);
    const result = await io.score(item.id);
    if (!result.ok) return stop(result.error);
    scored.push(result.data);
    await io.pause(STEP_PAUSE_MS);
  }

  const ranked = rankByScore(scored);
  let winner = ranked[0];

  if (ranked.length >= 2) {
    if (io.cancelled()) return cancelledOutcome();
    await io.narrate('thinking', 'Comparing the top two…');
    const comparison = await io.compare(ranked[0].id, ranked[1].id);
    if (!comparison.ok) return stop(comparison.error);
    winner = comparison.data.winner === 'B' ? ranked[1] : ranked[0];
    await io.pause(STEP_PAUSE_MS);
  }

  const winnerName = winner.extracted.label ?? 'this one';
  await io.highlight(winner.selector);
  await io.narrate('thinking', `${winnerName} wins.`);
  await io.pause(STEP_PAUSE_MS);

  if (io.cancelled()) return cancelledOutcome();
  if (!(await io.hasChat())) {
    const message = `${winnerName} is the one. Nothing to negotiate with on this page.`;
    await io.narrate('success', message);
    return { status: 'done', message };
  }

  await io.narrate('thinking', 'Asking the seller…');
  // REQUEST_OFFER negotiates on its own within the mandate and narrates its own turns.
  const offered = await io.offer(winner.id);

  if (!offered.ok) {
    // Walking away is the mandate working, not a failure: the handler has already said so
    // in its own bubble, and overwriting it here would replace the reason with an error.
    if (offered.code === 'REFUSED') {
      const message = `Walked away from ${winnerName} — the seller stayed above your limit.`;
      return { status: 'done', message };
    }
    return stop(offered.error);
  }

  // The run ends at the one approval a negotiation asks for: committing the money.
  return { status: 'awaiting-approval', message: `Agreed with the seller on ${winnerName}. Approve the deal on the page.` };
}
