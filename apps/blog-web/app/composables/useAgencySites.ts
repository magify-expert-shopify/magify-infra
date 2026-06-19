import type { AgencySite } from "~/types/domain";

export function useAgencySites() {
  const { request } = useApi();

  function useAgencySitesList() {
    return useAsyncData("agency-sites", () =>
      request<AgencySite[]>("/agency-sites"),
    );
  }

  async function deleteAgencySite(id: string) {
    await request(`/agency-sites/${id}`, {
      method: "DELETE",
    });
  }

  async function discoverAgencySiteBlogs(
    id: string,
    mode: "sync" | "async" = "async",
  ) {
    return await request(`/agency-sites/${id}/discover-blogs`, {
      method: "POST",
      body: {
        mode,
      },
    });
  }

  async function discoverAgencySitesBlogs(
    ids: string[],
    mode: "sync" | "async" = "async",
  ) {
    return await request("/agency-sites/discover-blogs", {
      method: "POST",
      body: {
        mode,
        ids,
      },
    });
  }

  return {
    useAgencySitesList,
    deleteAgencySite,
    discoverAgencySiteBlogs,
    discoverAgencySitesBlogs,
  };
}
