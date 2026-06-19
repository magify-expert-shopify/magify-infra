export function useSearch() {
  const { request } = useApi();

  async function search(query: string) {
    return await request<SearchResponse>("/search", {
      query: {
        q: query,
      },
    });
  }

  return {
    search,
  };
}
