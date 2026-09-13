import type { DetectedFormField } from '../types/messages';
import { buildSelector, resolveSelector } from './selector';
import { findLabelText, isSensitiveField } from './sensitiveFieldGuard';

type FieldEl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const IGNORED_CONTAINERS = '[data-lumi-ignore], #seller-chat';

const SKIPPED_INPUT_TYPES = new Set(['submit', 'button', 'reset', 'image', 'file', 'checkbox', 'radio', 'hidden', 'password']);

export interface FieldDetection {
  fields: DetectedFormField[];
  protectedCount: number;
}

export function detectFormFields(root: ParentNode = document): FieldDetection {
  const candidates = Array.from(root.querySelectorAll<FieldEl>('input, textarea, select'));
  const fields: DetectedFormField[] = [];
  let protectedCount = 0;

  for (const el of candidates) {
    // The negotiation composer is driven by REQUEST_OFFER through a fixed selector.
    // It must never show up as a fillable form field, or a form fill would type an
    // offer into the seller chat.
    if (el.closest(IGNORED_CONTAINERS)) continue;
    if (el instanceof HTMLInputElement && SKIPPED_INPUT_TYPES.has((el.type || 'text').toLowerCase())) {
      if (el.type === 'password') protectedCount += 1;
      continue;
    }
    if (isSensitiveField(el)) {
      protectedCount += 1;
      continue;
    }
    if (!isVisible(el) || el.disabled || ('readOnly' in el && el.readOnly)) continue;

    fields.push({
      selector: buildSelector(el),
      label: deriveLabel(el),
      currentValue: el.value ?? '',
      kind: el instanceof HTMLSelectElement ? 'select' : el instanceof HTMLTextAreaElement ? 'textarea' : el.type || 'text',
      formSelector: el.form ? buildSelector(el.form) : '',
    });
  }
  return { fields: fields.slice(0, 25), protectedCount };
}

export function deriveLabel(el: FieldEl): string {
  const explicit = findLabelText(el);
  if (explicit) return clean(explicit);
  const aria = el.getAttribute('aria-label');
  if (aria) return clean(aria);
  const placeholder = el.getAttribute('placeholder');
  if (placeholder) return clean(placeholder);
  const name = el.getAttribute('name') || el.id;
  if (name) return prettify(name);
  const prev = el.previousElementSibling?.textContent?.trim();
  if (prev && prev.length < 60) return clean(prev);
  return el.tagName.toLowerCase();
}

// Uses the native setter + input/change events so React/Vue-controlled inputs keep the value.
export function applyFieldValue(selector: string, value: string): boolean {
  const el = resolveSelector(selector);
  if (!el) return false;
  if (isSensitiveField(el)) return false;

  if (el instanceof HTMLSelectElement) {
    const option = Array.from(el.options).find(
      (o) => o.value.toLowerCase() === value.toLowerCase() || o.text.trim().toLowerCase() === value.toLowerCase(),
    );
    if (!option) return false;
    el.value = option.value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else (el as HTMLInputElement).value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

function clean(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/[*:]\s*$/, '').trim();
}

function prettify(name: string): string {
  return name
    .replace(/[\[\]_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
