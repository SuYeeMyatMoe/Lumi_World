// Single source of truth for reading prices out of page text. Lives apart from
// elementSnapshot so the background service worker can use it without touching the DOM.
export const PRICE_PATTERN =
  /(?:RM|MYR|USD|US\$|\$|€|£|¥|SGD|S\$)\s?\d[\d,]*(?:\.\d{1,2})?|\d[\d,]*(?:\.\d{1,2})?\s?(?:RM|MYR|USD|SGD)/i;

// Matches every price in a string, not just the first.
const PRICE_PATTERN_GLOBAL = new RegExp(PRICE_PATTERN.source, 'gi');

// "RM 4,150.00" -> 4150. Returns null when the text holds no recognisable price,
// so callers can tell "no price here" apart from "the price is zero".
export function parsePrice(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(PRICE_PATTERN);
  if (!match) return null;
  return toNumber(match[0]);
}

// Every price in the text, in order. Used to read a seller's counter-offer out of a
// chat transcript, where the last number stated is the one that binds.
export function parseAllPrices(text: string | null | undefined): number[] {
  if (!text) return [];
  const out: number[] = [];
  for (const match of text.matchAll(PRICE_PATTERN_GLOBAL)) {
    const value = toNumber(match[0]);
    if (value !== null) out.push(value);
  }
  return out;
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

function toNumber(raw: string): number | null {
  const digits = raw.replace(/[^\d.,]/g, '').replace(/,/g, '');
  if (!digits) return null;
  const value = Number.parseFloat(digits);
  return Number.isFinite(value) ? value : null;
}
