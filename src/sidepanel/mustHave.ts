// Must-have reporting for the orchestrator.
//
// The VERDICT comes from shared/riskClassifier.meetsRequirement, so the panel and the
// guard can never disagree about the same card. What lives here is the breakdown: which
// parts of a requirement were looked for and which were not found, for the bubble and
// the log. An earlier version decided the verdict here as well, which meant two
// implementations of one rule, already diverging on text that states a size with no
// memory word at all.
import { meetsRequirement } from '../shared/riskClassifier';

// Original note, kept because it explains the tolerance:
//
// A mandate says "16 GB RAM"; the card says "16 GB DDR5 (upgradeable)". A literal
// substring test refuses both, and every other card too — which is exactly what a live
// run did. The number and its unit are what the user actually meant; the noun after them
// ("RAM", "memory") is how people talk, not something a spec sheet has to repeat.
//
// This is deliberately NOT in shared/riskClassifier.ts: checkMandate stays strict and
// literal, because it also guards the form-fill and negotiation paths where a loose match
// would be a way to slip past a limit. Here it only decides what is worth scoring.

// Words a listing never has to repeat for the requirement to be met.
const GENERIC = new Set([
  'ram', 'memory', 'storage', 'disk', 'drive', 'capacity', 'size',
  'of', 'with', 'and', 'or', 'the', 'a', 'an', 'at', 'least', 'minimum', 'min',
  'atleast', 'about', 'around', 'approx', 'plus', 'spec', 'specs',
]);

// A number followed by one of these is a measurement: both halves must appear together.
const UNITS = new Set(['gb', 'tb', 'mb', 'ghz', 'mhz', 'kg', 'wh', 'mah', 'inch', 'inches', 'in', 'hz', 'w', 'h']);

export interface RequirementCheck {
  requirement: string;
  ok: boolean;
  /** The parts that were looked for and not found, for the bubble and the log. */
  missing: string[];
  /** How many parts were actually testable; 0 means nothing to check. */
  checked: number;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

// "16gb" and "16 GB" mean the same thing, and the model writes either. Splitting the
// glued form into its number and unit lets both take the paired path below.
function tokenise(requirement: string): string[] {
  const out: string[] = [];
  for (const token of normalise(requirement).split(/[^a-z0-9.]+/).filter(Boolean)) {
    const glued = /^(\d+(?:\.\d+)?)([a-z]+)$/.exec(token);
    if (glued && UNITS.has(glued[2])) {
      out.push(glued[1], glued[2]);
    } else {
      out.push(token);
    }
  }
  return out;
}

export function matchesRequirement(requirement: string, text: string): RequirementCheck {
  const hay = normalise(text);
  const tokens = tokenise(requirement);
  const missing: string[] = [];
  const paired = new Set<number>();
  let checked = 0;

  // "16 gb" has to appear as a pair, so a card with 8 GB RAM and a 512 GB SSD does not
  // pass a 16 GB requirement just by having both numbers somewhere.
  for (let i = 0; i < tokens.length - 1; i += 1) {
    if (!/^\d+(?:\.\d+)?$/.test(tokens[i]) || !UNITS.has(tokens[i + 1])) continue;
    paired.add(i);
    paired.add(i + 1);
    checked += 1;
    const pair = `${tokens[i]} ${tokens[i + 1]}`;
    if (!new RegExp(`\\b${escapeRe(tokens[i])}\\s*${escapeRe(tokens[i + 1])}\\b`).test(hay)) missing.push(pair);
  }

  for (let i = 0; i < tokens.length; i += 1) {
    if (paired.has(i)) continue;
    const token = tokens[i];
    // A bare number outside a pair still has to be there: "RTX 4060" means that 4060.
    if (GENERIC.has(token)) continue;
    checked += 1;
    if (!new RegExp(`\\b${escapeRe(token)}\\b`).test(hay)) missing.push(token);
  }

  // Nothing testable — a requirement of only generic words ("RAM"). Refusing every card
  // over a requirement we cannot actually check would be worse than letting it through.
  if (checked === 0) return { requirement, ok: true, missing: [], checked: 0 };

  const ok = meetsRequirement(text, requirement);
  // Keep the breakdown honest against the verdict that actually governs.
  if (ok) return { requirement, ok: true, missing: [], checked };
  return { requirement, ok: false, missing: missing.length > 0 ? missing : [normalise(requirement)], checked };
}

/** The first requirement this text fails, or null when it satisfies all of them. */
export function firstUnmetRequirement(mustHave: string[], text: string): RequirementCheck | null {
  for (const requirement of mustHave) {
    if (!requirement.trim()) continue;
    const check = matchesRequirement(requirement, text);
    if (!check.ok) return check;
  }
  return null;
}
