import type { PageCard, PageContext } from '../shared/types/pageContext';
import { findPriceText } from '../shared/dom/price';
import { buildSelector } from '../shared/dom/selector';

// Mirrors the heuristics in shared/dom/elementSnapshot.ts on purpose: the same idea of
// "what counts as a card" and "what counts as a price" must hold for a hovered element
// and for a whole-page scan. Collapse both into shared/dom/price.ts once that file lands.
const CARD_SELECTOR = 'article, li, tr, figure, [role="listitem"], [role="article"], [role="row"]';
const CARD_CLASS = /\b(card|product|item|tile|result|listing|entry|post|row)\b/i;
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role="heading"]';

const MAX_HEADINGS = 5;
const MAX_CARDS = 6;
const MAX_LABEL = 120;

function findPrice(text: string): string | null {
  return findPriceText(text);
}

function clean(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

function isCardLike(el: Element): boolean {
  if (el.matches(CARD_SELECTOR)) return true;
  return CARD_CLASS.test(el.className?.toString?.() ?? '') || CARD_CLASS.test(el.id ?? '');
}

// The label is what a person would call this card: its heading, else its first line.
function cardLabel(el: Element): string {
  const heading = clean(el.querySelector(HEADING_SELECTOR)?.textContent);
  if (heading && heading.length <= MAX_LABEL) return heading;
  const firstLine = ((el as HTMLElement).innerText ?? el.textContent ?? '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && l.length <= MAX_LABEL);
  return clean(firstLine).slice(0, MAX_LABEL);
}

// Text only — no values, no inputs, nothing from a sensitive field. The result is sent
// to the model as untrusted data, so it must never carry anything the user typed.
export function readPageContext(): PageContext {
  const headings = Array.from(document.querySelectorAll('h1, h2'))
    .map((h) => clean(h.textContent))
    .filter((t) => t.length > 0 && t.length <= MAX_LABEL)
    .slice(0, MAX_HEADINGS);

  const cards: PageCard[] = [];
  const captured: Element[] = [];
  const seen = new Set<string>();
  for (const el of Array.from(document.querySelectorAll(`${CARD_SELECTOR}, [class]`))) {
    if (cards.length >= MAX_CARDS) break;
    if (!isCardLike(el)) continue;
    // A card-like node inside a card already taken is a detail row, not a second product.
    if (captured.some((c) => c.contains(el))) continue;
    // Anything wrapping a field is form furniture. Its labels are not page content, and
    // a class="row" around two inputs is otherwise indistinguishable from a listing row.
    if (el.querySelector('input, textarea, select')) continue;

    const label = cardLabel(el);
    if (label.length < 3 || seen.has(label)) continue;

    const price = findPrice(clean((el as HTMLElement).innerText ?? el.textContent));
    // A listed thing usually names itself in a heading. Without one, the first line has to
    // carry the name alone — a short one ("SELLER", off a chat bubble) names nothing — and
    // there has to be a price, or this is a fragment rather than something on offer.
    if (!el.querySelector(HEADING_SELECTOR) && (label.length < 12 || !price)) continue;

    seen.add(label);
    captured.push(el);
    cards.push({ label, price, selector: buildSelector(el) });
  }

  return { title: clean(document.title), url: location.href, headings, cards };
}
