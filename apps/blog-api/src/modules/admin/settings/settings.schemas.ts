import { z } from 'zod';

export const STRUCTURED_SEARCH_INTENTS = [
  'INFORMATIONAL',
  'COMMERCIAL',
  'TRANSACTIONAL',
  'NAVIGATIONAL',
] as const;

export const STRUCTURED_PAGE_TYPES = [
  'BLOG_ARTICLE',
  'PRODUCT_PAGE',
  'COLLECTION',
  'LANDING_PAGE',
  'SERVICE_PAGE',
  'CATEGORY_PAGE',
  'TUTORIAL',
  'GUIDE',
  'DEFINITION',
  'FORM',
  'HOMEPAGE',
  'FAQ',
  'OTHER',
] as const;

export const keywordGroupingResponseSchema = z
  .object({
    groups: z.array(
      z
        .object({
          name: z.string().trim().min(1),
          description: z.string().trim().nullable(),
          keywords: z.array(z.string().trim().min(1)).min(1),
        })
        .strict(),
    ),
  })
  .strict();

export const keywordGroupTemplateResponseSchema = z
  .object({
    pageType: z.enum(STRUCTURED_PAGE_TYPES),
  })
  .strict();

export const keywordGroupDeduplicationResponseSchema = z
  .object({
    merges: z.array(
      z
        .object({
          keepGroupId: z.string().trim(),
          duplicateGroupIds: z.array(z.string().trim()),
          reason: z.string().trim().optional().default(''),
        })
        .strict(),
    ),
  })
  .strict();

export const customerProblemKeywordExtractionResponseSchema = z
  .object({
    keywords: z.array(
      z
        .object({
          keyword: z.string().trim().min(1),
          searchIntent: z.enum(STRUCTURED_SEARCH_INTENTS).nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export const businessPositioningKeywordExtractionResponseSchema = z
  .object({
    keywords: z.array(z.string().trim().min(1)),
  })
  .strict();

export const businessPositioningPrefillResponseSchema = z
  .object({
    websiteUrl: z.string().trim().optional().default(''),
    offering: z.string().trim().optional().default(''),
    differentiator: z.string().trim().optional().default(''),
    problemsSolved: z.string().trim().optional().default(''),
  })
  .strict();
