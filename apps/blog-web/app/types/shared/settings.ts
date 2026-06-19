export type IntegrationConnectionStatus = {
  key:
    | "google-oauth"
    | "discord-bot"
    | "google-gmail"
    | "dataforseo"
    | "openai"
    | "shopify"
    | "database";
  label: string;
  configured: boolean;
  accountLabel: string;
  detail: string;
  error?: string | null;
  authUrl?: string | null;
  profile?: {
    id: string | null;
    name: string | null;
    email: string | null;
    verifiedEmail: boolean;
    picture: string | null;
  } | null;
};

export type IntegrationsStatusResponse = {
  connections: IntegrationConnectionStatus[];
};

export type KeywordDifficultyLevel = {
  label: string;
  maxScore: number;
};

export type KeywordDifficultyLevelsSettings = {
  levels: KeywordDifficultyLevel[];
};

export type KeywordVolumeThresholdsSettings = {
  lowMax: number;
  mediumMax: number;
  highMin: number;
};

export type BusinessPositioningKeyword = {
  id: string;
  keyword: string;
  volume?: number | null;
  difficulty?: number | null;
  searchIntent?: string | null;
  isFavorite?: boolean;
  source?: string;
  lengthType?: string | null;
  lastScannedAt?: string | null;
};

export type BusinessPositioningSettings = {
  websiteUrl: string;
  offering: string;
  differentiator: string;
  problemsSolved: string;
  keywords: BusinessPositioningKeyword[];
  isComplete: boolean;
};

export type PromptConfigSettings = {
  key: string;
  model: string;
  instructions: string;
  input: string;
  maxOutputTokens: number;
};
