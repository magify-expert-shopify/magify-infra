export class UpsertKeywordDto {
  keyword!: string;
  volume?: number | null;
  difficulty?: number | null;
  searchIntent?: string | null;
}
