import type { PageCard, PageContext } from '../shared/types/pageContext';
import { findPriceText, parseAllPrices } from '../shared/dom/price';
import { buildSelector } from '../shared/dom/selector';

// Mirrors the heuristics in shared/dom/elementSnapshot.ts on purpose: the same idea of
// "what counts as a card" and "what counts as a price" must hold for a hovered element
// and for a whole-page scan. Collapse both into shared/dom/price.ts once that file lands.
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role="heading"]';

// Chrome and navigation are never things on offer, however priced they look. The chat
// surfaces are excluded for the same reason: a seller quoting a number is a conversation,
// not a listing, and REQUEST_OFFER already owns that element.
const EXCLUDED_ANCESTORS =
  'nav, header, footer, [role="navigation"], [role="banner"], [role="contentinfo"], [role="log"], .messages, #seller-chat, [data-lumi-ignore]';

// A heading that is only a price names nothing — some stores mark the price up as one.
const PRICE_ONLY = /^(?:RM|MYR|USD|US\$|\$|€|£|¥|SGD|S\$)\s?\d[\d,]*(?:\.\d{1,2})?$/i;

const MAX_HEADINGS = 5;
const MAX_CARDS = 8;
const MAX_LABEL = 120;
// A thing on offer occupies a real but bounded piece of the page. Below this it is a
// price tag or a badge; above it, a section holding several things.
const MIN_AREA_RATIO = 0.01;
const MAX_AREA_RATIO = 0.4;

function findPrice(text: string): string | null {
  return findPriceText(text);
}

function clean(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

// The label is what a person would call this card. A link's title attribute wins when
// there is one: listings routinely truncate the visible name and keep the full one there.
function cardLabel(el: Element): string {
  const linkTitle = clean(el.querySelector('a[title]')?.getAttribute('title'));
  if (linkTitle && !PRICE_ONLY.test(linkTitle)) return linkTitle.slice(0, MAX_LABEL);

  for (const heading of Array.from(el.querySelectorAll(HEADING_SELECTOR))) {
    const text = clean(heading.textContent);
    if (text && text.length <= MAX_LABEL && !PRICE_ONLY.test(text)) return text;
  }

  const firstLine = ((el as HTMLElement).innerText ?? el.textContent ?? '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && l.length <= MAX_LABEL && !PRICE_ONLY.test(l));
  return clean(firstLine).slice(0, MAX_LABEL);
}

// Text only — no values, no inputs, nothing from a sensitive field. The result is sent
// to the model as untrusted data, so it must never carry anything the user typed.
export function readPageContext(): PageContext {
  const headings = Array.from(document.querySelectorAll('h1, h2'))
    .map((h) => clean(h.textContent))
    .filter((t) => t.length > 0 && t.length <= MAX_LABEL)
    .slice(0, MAX_HEADINGS);

  // A thing on offer is the smallest block that quotes exactly one price. Scanning for
  // that rather than for card-shaped markup is what stops "Products", "Computers /
  // Laptops" and the site header being read as products on a real store.
  const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
  const candidates: Element[] = [];

  for (const el of Array.from(document.querySelectorAll('body *'))) {
    if (el.closest(EXCLUDED_ANCESTORS)) continue;
    // Anything wrapping a field is form furniture, not a listing.
    if (el.querySelector('input, textarea, select')) continue;
    if (parseAllPrices(clean(el.textContent)).length !== 1) continue;

    const rect = el.getBoundingClientRect();
    const ratio = (rect.width * rect.height) / viewportArea;
    if (ratio < MIN_AREA_RATIO || ratio > MAX_AREA_RATIO) continue;

    candidates.push(el);
  }

  // Keep the innermost priced block: an ancestor holding one of these is the wrapper
  // around a product, not a second product.
  const cards: PageCard[] = [];
  const seen = new Set<string>();
  for (const el of candidates) {
    if (cards.length >= MAX_CARDS) break;
    if (candidates.some((other) => other !== el && el.contains(other))) continue;

    const label = cardLabel(el);
    if (label.length < 3 || seen.has(label)) continue;
    seen.add(label);
    cards.push({ label, price: findPrice(clean(el.textContent)), selector: buildSelector(el) });
  }

  return { title: clean(document.title), url: location.href, headings, cards };
}
