import { STRUCTURED_PAGE_TYPES } from './settings.schemas';

export const BUSINESS_POSITIONING_PREFILL_OPENAI_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['websiteUrl', 'offering', 'differentiator', 'problemsSolved'],
  properties: {
    websiteUrl: {
      type: 'string',
    },
    offering: {
      type: 'string',
    },
    differentiator: {
      type: 'string',
    },
    problemsSolved: {
      type: 'string',
    },
  },
} as const;

export const KEYWORD_GROUP_TEMPLATE_OPENAI_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pageType'],
  properties: {
    pageType: {
      type: 'string',
      enum: [...STRUCTURED_PAGE_TYPES],
    },
  },
} as const;

export const KEYWORD_GROUP_DEDUPLICATION_OPENAI_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['merges'],
  properties: {
    merges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['keepGroupId', 'duplicateGroupIds', 'reason'],
        properties: {
          keepGroupId: {
            type: 'string',
          },
          duplicateGroupIds: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          reason: {
            type: 'string',
          },
        },
      },
    },
  },
} as const;

export const KEYWORD_GROUPING_OPENAI_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['groups'],
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'description', 'keywords'],
        properties: {
          name: {
            type: 'string',
          },
          description: {
            type: ['string', 'null'],
          },
          keywords: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
      },
    },
  },
} as const;

export const CUSTOMER_PROBLEM_KEYWORD_EXTRACTION_OPENAI_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['keywords'],
  properties: {
    keywords: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['keyword', 'searchIntent'],
        properties: {
          keyword: {
            type: 'string',
          },
          searchIntent: {
            anyOf: [
              {
                type: 'string',
                enum: [
                  'INFORMATIONAL',
                  'COMMERCIAL',
                  'TRANSACTIONAL',
                  'NAVIGATIONAL',
                ],
              },
              {
                type: 'null',
              },
            ],
          },
        },
      },
    },
  },
} as const;

export const BUSINESS_POSITIONING_KEYWORD_EXTRACTION_OPENAI_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['keywords'],
  properties: {
    keywords: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  },
} as const;
