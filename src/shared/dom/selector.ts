const MAX_DEPTH = 8;

export function buildSelector(el: Element): string {
  if (el.id && isUniqueId(el)) return `#${CSS.escape(el.id)}`;

  const parts: string[] = [];
  let current: Element | null = el;
  let depth = 0;

  while (current && current !== document.body && current !== document.documentElement && depth < MAX_DEPTH) {
    let part = current.tagName.toLowerCase();
    if (current.id && isUniqueId(current)) {
      parts.unshift(`#${CSS.escape(current.id)}`);
      break;
    }
    const parent: Element | null = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => c.tagName === current!.tagName);
      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
    }
    parts.unshift(part);
    current = parent;
    depth += 1;
  }
  return parts.join(' > ');
}

function isUniqueId(el: Element): boolean {
  try {
    return document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1;
  } catch {
    return false;
  }
}

export function resolveSelector(selector: string): Element | null {
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}
