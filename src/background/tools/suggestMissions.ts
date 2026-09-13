import { z } from 'zod';

export const missionSuggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        goal: z.string().min(1),
        why: z.string(),
      }),
    )
    .min(1)
    .max(3),
});

export type MissionSuggestionsToolResult = z.infer<typeof missionSuggestionsSchema>;

// Registered in TOOLS (toolSchemas.ts) and called through the same forced-tool_choice
// path as every other tool, so the model can only ever answer with validated arguments.
export const suggestMissionsTool = {
  type: 'function' as const,
  function: {
    name: 'suggestMissions',
    description:
      'Propose up to three missions the user might plausibly be pursuing on the page they are looking at. A mission is a concrete goal with the constraints that matter, including a budget ceiling when the page shows prices.',
    parameters: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              goal: {
                type: 'string',
                description:
                  'One sentence in the user voice, e.g. "Find a laptop under RM4,000 for machine learning". Include a ceiling in the page currency when prices are present.',
              },
              why: { type: 'string', description: 'Max 8 words on what in the page suggests this.' },
            },
            required: ['goal', 'why'],
            additionalProperties: false,
          },
          description: '2-3 distinct missions, most likely first',
        },
      },
      required: ['suggestions'],
      additionalProperties: false,
    },
  },
};
