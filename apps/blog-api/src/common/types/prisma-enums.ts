export const AuthorSource = {
  MAGIFY: 'MAGIFY',
  COMPETITOR: 'COMPETITOR',
  PARTNER: 'PARTNER',
  OTHER: 'OTHER',
} as const;
export type AuthorSource =
  (typeof AuthorSource)[keyof typeof AuthorSource];

export const ProblemSource = {
  MANUAL: 'MANUAL',
  BUSINESS_POSITIONING: 'BUSINESS_POSITIONING',
  CUSTOMER_PROBLEM: 'CUSTOMER_PROBLEM',
  OTHER: 'OTHER',
} as const;
export type ProblemSource =
  (typeof ProblemSource)[keyof typeof ProblemSource];

export const SearchIntent = {
  INFORMATIONAL: 'INFORMATIONAL',
  COMMERCIAL: 'COMMERCIAL',
  TRANSACTIONAL: 'TRANSACTIONAL',
  NAVIGATIONAL: 'NAVIGATIONAL',
} as const;
export type SearchIntent =
  (typeof SearchIntent)[keyof typeof SearchIntent];

export const KeywordSource = {
  MANUAL: 'MANUAL',
  OTHER: 'OTHER',
  CUSTOMER_PROBLEM: 'CUSTOMER_PROBLEM',
  BUSINESS_POSITIONING: 'BUSINESS_POSITIONING',
} as const;
export type KeywordSource =
  (typeof KeywordSource)[keyof typeof KeywordSource];

export const KeywordLengthType = {
  SHORT_TAIL: 'SHORT_TAIL',
  MID_TAIL: 'MID_TAIL',
  LONG_TAIL: 'LONG_TAIL',
} as const;
export type KeywordLengthType =
  (typeof KeywordLengthType)[keyof typeof KeywordLengthType];

export const PageType = {
  BLOG_ARTICLE: 'BLOG_ARTICLE',
  PRODUCT_PAGE: 'PRODUCT_PAGE',
  COLLECTION: 'COLLECTION',
  LANDING_PAGE: 'LANDING_PAGE',
  SERVICE_PAGE: 'SERVICE_PAGE',
  CATEGORY_PAGE: 'CATEGORY_PAGE',
  TUTORIAL: 'TUTORIAL',
  GUIDE: 'GUIDE',
  DEFINITION: 'DEFINITION',
  FORM: 'FORM',
  HOMEPAGE: 'HOMEPAGE',
  FAQ: 'FAQ',
  OTHER: 'OTHER',
} as const;
export type PageType = (typeof PageType)[keyof typeof PageType];

export const PageStatus = {
  IDEA: 'IDEA',
  DRAFT: 'DRAFT',
  READY_TO_PUBLISH: 'READY_TO_PUBLISH',
  PLANNED: 'PLANNED',
  PUSHED: 'PUSHED',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type PageStatus =
  (typeof PageStatus)[keyof typeof PageStatus];

export const SeoRole = {
  PILLAR: 'PILLAR',
  SATELLITE: 'SATELLITE',
  SUPPORT: 'SUPPORT',
} as const;
export type SeoRole = (typeof SeoRole)[keyof typeof SeoRole];
