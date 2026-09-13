import { z } from 'zod';

export const compareResultSchema = z.object({
  winner: z.enum(['A', 'B', 'tie']),
  scoreA: z.number().min(0).max(100),
  scoreB: z.number().min(0).max(100),
  reasons: z.array(z.string()).min(1).max(6),
  summary: z.string(),
});

export const scoreResultSchema = z.object({
  score: z.number().min(0).max(100),
  verdict: z.string(),
  matchedConstraints: z.array(z.string()).max(8),
});

export const formFillSchema = z.object({
  fills: z.array(z.object({ selector: z.string(), value: z.string() })),
  rationale: z.string(),
});

// nullish() not nullable(): models sometimes omit a field rather than send null.
// The handler normalises undefined to null so the stored mandate is always complete.
export const mandateSchema = z.object({
  goal: z.string(),
  mustHave: z.array(z.string()),
  ceiling: z.number().nullish(),
  currency: z.string().nullish(),
  walkAway: z.number().nullish(),
});

export type CompareToolResult = z.infer<typeof compareResultSchema>;
export type ScoreToolResult = z.infer<typeof scoreResultSchema>;
export type FormFillToolResult = z.infer<typeof formFillSchema>;
export type MandateToolResult = z.infer<typeof mandateSchema>;

export const TOOLS = {
  compareLumiFocusObjects: {
    type: 'function' as const,
    function: {
      name: 'compareLumiFocusObjects',
      description: 'Compare two remembered objects against the user mission and return structured scores.',
      parameters: {
        type: 'object',
        properties: {
          winner: { type: 'string', enum: ['A', 'B', 'tie'] },
          scoreA: { type: 'number', description: 'Mission fit of object A, 0-100' },
          scoreB: { type: 'number', description: 'Mission fit of object B, 0-100' },
          reasons: { type: 'array', items: { type: 'string' }, description: '2-5 short, concrete reasons' },
          summary: { type: 'string', description: 'One sentence verdict in plain language' },
        },
        required: ['winner', 'scoreA', 'scoreB', 'reasons', 'summary'],
        additionalProperties: false,
      },
    },
  },
  scoreMissionMatch: {
    type: 'function' as const,
    function: {
      name: 'scoreMissionMatch',
      description: 'Score how well a single remembered object matches the user mission.',
      parameters: {
        type: 'object',
        properties: {
          score: { type: 'number', description: 'Mission fit 0-100' },
          verdict: { type: 'string', description: 'Short verdict, max 12 words' },
          matchedConstraints: { type: 'array', items: { type: 'string' }, description: 'Constraints from the mission this object satisfies or violates, prefixed with ✓ or ⚠' },
        },
        required: ['score', 'verdict', 'matchedConstraints'],
        additionalProperties: false,
      },
    },
  },
  parseMandate: {
    type: 'function' as const,
    function: {
      name: 'parseMandate',
      description:
        'Extract the hard constraints from a plain-language mission so they can be enforced in code. Extract only limits the user actually stated; use null when they did not state one. Never invent a budget.',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'The mission restated in one clear sentence' },
          mustHave: {
            type: 'array',
            items: { type: 'string' },
            description: 'Non-negotiable requirements as short searchable phrases, e.g. "16 GB RAM". Empty if none were stated.',
          },
          ceiling: { type: ['number', 'null'], description: 'Maximum price the user will pay, as a plain number without currency or separators. Null if unstated.' },
          currency: { type: ['string', 'null'], description: 'Currency code or symbol the user used, e.g. "RM". Null if unstated.' },
          walkAway: { type: ['number', 'null'], description: 'Price above which the user said to walk away. Null if unstated; often equal to the ceiling.' },
        },
        required: ['goal', 'mustHave', 'ceiling', 'currency', 'walkAway'],
        additionalProperties: false,
      },
    },
  },
  proposeFormFill: {
    type: 'function' as const,
    function: {
      name: 'proposeFormFill',
      description: 'Propose values for form fields using the mission and remembered objects. Only include fields you can fill confidently.',
      parameters: {
        type: 'object',
        properties: {
          fills: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                selector: { type: 'string', description: 'Exact selector from the provided field list' },
                value: { type: 'string' },
              },
              required: ['selector', 'value'],
              additionalProperties: false,
            },
          },
          rationale: { type: 'string', description: 'One or two sentences explaining the source of the values' },
        },
        required: ['fills', 'rationale'],
        additionalProperties: false,
      },
    },
  },
} as const;

export type ToolName = keyof typeof TOOLS;
