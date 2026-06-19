import { z } from 'zod';

export const KEYWORD_ANALYSIS_MINI_SCAN_OPENAI_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pageIntent'],
  properties: {
    pageIntent: {
      type: 'string',
    },
  },
} as const;

export const keywordAnalysisMiniScanResponseSchema = z.object({
  pageIntent: z.string().trim().min(1),
});
