type SerpReviewItemDto = {
  position: number;
  type: string;
  title: string;
  url: string;
  checkUrl?: string;
  snippet: string;
  knownAgencySite?: {
    id: string;
    name: string;
    baseUrl: string;
  } | null;
};

export class AnalyzeKeywordWithAiDto {
  keyword!: string;
  volume!: number;
  difficulty!: number;
  intent!: string;
  serpResults!: SerpReviewItemDto[];
}
