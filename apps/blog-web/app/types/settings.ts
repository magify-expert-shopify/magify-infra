import type { Project } from "~/types/projects";
import type { OpenAiPromptType } from "./shared";

export type OpenAiCacheEntryOutput = {
  format: "json" | "text";
  content: string;
};

export type OpenAiCacheEntry = {
  id: string;
  endpoint: string;
  model?: string | null;
  promptType: OpenAiPromptType;
  promptTypeLabel: string;
  cacheKey: string;
  input: string;
  instructions: string;
  output: OpenAiCacheEntryOutput;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string;
  expiresAt?: string | null;
};

export type OpenAiCachePromptTypeOption = {
  type: OpenAiPromptType;
  label: string;
};

export type OpenAiCacheResponse = {
  activePromptType: OpenAiPromptType | null;
  promptTypes: OpenAiCachePromptTypeOption[];
  entries: OpenAiCacheEntry[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
};

export type PreferredAuthorProfileSettings = {
  authorId: string | null;
};

export type CurrentProjectSettings = {
  project: Project | null;
};
