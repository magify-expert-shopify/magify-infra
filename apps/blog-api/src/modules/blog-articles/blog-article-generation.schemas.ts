import { z } from 'zod';

export const BLOG_ARTICLE_FROM_SUGGESTION_OPENAI_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'slug',
    'seoTitle',
    'seoDescription',
    'excerpt',
    'content',
    'primaryKeyword',
    'requiredKeywords',
  ],
  properties: {
    title: {
      type: 'string',
    },
    slug: {
      type: 'string',
    },
    seoTitle: {
      type: 'string',
    },
    seoDescription: {
      type: 'string',
    },
    excerpt: {
      type: 'string',
    },
    content: {
      type: 'string',
    },
    primaryKeyword: {
      type: 'string',
    },
    requiredKeywords: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  },
} as const;

export const blogArticleFromSuggestionResponseSchema = z
  .object({
    title: z.string().trim().min(1),
    slug: z.string().trim().min(1),
    seoTitle: z.string().trim().min(1),
    seoDescription: z.string().trim().min(1),
    excerpt: z.string().trim().min(1),
    content: z.string().trim().min(1),
    primaryKeyword: z.string().trim().min(1),
    requiredKeywords: z.array(z.string().trim().min(1)).min(1),
  })
  .strict();

export type BlogArticleFromSuggestionResponse = z.infer<
  typeof blogArticleFromSuggestionResponseSchema
>;
