import type { LumiFocusSnapshot } from '../types/lumiFocus';
import { buildSelector } from './selector';
import { isSensitiveField } from './sensitiveFieldGuard';

export type PartialSnapshot = Omit<LumiFocusSnapshot, 'id' | 'createdAt' | 'tabId' | 'tabUrl' | 'tabTitle'>;

const MAX_TEXT = 600;
const PRICE_PATTERN = /(?:RM|MYR|USD|US\$|\$|€|£|¥|SGD|S\$)\s?\d[\d,]*(?:\.\d{1,2})?|\d[\d,]*(?:\.\d{1,2})?\s?(?:RM|MYR|USD|SGD)/i;

const INLINE_TAGS = new Set(['SPAN', 'B', 'STRONG', 'I', 'EM', 'SMALL', 'A', 'LABEL', 'SVG', 'PATH', 'IMG']);
const CARD_TAGS = new Set(['ARTICLE', 'LI', 'TR', 'FIGURE']);
const CARD_CLASS = /\b(card|product|item|tile|result|listing|entry|post|row)\b/i;

function isCardLike(el: Element): boolean {
  if (CARD_TAGS.has(el.tagName)) return true;
  const role = el.getAttribute('role');
  if (role === 'listitem' || role === 'article' || role === 'row') return true;
  return CARD_CLASS.test(el.className?.toString?.() ?? '') || CARD_CLASS.test(el.id ?? '');
}

function fitsViewport(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width * r.height <= window.innerWidth * window.innerHeight * 0.6 && r.width <= window.innerWidth * 0.9;
}

// Walks up from small inline targets to a meaningful block. Prefers a card-like ancestor
// (article, li, .product…) within reach so a hover over a price captures the whole card.
export function resolveFocusTarget(raw: Element | null): Element | null {
  if (!raw) return null;
  if (raw instanceof HTMLInputElement || raw instanceof HTMLTextAreaElement || raw instanceof HTMLSelectElement) return raw;

  let probe: Element | null = raw;
  let card: Element | null = null;
  for (let i = 0; i < 7 && probe && probe !== document.body; i++) {
    if (isCardLike(probe) && fitsViewport(probe) && (probe.textContent ?? '').trim().length >= 3) card = probe;
    probe = probe.parentElement;
  }
  if (card) return card;

  let el: Element | null = raw;
  let depth = 0;
  while (el && depth < 6) {
    if (el === document.body || el === document.documentElement) return null;
    const text = (el.textContent ?? '').trim();
    const rect = el.getBoundingClientRect();
    const isInline = INLINE_TAGS.has(el.tagName);
    const bigEnough = rect.width >= 60 && rect.height >= 20;
    if (!fitsViewport(el)) return depth === 0 ? el : null;
    if (!isInline && bigEnough && text.length >= 3) return el;
    el = el.parentElement;
    depth += 1;
  }
  return raw;
}

export function createSnapshot(el: Element): PartialSnapshot | null {
  if (isSensitiveField(el)) return null;

  const rawText = (el as HTMLElement).innerText ?? el.textContent ?? '';
  const text = rawText.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
  const rect = el.getBoundingClientRect();

  const attributes: PartialSnapshot['attributes'] = {};
  const href = el.getAttribute('href');
  const alt = el.getAttribute('alt');
  const ariaLabel = el.getAttribute('aria-label');
  const name = el.getAttribute('name');
  const title = el.getAttribute('title');
  if (href) attributes.href = absoluteUrl(href);
  if (alt) attributes.alt = alt;
  if (ariaLabel) attributes.ariaLabel = ariaLabel;
  if (name) attributes.name = name;
  if (title) attributes.title = title;

  const priceMatch = text.match(PRICE_PATTERN);
  const heading = el.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]')?.textContent?.replace(/\s+/g, ' ').trim();
  const firstLine =
    (heading && heading.length <= 120 ? heading : undefined) ??
    rawText.split('\n').map((l) => l.trim()).find((l) => l.length > 0 && l.length <= 120);

  return {
    selector: buildSelector(el),
    tagName: el.tagName.toLowerCase(),
    role: el.getAttribute('role') ?? undefined,
    text,
    attributes,
    boundingRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    extracted: {
      label: firstLine ?? ariaLabel ?? alt ?? undefined,
      price: priceMatch?.[0],
    },
  };
}

function absoluteUrl(href: string): string {
  try {
    return new URL(href, location.href).toString();
  } catch {
    return href;
  }
}
