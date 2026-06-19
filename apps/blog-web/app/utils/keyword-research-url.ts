export function buildKeywordResearchUrl(
  keyword: string,
  options?: {
    autorun?: boolean;
    language?: string;
    country?: string;
  },
) {
  const params = new URLSearchParams();
  const normalizedKeyword = keyword.trim();

  if (normalizedKeyword) {
    params.set("q", normalizedKeyword);
  }

  if (options?.autorun === false) {
    params.set("autorun", "0");
  }

  if (options?.language?.trim()) {
    params.set("hl", options.language.trim());
  }

  if (options?.country?.trim()) {
    params.set("gl", options.country.trim());
  }

  const query = params.toString();

  return query ? `/keywords/research?${query}` : "/keywords/research";
}
