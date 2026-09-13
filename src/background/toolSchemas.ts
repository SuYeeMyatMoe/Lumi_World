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

export type CompareToolResult = z.infer<typeof compareResultSchema>;
export type ScoreToolResult = z.infer<typeof scoreResultSchema>;
export type FormFillToolResult = z.infer<typeof formFillSchema>;

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
