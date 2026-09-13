// Single source of truth for reading prices out of page text. Lives apart from
// elementSnapshot so the background service worker can use it without touching the DOM.
//
// Split into two forms and tried prefix-first on purpose. A single alternation matches
// the "15 RM" inside "ASUS TUF Gaming A15 RM 3,899", because the suffix branch hits an
// earlier index than the real price. The prefix form must win, and the lookbehind stops
// the suffix form from starting in the middle of a model name.
export const PRICE_PREFIXED = /(?:RM|MYR|USD|US\$|\$|€|£|¥|SGD|S\$)\s?\d[\d,]*(?:\.\d{1,2})?/i;
export const PRICE_SUFFIXED = /(?<![A-Za-z0-9])\d[\d,]*(?:\.\d{1,2})?\s?(?:RM|MYR|USD|SGD)\b/i;

const GLOBAL_PREFIXED = new RegExp(PRICE_PREFIXED.source, 'gi');
const GLOBAL_SUFFIXED = new RegExp(PRICE_SUFFIXED.source, 'gi');

/** The price substring, prefix form preferred. Null when the text holds no price. */
export function findPriceText(text: string | null | undefined): string | null {
  if (!text) return null;
  return text.match(PRICE_PREFIXED)?.[0] ?? text.match(PRICE_SUFFIXED)?.[0] ?? null;
}

// "RM 4,150.00" -> 4150. Returns null when the text holds no recognisable price,
// so callers can tell "no price here" apart from "the price is zero".
export function parsePrice(text: string | null | undefined): number | null {
  const match = findPriceText(text);
  return match === null ? null : toNumber(match);
}

// Every price in the text, in order. Used to read a seller's counter-offer out of a
// chat transcript, where the last number stated is the one that binds. Prefix-first for
// the same reason as above: a whole transcript is scanned in one form or the other.
export function parseAllPrices(text: string | null | undefined): number[] {
  if (!text) return [];
  const prefixed = collect(text, GLOBAL_PREFIXED);
  return prefixed.length > 0 ? prefixed : collect(text, GLOBAL_SUFFIXED);
}

export function parseLastPrice(text: string | null | undefined): number | null {
  const all = parseAllPrices(text);
  return all.length > 0 ? all[all.length - 1] : null;
}

// Stricter sibling of parsePrice for checking a value the model wants to type into a
// field: accepts a bare "4399" as well as "RM 4,399", but only when the WHOLE value is
// an amount. Prose that merely contains a number is not treated as a price.
const BARE_AMOUNT = /^\s*(?:RM|MYR|USD|US\$|\$|€|£|¥|SGD|S\$)?\s?\d[\d,]*(?:\.\d{1,2})?\s*$/i;

export function parseAmountLoose(text: string | null | undefined): number | null {
  if (!text) return null;
  if (BARE_AMOUNT.test(text)) return toNumber(text);
  return parsePrice(text);
}

function collect(text: string, pattern: RegExp): number[] {
  const out: number[] = [];
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const value = toNumber(match[0]);
    if (value !== null) out.push(value);
  }
  return out;
}

function toNumber(raw: string): number | null {
  const digits = raw.replace(/[^\d.,]/g, '').replace(/,/g, '');
  if (!digits) return null;
  const value = Number.parseFloat(digits);
  return Number.isFinite(value) ? value : null;
}
