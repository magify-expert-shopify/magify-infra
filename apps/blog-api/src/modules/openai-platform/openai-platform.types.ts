import { OpenAiPromptType } from 'src/common/types';

export type OpenAiPlatformRequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
};

export type OpenAiResponseCreateInput = {
  model: string;
  input: unknown;
  instructions?: string;
  promptType?: OpenAiPromptType;
  reasoning?: {
    effort: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
    summary?: 'auto' | 'concise' | 'detailed';
  };
  text?: {
    format?: {
      type: 'text' | 'json_object' | 'json_schema';
      name?: string;
      description?: string;
      schema?: unknown;
      strict?: boolean;
    };
  };
  tools?: unknown[];
  temperature?: number;
  max_output_tokens?: number;
  stream?: boolean;
  metadata?: Record<string, string>;
};

export type OpenAiResponseObject = {
  id: string;
  object: string;
  model?: string;
  output?: unknown[];
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};
