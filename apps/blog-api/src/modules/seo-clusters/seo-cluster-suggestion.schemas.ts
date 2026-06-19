import { z } from 'zod';

export const SEO_CLUSTER_SUGGESTION_OPENAI_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['suggestedClusterId', 'reason'],
  properties: {
    suggestedClusterId: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    },
    reason: {
      type: 'string',
    },
  },
} as const;

export const seoClusterSuggestionResponseSchema = z
  .object({
    suggestedClusterId: z.string().trim().min(1).nullable(),
    reason: z.string().trim().min(1),
  })
  .strict();

export type SeoClusterSuggestionResponse = z.infer<
  typeof seoClusterSuggestionResponseSchema
>;
