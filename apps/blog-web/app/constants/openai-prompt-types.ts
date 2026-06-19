export const openAiPromptTypeLabels: Record<OpenAiPromptType, string> = {
  KEYWORD_ANALYSIS: "Analyse de mot-clé",
  KEYWORD_ANALYSIS_MINI_SCAN: "Mini scan d'analyse de mot-clé",
  KEYWORD_GROUPING: "Regroupement des mots-clés",
  BUSINESS_POSITIONING_PREFILL: "Pré-remplissage du positionnement business",
  BUSINESS_POSITIONING_KEYWORD_EXTRACTION:
    "Extraction de mots-clés du positionnement business",
  CUSTOMER_PROBLEM_KEYWORD_EXTRACTION:
    "Extraction de mots-clés des problèmes clients",
  BLOG_ARTICLE_CLUSTER_SUGGESTION:
    "Suggestion de cluster d'article de blog",
  BLOG_ARTICLE_FROM_SUGGESTION:
    "Génération d'article de blog depuis une suggestion",
  BLOG_ARTICLE_PLAN_FROM_SUGGESTION:
    "Génération de plan d'article de blog depuis une suggestion",
  BLOG_ARTICLE_SECONDARY_KEYWORDS_SUGGESTION:
    "Suggestion de mots-clés secondaires depuis une suggestion éditoriale",
  SEO_CLUSTER_SUGGESTION: "Suggestion de cluster pour un KeywordGroup",
  KEYWORD_GROUP_TEMPLATE: "Choix automatique du template d'un groupe",
  KEYWORD_GROUP_DEDUPLICATION: "Détection des doublons de KeywordGroup",
  OTHER: "Autre",
};

export const openAiPromptTypeColors: Record<OpenAiPromptType, string> = {
  KEYWORD_ANALYSIS: "bg-sky-500",
  KEYWORD_ANALYSIS_MINI_SCAN: "bg-cyan-500",
  KEYWORD_GROUPING: "bg-violet-500",
  BUSINESS_POSITIONING_PREFILL: "bg-emerald-500",
  BUSINESS_POSITIONING_KEYWORD_EXTRACTION: "bg-amber-500",
  CUSTOMER_PROBLEM_KEYWORD_EXTRACTION: "bg-rose-500",
  BLOG_ARTICLE_CLUSTER_SUGGESTION: "bg-cyan-500",
  BLOG_ARTICLE_FROM_SUGGESTION: "bg-indigo-500",
  BLOG_ARTICLE_PLAN_FROM_SUGGESTION: "bg-sky-600",
  BLOG_ARTICLE_SECONDARY_KEYWORDS_SUGGESTION: "bg-emerald-500",
  SEO_CLUSTER_SUGGESTION: "bg-fuchsia-500",
  KEYWORD_GROUP_TEMPLATE: "bg-orange-500",
  KEYWORD_GROUP_DEDUPLICATION: "bg-rose-500",
  OTHER: "bg-slate-400",
};
