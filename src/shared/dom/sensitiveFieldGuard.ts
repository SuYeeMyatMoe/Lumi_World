const SENSITIVE_PATTERN = /password|passwd|pwd|cvv|ccv|cvc|card.?number|cardnum|credit.?card|ssn|social.?security|\bpin\b|otp|secret|token|iban|routing|account.?number/i;

const SENSITIVE_AUTOCOMPLETE = /^(cc-|current-password|new-password|one-time-code)/i;

export function isSensitiveField(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLInputElement) {
    const type = (el.type || '').toLowerCase();
    if (type === 'password' || type === 'hidden') return true;
    const autocomplete = el.getAttribute('autocomplete') ?? '';
    if (SENSITIVE_AUTOCOMPLETE.test(autocomplete)) return true;
  }
  const haystack = [
    el.getAttribute('name'),
    el.getAttribute('id'),
    el.getAttribute('aria-label'),
    el.getAttribute('placeholder'),
    el.getAttribute('autocomplete'),
  ]
    .filter(Boolean)
    .join(' ');
  if (SENSITIVE_PATTERN.test(haystack)) return true;

  if (el instanceof HTMLElement) {
    const labelText = findLabelText(el);
    if (labelText && SENSITIVE_PATTERN.test(labelText)) return true;
  }
  return false;
}

export function findLabelText(el: HTMLElement): string {
  if (el.id) {
    const label = el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label?.textContent) return label.textContent.trim();
  }
  const wrappingLabel = el.closest('label');
  if (wrappingLabel?.textContent) return wrappingLabel.textContent.trim();
  return '';
}

export function containsSensitiveDescendant(el: Element): boolean {
  const fields = el.querySelectorAll('input, textarea, select');
  for (const f of Array.from(fields)) {
    if (isSensitiveField(f)) return true;
  }
  return false;
}
