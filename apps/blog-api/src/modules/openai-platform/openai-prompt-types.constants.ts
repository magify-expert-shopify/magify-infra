import type { OpenAiPromptType } from 'src/common/types';

export const OPENAI_PROMPT_TYPE_LABELS: Record<OpenAiPromptType, string> = {
  KEYWORD_ANALYSIS: 'Analyse de mot-clé',
  KEYWORD_ANALYSIS_MINI_SCAN: "Mini scan d'analyse de mot-clé",
  KEYWORD_GROUPING: 'Regroupement des mots-clés',
  BUSINESS_POSITIONING_PREFILL: 'Pré-remplissage du positionnement business',
  BUSINESS_POSITIONING_KEYWORD_EXTRACTION:
    'Extraction de mots-clés du positionnement business',
  CUSTOMER_PROBLEM_KEYWORD_EXTRACTION:
    'Extraction de mots-clés des problèmes clients',
  BLOG_ARTICLE_CLUSTER_SUGGESTION: "Suggestion de cluster d'article de blog",
  BLOG_ARTICLE_FROM_SUGGESTION:
    "Génération d'article de blog depuis une suggestion",
  BLOG_ARTICLE_PLAN_FROM_SUGGESTION:
    "Génération de plan d'article de blog depuis une suggestion",
  BLOG_ARTICLE_SECONDARY_KEYWORDS_SUGGESTION:
    'Suggestion de mots-clés secondaires depuis une suggestion éditoriale',
  SEO_CLUSTER_SUGGESTION: 'Suggestion de cluster pour un KeywordGroup',
  KEYWORD_GROUP_TEMPLATE: "Choix automatique du template d'un groupe",
  KEYWORD_GROUP_DEDUPLICATION: 'Détection des doublons de KeywordGroup',
  OTHER: 'Autre',
};

export const OPENAI_PROMPT_TYPES = Object.keys(
  OPENAI_PROMPT_TYPE_LABELS,
) as OpenAiPromptType[];
