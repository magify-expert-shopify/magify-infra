import type {
  BlogArticle,
  ClusterPage,
  CreateSeoClusterInput,
  SeoCluster,
  UpdateSeoClusterInput,
} from "~/types/domain";

type SeoClusterSuggestionResponse = {
  keywordGroup: {
    id: string;
    name: string;
    description?: string | null;
    primaryKeyword?: string | null;
  };
  suggestedClusterId?: string | null;
  suggestedCluster?: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
  reason: string;
  responseId?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  } | null;
};

export function useSeoClusters() {
  const { request } = useApi();

  function useSeoClustersList() {
    return useAsyncData("seo-clusters", () =>
      request<SeoCluster[]>("/seo-clusters").then(enrichSeoClusters),
    );
  }

  async function listSeoClusters() {
    const clusters = await request<SeoCluster[]>("/seo-clusters");

    return enrichSeoClusters(clusters);
  }

  function useSeoCluster(id: string) {
    return useAsyncData(`seo-cluster:${id}`, () =>
      Promise.all([
        request<SeoCluster>(`/seo-clusters/${id}`),
        request<SeoCluster[]>("/seo-clusters"),
      ]).then(([cluster, clusters]) => enrichSingleSeoCluster(cluster, clusters)),
    );
  }

  async function createSeoCluster(input: CreateSeoClusterInput) {
    return await request<SeoCluster>("/seo-clusters", {
      method: "POST",
      body: input,
    });
  }

  async function updateSeoCluster(id: string, input: UpdateSeoClusterInput) {
    return await request<SeoCluster>(`/seo-clusters/${id}`, {
      method: "PATCH",
      body: input,
    });
  }

  async function deleteSeoCluster(id: string) {
    return await request(`/seo-clusters/${id}`, {
      method: "DELETE",
    });
  }

  async function setClusterPillarFromArticle(clusterId: string, articleId: string) {
    return await request<ClusterPage>(`/seo-clusters/${clusterId}/pillar/from-article`, {
      method: "POST",
      body: {
        articleId,
      },
    });
  }

  async function createClusterPillarArticle(clusterId: string) {
    return await request<BlogArticle>(`/seo-clusters/${clusterId}/pillar/create-article`, {
      method: "POST",
    });
  }

  async function suggestClusterForKeywordGroup(keywordGroupId: string) {
    return await request<SeoClusterSuggestionResponse>(
      `/seo-clusters/keyword-groups/${keywordGroupId}/suggest-cluster`,
      {
        method: "POST",
      },
    );
  }

  async function clearClusterPillar(clusterId: string) {
    return await request<{ success: boolean }>(`/seo-clusters/${clusterId}/pillar/clear`, {
      method: "POST",
    });
  }

  return {
    useSeoCluster,
    useSeoClustersList,
    listSeoClusters,
    createSeoCluster,
    updateSeoCluster,
    deleteSeoCluster,
    setClusterPillarFromArticle,
    createClusterPillarArticle,
    clearClusterPillar,
    suggestClusterForKeywordGroup,
  };
}

function enrichSeoClusters(clusters: SeoCluster[]) {
  const clustersById = new Map(clusters.map((cluster) => [cluster.id, cluster]));
  const articleCountByClusterId = buildSeoClusterArticleCountMap(clustersById);

  return clusters.map((cluster) =>
    enrichSeoCluster(cluster, clustersById, articleCountByClusterId),
  );
}

function enrichSingleSeoCluster(
  cluster: SeoCluster,
  allClusters: SeoCluster[],
) {
  const clustersById = new Map(allClusters.map((item) => [item.id, item]));
  const articleCountByClusterId = buildSeoClusterArticleCountMap(clustersById);

  return enrichSeoCluster(cluster, clustersById, articleCountByClusterId);
}

function enrichSeoCluster(
  cluster: SeoCluster,
  clustersById: Map<string, SeoCluster>,
  articleCountByClusterId: Map<string, number>,
) {
  return {
    ...cluster,
    hierarchyLevel: getSeoClusterHierarchyLevel(cluster, clustersById),
    articleCount: articleCountByClusterId.get(cluster.id) ?? 0,
  };
}

function buildSeoClusterArticleCountMap(clustersById: Map<string, SeoCluster>) {
  const childrenByParentId = new Map<string, string[]>();

  for (const cluster of clustersById.values()) {
    const parentId = cluster.parentClusterId;

    if (!parentId) {
      continue;
    }

    const children = childrenByParentId.get(parentId) ?? [];
    children.push(cluster.id);
    childrenByParentId.set(parentId, children);
  }

  const memo = new Map<string, number>();

  function getArticleCount(clusterId: string): number {
    const cachedCount = memo.get(clusterId);

    if (cachedCount !== undefined) {
      return cachedCount;
    }

    const cluster = clustersById.get(clusterId);

    if (!cluster) {
      return 0;
    }

    const directCount = cluster._count?.blogArticles ?? 0;
    const childCount = (childrenByParentId.get(clusterId) ?? []).reduce(
      (total, childClusterId) => total + getArticleCount(childClusterId),
      0,
    );
    const totalCount = directCount + childCount;

    memo.set(clusterId, totalCount);

    return totalCount;
  }

  for (const clusterId of clustersById.keys()) {
    getArticleCount(clusterId);
  }

  return memo;
}

function getSeoClusterHierarchyLevel(
  cluster: SeoCluster,
  clustersById: Map<string, SeoCluster>,
): 0 | 1 | 2 {
  let level = 0;
  let currentParentId = cluster.parentClusterId ?? null;

  while (currentParentId && level < 2) {
    level += 1;
    currentParentId = clustersById.get(currentParentId)?.parentClusterId ?? null;
  }

  return level as 0 | 1 | 2;
}
