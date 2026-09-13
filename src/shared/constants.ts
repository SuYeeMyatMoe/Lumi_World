export const BRAND = {
  name: 'Lumi World',
  mascot: 'Lumi',
  tagline: 'AI that understands what you mean.',
  pointLine: 'Point at something and Lumi understands.',
} as const;

export const PALETTE = {
  bg: '#0a0a0f',
  panel: '#12121a',
  border: '#22222e',
  text: '#e8e8f0',
  muted: '#8a8a9a',
  focus: '#22d3ee',
  mission: '#a3e635',
  warn: '#f59e0b',
  danger: '#ef4444',
  success: '#34d399',
} as const;

export const LUMI_VOICE = {
  remembered: 'Got it.',
  needsApproval: 'I need your approval for this one.',
  uncertain: "I'm not confident enough to act yet.",
  done: 'Done.',
  thinking: 'Thinking…',
  noKey: 'Set your OpenAI key in Options so I can reason.',
} as const;

export function uid(prefix = 'lumi'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
