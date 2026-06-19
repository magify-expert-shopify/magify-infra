<script setup lang="ts">
import type { BlogArticle, SeoCluster } from "~/types/domain";
import SeoClusterArticlesCard from "~/components/clusters/SeoClusterArticlesCard.vue";
import SeoClusterChildCreateModal from "~/components/clusters/SeoClusterChildCreateModal.vue";
import SeoClusterDescendantArticlesCard from "~/components/clusters/SeoClusterDescendantArticlesCard.vue";
import SeoClusterKeywordGroupsModal from "~/components/clusters/SeoClusterKeywordGroupsModal.vue";
import SeoClusterIdeasModal from "~/components/clusters/SeoClusterIdeasModal.vue";
import SeoClusterPillarArticleModal from "~/components/clusters/SeoClusterPillarArticleModal.vue";
import SeoClusterPillarKeywordGroupModal from "~/components/clusters/SeoClusterPillarKeywordGroupModal.vue";
import SeoClusterPillarCard from "~/components/clusters/SeoClusterPillarCard.vue";
import SeoClusterParentModal from "~/components/clusters/SeoClusterParentModal.vue";
import { buildKeywordResearchUrl } from "~/utils/keyword-research-url";
import { normalizeSearchText } from "~/utils/search-normalizer";

const route = useRoute();
const clusterId = computed(() => String(route.params.id ?? ""));
const {
  clearClusterPillar,
  createSeoCluster,
  createClusterPillarArticle,
  setClusterPillarFromArticle,
  updateSeoCluster,
  useSeoCluster,
  listSeoClusters,
} = useSeoClusters();
const { listKeywordGroups } = useKeywords();
const { assignBlogArticleCluster, useBlogArticleIdeasList } = useBlogArticles();
const {
  data: cluster,
  error,
  refresh: refreshCluster,
  status,
} = await useSeoCluster(clusterId.value);
const { data: keywordGroups } = await useAsyncData(
  `seo-cluster:${clusterId.value}:keyword-groups`,
  () => listKeywordGroups(),
);
const { data: ideas } = await useBlogArticleIdeasList();

const isIdeasModalOpen = ref(false);
const isChildClusterModalOpen = ref(false);
const isPillarArticleModalOpen = ref(false);
const isParentClusterModalOpen = ref(false);
const isKeywordGroupsModalOpen = ref(false);
const isPillarKeywordGroupModalOpen = ref(false);
const ideasSearch = ref("");
const parentClusterSearch = ref("");
const keywordGroupSearch = ref("");
const isSubmittingChildCluster = ref(false);
const isUpdatingKeywordGroups = ref(false);
const isUpdatingPillarKeywordGroup = ref(false);
const assigningIdeaId = ref<string | null>(null);
const isAssigningAllIdeas = ref(false);
const isClearingPillar = ref(false);
const isCreatingPillarArticle = ref(false);
const selectingPillarArticleId = ref<string | null>(null);
const unassigningArticleId = ref<string | null>(null);
const isUpdatingParentCluster = ref(false);
const isLoadingParentClusters = ref(false);
const childClusterFormErrorMessage = ref<string | null>(null);
const ideasFilterMode = ref<"unassigned" | "all" | "parent-clusters">(
  "unassigned",
);
const clusterArticles = ref<BlogArticle[]>([]);
const descendantClusterArticles = ref<BlogArticle[]>([]);
const localIdeas = ref<BlogArticle[]>([]);
const selectedKeywordGroupIds = ref<string[]>([]);
const selectedPillarKeywordGroupId = ref<string | null>(null);
const childClusterForm = reactive({
  name: "",
  slug: "",
  icon: "",
  description: "",
  primaryKeyword: "",
});

const sortedKeywordGroups = computed(() =>
  [...(keywordGroups.value ?? [])].sort((left, right) =>
    left.name.localeCompare(right.name),
  ),
);

const keywordGroupIdsWithAssociatedPage = computed(() => {
  const pageKeywordGroupIds = new Set(
    (cluster.value?.pages ?? [])
      .map((page) => page.keywordGroupId?.trim())
      .filter((keywordGroupId): keywordGroupId is string => !!keywordGroupId),
  );

  return pageKeywordGroupIds;
});

const availableKeywordGroups = computed(() =>
  sortedKeywordGroups.value.filter((keywordGroup) => {
    if (!cluster.value?.pillarKeywordGroupId) {
      return true;
    }

    return keywordGroup.id !== cluster.value.pillarKeywordGroupId;
  }),
);

const pillarKeywordGroup = computed(() => {
  const pillarKeywordGroupId = cluster.value?.pillarKeywordGroupId?.trim();

  if (!pillarKeywordGroupId) {
    return cluster.value?.pillarKeywordGroup ?? null;
  }

  return (
    sortedKeywordGroups.value.find((keywordGroup) => keywordGroup.id === pillarKeywordGroupId) ??
    cluster.value?.pillarKeywordGroup ??
    null
  );
});

const parentClusterIds = computed(() => {
  const currentCluster = cluster.value;

  if (!currentCluster) {
    return [];
  }

  return (currentCluster.parentClusters ?? [])
    .map((parentCluster) => parentCluster.id)
    .filter(Boolean);
});

const pillarPage = computed(() => {
  const clusterPages = cluster.value?.pages ?? [];

  return clusterPages.find((page) => page.seoRole === "PILLAR") ?? null;
});

const pillarArticleId = computed(() => {
  if (!pillarPage.value) {
    return null;
  }

  const articleIdFromPageUrl = getArticleIdFromInternalArticleUrl(
    pillarPage.value.url,
  );

  if (articleIdFromPageUrl) {
    return (
      clusterArticles.value.find(
        (article) => article.id === articleIdFromPageUrl,
      )?.id ?? null
    );
  }

  const pillarSlug = pillarPage.value.slug?.trim();

  if (!pillarSlug) {
    return null;
  }

  return (
    clusterArticles.value.find((article) => {
      const articleSlug = article.slug?.trim();

      return !!articleSlug && articleSlug === pillarSlug;
    })?.id ?? null
  );
});

const pillarArticle = computed(
  () =>
    clusterArticles.value.find(
      (article) => article.id === pillarArticleId.value,
    ) ?? null,
);

const hasChildClusters = computed(() => !!cluster.value?.childClusters?.length);
const breadcrumbItems = computed(() => {
  const items = [
    {
      label: "Clusters",
      to: "/clusters",
    },
  ];

  const hierarchy = [
    ...(cluster.value?.parentClusters ?? []),
    ...(cluster.value
      ? [
          {
            id: cluster.value.id,
            name: cluster.value.name,
          },
        ]
      : []),
  ];

  for (const item of hierarchy) {
    items.push({
      label: item.name,
    });
  }

  return items;
});

const clusterHierarchyLabel = computed(() => {
  const level = cluster.value?.parentClusters?.length ?? 0;

  if (level <= 0) {
    return "Niveau 0";
  }

  return `Niveau ${level}`;
});

watch(
  cluster,
  (value) => {
    clusterArticles.value = value?.blogArticles ? [...value.blogArticles] : [];
    descendantClusterArticles.value = value?.descendantBlogArticles
      ? [...value.descendantBlogArticles]
      : [];
  },
  { immediate: true },
);

watch(
  ideas,
  (value) => {
    localIdeas.value = value ? [...value] : [];
  },
  { immediate: true },
);

const availableIdeas = computed(() => {
  const currentClusterId = cluster.value?.id;
  const searchTerms = ideasSearch.value
    .split(/\r?\n/)
    .map((value) => normalizeSearchText(value))
    .filter(Boolean);

  return localIdeas.value.filter((idea) => {
    const isAlreadyAssignedToCurrentCluster =
      idea.cluster?.id === currentClusterId;
    const isAssignedToAnotherCluster =
      !!idea.cluster?.id && idea.cluster.id !== currentClusterId;
    const isAssignedToParentCluster =
      !!idea.cluster?.id && parentClusterIds.value.includes(idea.cluster.id);

    if (isAlreadyAssignedToCurrentCluster) {
      return false;
    }

    if (ideasFilterMode.value === "unassigned" && isAssignedToAnotherCluster) {
      return false;
    }

    if (
      ideasFilterMode.value === "parent-clusters" &&
      !isAssignedToParentCluster
    ) {
      return false;
    }

    if (!searchTerms.length) {
      return true;
    }

    const normalizedTitle = normalizeSearchText(idea.title);

    return searchTerms.some((searchTerm) =>
      normalizedTitle.includes(searchTerm),
    );
  });
});

const availableParentClusters = computed(() => {
  const currentCluster = cluster.value;
  const search = normalizeSearchText(parentClusterSearch.value);

  if (!currentCluster) {
    return [];
  }

  return (parentClustersList.value ?? []).filter((item) => {
    if (item.id === currentCluster.id) {
      return false;
    }

    const matchesSearch = !search
      ? true
      : [item.name, item.slug, item.primaryKeyword]
          .filter((value): value is string => typeof value === "string")
          .some((value) => normalizeSearchText(value).includes(search));

    return matchesSearch;
  });
});

const parentClustersList = ref<
  Array<{
    id: string;
    name: string;
    slug?: string | null;
    primaryKeyword?: string | null;
  }>
>([]);

function toLucideIconName(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return "i-lucide-folder-kanban";
  }

  return `i-lucide-${trimmed.replace(/^i-lucide-/, "")}`;
}

function openIdeasModal() {
  ideasSearch.value = "";
  ideasFilterMode.value = "unassigned";
  isIdeasModalOpen.value = true;
}

function closeIdeasModal() {
  isIdeasModalOpen.value = false;
  ideasSearch.value = "";
}

function openChildClusterModal() {
  resetChildClusterForm();
  isChildClusterModalOpen.value = true;
}

function closeChildClusterModal() {
  isChildClusterModalOpen.value = false;
  resetChildClusterForm();
}

function openPillarArticleModal() {
  isPillarArticleModalOpen.value = true;
}

function closePillarArticleModal() {
  isPillarArticleModalOpen.value = false;
}

function openParentClusterModal() {
  parentClusterSearch.value = "";
  void loadParentClusters();
  isParentClusterModalOpen.value = true;
}

function closeParentClusterModal() {
  isParentClusterModalOpen.value = false;
  parentClusterSearch.value = "";
}

function openKeywordGroupsModal() {
  keywordGroupSearch.value = "";
  selectedKeywordGroupIds.value = (cluster.value?.keywordGroups ?? [])
    .map((keywordGroup) => keywordGroup.id)
    .filter((id) => id !== cluster.value?.pillarKeywordGroupId);
  isKeywordGroupsModalOpen.value = true;
}

function openPillarKeywordGroupModal() {
  selectedPillarKeywordGroupId.value = cluster.value?.pillarKeywordGroupId ?? null;
  isPillarKeywordGroupModalOpen.value = true;
}

function closePillarKeywordGroupModal() {
  isPillarKeywordGroupModalOpen.value = false;
  selectedPillarKeywordGroupId.value = null;
}

function closeKeywordGroupsModal() {
  isKeywordGroupsModalOpen.value = false;
  keywordGroupSearch.value = "";
}

function resetChildClusterForm() {
  childClusterForm.name = "";
  childClusterForm.slug = "";
  childClusterForm.icon = "";
  childClusterForm.description = "";
  childClusterForm.primaryKeyword = "";
  childClusterFormErrorMessage.value = null;
}

function toggleKeywordGroupSelection(keywordGroupId: string) {
  const nextSelectedKeywordGroupIds = selectedKeywordGroupIds.value.includes(
    keywordGroupId,
  )
    ? selectedKeywordGroupIds.value.filter((id) => id !== keywordGroupId)
    : [...selectedKeywordGroupIds.value, keywordGroupId];

  selectedKeywordGroupIds.value = nextSelectedKeywordGroupIds.filter(
    (id) => id !== cluster.value?.pillarKeywordGroupId,
  );
}

async function submitKeywordGroups() {
  if (!cluster.value || isUpdatingKeywordGroups.value) {
    return;
  }

  isUpdatingKeywordGroups.value = true;

  try {
    await updateSeoCluster(cluster.value.id, {
      secondaryKeywordGroupIds: selectedKeywordGroupIds.value,
    });
    await refreshCluster();
    await refreshNuxtData("seo-clusters");
    closeKeywordGroupsModal();
  } catch (submissionError) {
    console.error(submissionError);
  } finally {
    isUpdatingKeywordGroups.value = false;
  }
}

async function submitPillarKeywordGroup(keywordGroupId: string) {
  if (!cluster.value?.id || isUpdatingPillarKeywordGroup.value) {
    return;
  }

  isUpdatingPillarKeywordGroup.value = true;
  selectedPillarKeywordGroupId.value = keywordGroupId;

  try {
    await updateSeoCluster(cluster.value.id, {
      pillarKeywordGroupId: keywordGroupId,
    });
    await refreshCluster();
    await refreshNuxtData("seo-clusters");
    closePillarKeywordGroupModal();
  } catch (error) {
    console.error(error);
  } finally {
    isUpdatingPillarKeywordGroup.value = false;
  }
}

function toSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getArticleIdFromInternalArticleUrl(url?: string | null) {
  const trimmedUrl = url?.trim();

  if (!trimmedUrl) {
    return null;
  }

  const match = trimmedUrl.match(/\/articles\/([^/?#]+)/i);

  return match?.[1] ?? null;
}

async function addIdeaToCluster(idea: BlogArticle) {
  if (!cluster.value?.id || assigningIdeaId.value) {
    return;
  }

  assigningIdeaId.value = idea.id;

  try {
    const updatedIdea = await assignBlogArticleCluster(
      idea.id,
      cluster.value.id,
    );

    clusterArticles.value = [updatedIdea, ...clusterArticles.value];
    localIdeas.value = localIdeas.value.filter(
      (currentIdea) => currentIdea.id !== idea.id,
    );

    if (cluster.value?._count) {
      cluster.value._count.blogArticles += 1;
    }

    await Promise.all([
      refreshCluster(),
      refreshNuxtData("blog-article-ideas"),
    ]);
  } catch (error) {
    console.error(error);
  } finally {
    assigningIdeaId.value = null;
  }
}

async function addVisibleIdeasToCluster() {
  if (
    !cluster.value?.id ||
    isAssigningAllIdeas.value ||
    !availableIdeas.value.length
  ) {
    return;
  }

  isAssigningAllIdeas.value = true;

  try {
    const visibleIdeas = [...availableIdeas.value];
    const updatedIdeas: BlogArticle[] = [];

    for (const idea of visibleIdeas) {
      const updatedIdea = await assignBlogArticleCluster(
        idea.id,
        cluster.value.id,
      );
      updatedIdeas.push(updatedIdea);
    }

    clusterArticles.value = [
      ...updatedIdeas.reverse(),
      ...clusterArticles.value,
    ];
    const updatedIdeaIds = new Set(updatedIdeas.map((idea) => idea.id));
    localIdeas.value = localIdeas.value.filter(
      (currentIdea) => !updatedIdeaIds.has(currentIdea.id),
    );

    if (cluster.value?._count?.blogArticles !== undefined) {
      cluster.value._count.blogArticles += updatedIdeas.length;
    }

    if (cluster.value?.articleCount !== undefined) {
      cluster.value.articleCount += updatedIdeas.length;
    }

    await Promise.all([
      refreshCluster(),
      refreshNuxtData("blog-article-ideas"),
    ]);
  } catch (error) {
    console.error(error);
  } finally {
    isAssigningAllIdeas.value = false;
  }
}

async function removeArticleFromCluster(article: BlogArticle) {
  if (unassigningArticleId.value) {
    return;
  }

  unassigningArticleId.value = article.id;

  try {
    const updatedArticle = await assignBlogArticleCluster(article.id, null);

    clusterArticles.value = clusterArticles.value.filter(
      (currentArticle) => currentArticle.id !== article.id,
    );

    if (updatedArticle.status === "IDEA") {
      localIdeas.value = [updatedArticle, ...localIdeas.value];
    }

    if (cluster.value?._count?.blogArticles !== undefined) {
      cluster.value._count.blogArticles = Math.max(
        0,
        cluster.value._count.blogArticles - 1,
      );
    }

    if (cluster.value?.articleCount !== undefined) {
      cluster.value.articleCount = Math.max(0, cluster.value.articleCount - 1);
    }
  } catch (error) {
    console.error(error);
  } finally {
    unassigningArticleId.value = null;
  }
}

async function updateParentCluster(parentClusterId?: string | null) {
  if (!cluster.value?.id || isUpdatingParentCluster.value) {
    return;
  }

  isUpdatingParentCluster.value = true;

  try {
    await updateSeoCluster(cluster.value.id, {
      parentClusterId: parentClusterId ?? null,
    });
    await refreshCluster();
    closeParentClusterModal();
  } catch (error) {
    console.error(error);
  } finally {
    isUpdatingParentCluster.value = false;
  }
}

async function loadParentClusters() {
  if (isLoadingParentClusters.value) {
    return;
  }

  isLoadingParentClusters.value = true;

  try {
    parentClustersList.value = await listSeoClusters();
  } catch (error) {
    console.error(error);
  } finally {
    isLoadingParentClusters.value = false;
  }
}

async function selectPillarArticle(article: BlogArticle) {
  if (!cluster.value?.id || selectingPillarArticleId.value) {
    return;
  }

  selectingPillarArticleId.value = article.id;

  try {
    await setClusterPillarFromArticle(cluster.value.id, article.id);
    closePillarArticleModal();
    await refreshCluster();
  } catch (error) {
    console.error(error);
  } finally {
    selectingPillarArticleId.value = null;
  }
}

async function createPillarArticle() {
  if (!cluster.value?.id || isCreatingPillarArticle.value) {
    return;
  }

  isCreatingPillarArticle.value = true;

  try {
    const article = await createClusterPillarArticle(cluster.value.id);
    await navigateTo(`/articles/${article.id}`);
  } catch (error) {
    console.error(error);
  } finally {
    isCreatingPillarArticle.value = false;
  }
}

async function clearPillar() {
  if (!cluster.value?.id || isClearingPillar.value) {
    return;
  }

  isClearingPillar.value = true;

  try {
    await clearClusterPillar(cluster.value.id);
    await refreshCluster();
  } catch (error) {
    console.error(error);
  } finally {
    isClearingPillar.value = false;
  }
}

watch(
  () => childClusterForm.name,
  (value) => {
    childClusterForm.slug = toSlug(value);
  },
);

async function submitChildCluster() {
  if (
    !cluster.value?.id ||
    isSubmittingChildCluster.value ||
    !childClusterForm.name.trim() ||
    !childClusterForm.slug.trim() ||
    !childClusterForm.primaryKeyword.trim()
  ) {
    return;
  }

  isSubmittingChildCluster.value = true;
  childClusterFormErrorMessage.value = null;

  try {
    const createdCluster = await createSeoCluster({
      name: childClusterForm.name.trim(),
      parentClusterId: cluster.value.id,
      slug: childClusterForm.slug.trim(),
      icon: childClusterForm.icon.trim().replace(/^i-lucide-/, ""),
      description: childClusterForm.description.trim(),
      primaryKeyword: childClusterForm.primaryKeyword.trim(),
    });

    if (cluster.value) {
      const nextChildClusters = [...(cluster.value.childClusters ?? [])];

      nextChildClusters.unshift({
        id: createdCluster.id,
        name: createdCluster.name,
        slug: createdCluster.slug ?? null,
      });

      cluster.value = {
        ...cluster.value,
        childClusters: nextChildClusters,
      } as SeoCluster;
    }

    await refreshNuxtData("seo-clusters");
    closeChildClusterModal();
  } catch (error) {
    childClusterFormErrorMessage.value = "Impossible de créer le sous-cluster.";
    console.error(error);
  } finally {
    isSubmittingChildCluster.value = false;
  }
}
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-3">
      <UBreadcrumb v-if="breadcrumbItems.length > 1" :items="breadcrumbItems" />

      <p v-if="status === 'pending'" class="text-sm text-slate-500">
        Chargement du cluster...
      </p>

      <FeedbackRichMessage
        v-else-if="error"
        tone="error"
        :details="error.toString()"
        title="Impossible de charger ce cluster"
        description="Les informations détaillées du cluster n'ont pas pu être récupérées."
      />

      <template v-else-if="cluster">
        <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div
            class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
          >
            <div class="flex items-start gap-4">
              <span
                class="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-100"
              >
                <UIcon :name="toLucideIconName(cluster.icon)" class="h-7 w-7" />
              </span>

              <div class="space-y-3">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <h1 class="text-3xl font-semibold text-slate-900">
                      {{ cluster.name }}
                    </h1>

                    <UBadge
                      v-if="cluster.isFavorite"
                      color="warning"
                      variant="soft"
                      class="rounded-full"
                    >
                      Favori
                    </UBadge>
                    <UBadge
                      v-if="cluster.isSprintCluster"
                      color="primary"
                      variant="soft"
                      class="rounded-full"
                    >
                      Cluster du sprint
                    </UBadge>
                  </div>

                  <UButton
                    :to="`/clusters/edit/${cluster.id}`"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-pencil"
                    class="shrink-0"
                  >
                    <!-- Modifier -->
                  </UButton>
                </div>

                <p class="text-sm text-slate-500">/{{ cluster.slug || "-" }}</p>

                <div class="flex flex-wrap gap-2">
                  <UBadge variant="soft" color="neutral" class="rounded-full">
                    {{
                      cluster.articleCount ?? cluster._count?.blogArticles ?? 0
                    }}
                    article{{
                      (cluster.articleCount ??
                        cluster._count?.blogArticles ??
                        0) > 1
                        ? "s"
                        : ""
                    }}
                  </UBadge>
                  <UBadge
                    as="NuxtLink"
                    :to="buildKeywordResearchUrl(cluster.primaryKeyword, { autorun: false })"
                    variant="soft"
                    color="primary"
                    class="rounded-full transition hover:bg-primary-100 hover:text-primary-700"
                  >
                    {{ cluster.primaryKeyword }}
                  </UBadge>
                </div>
              </div>
            </div>

            <div class="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <div class="rounded-2xl bg-slate-50 px-4 py-3">
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Type de cluster
                </p>
                <p class="mt-1 font-medium text-slate-900">
                  {{ clusterHierarchyLabel }}
                </p>
              </div>

              <div class="rounded-2xl bg-slate-50 px-4 py-3">
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Parent
                </p>
                <NuxtLink
                  v-if="cluster.parentCluster"
                  :to="`/clusters/${cluster.parentCluster.id}`"
                  class="mt-1 inline-flex items-center gap-2 font-medium text-slate-900 transition hover:text-sky-700"
                >
                  <UIcon
                    name="i-lucide-arrow-up-right"
                    class="h-4 w-4 text-slate-400"
                  />
                  <span>{{ cluster.parentCluster.name }}</span>
                </NuxtLink>
                <p v-else class="mt-1 font-medium text-slate-900">
                  {{ cluster.parentCluster?.name || "-" }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
          <div class="space-y-4">
            <div
              v-if="cluster.description"
              class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p
                class="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Description
              </p>
              <p class="mt-3 text-sm leading-6 text-slate-700">
                {{ cluster.description }}
              </p>
            </div>

            <SeoClusterArticlesCard
              :articles="clusterArticles"
              :pillar-article-id="pillarArticleId"
              :unassigning-article-id="unassigningArticleId"
              @add-ideas="openIdeasModal"
              @remove="removeArticleFromCluster"
            />

            <div
              class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div class="flex items-center justify-between gap-3">
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Sujets
                </p>

                <UButton
                  size="sm"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-plus"
                  @click="openKeywordGroupsModal"
                >
                  Ajouter
                </UButton>
              </div>

              <div
                v-if="cluster.keywordGroups?.length"
                class="mt-4 flex flex-wrap gap-2"
              >
                <NuxtLink
                  v-for="keywordGroup in cluster.keywordGroups"
                  :key="keywordGroup.id"
                  :to="`/keyword-groups/${keywordGroup.id}`"
                  class="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition"
                  :class="
                    keywordGroup.id === cluster.pillarKeywordGroupId
                      ? 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100'
                      : keywordGroupIdsWithAssociatedPage.has(keywordGroup.id)
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700'
                  "
                >
                  <span class="truncate">{{ keywordGroup.name }}</span>
                  <span
                    v-if="keywordGroup.id === cluster.pillarKeywordGroupId"
                    class="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
                  >
                    Pilier
                  </span>
                  <span
                    v-else-if="
                      keywordGroupIdsWithAssociatedPage.has(keywordGroup.id)
                    "
                    class="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                  >
                    Page
                  </span>
                </NuxtLink>
              </div>

              <p v-else class="mt-4 text-sm text-slate-500">
                Aucun KeywordGroup associé pour le moment.
              </p>
            </div>

            <SeoClusterDescendantArticlesCard
              v-if="hasChildClusters"
              :articles="descendantClusterArticles"
            />
          </div>

          <div class="space-y-4">
            <SeoClusterPillarCard
              :pillar-page="pillarPage"
              :pillar-article="pillarArticle"
              :pillar-keyword-group="pillarKeywordGroup"
              :has-cluster-articles="clusterArticles.length > 0"
              :has-available-keyword-groups="availableKeywordGroups.length > 0"
              :is-clearing-pillar="isClearingPillar"
              :is-creating-pillar-article="isCreatingPillarArticle"
              :is-selecting-pillar-article="!!selectingPillarArticleId"
              @choose-article="openPillarArticleModal"
              @choose-keyword-group="openPillarKeywordGroupModal"
              @clear-pillar="clearPillar"
              @create-article="createPillarArticle"
            />

            <div
              class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div class="flex items-center justify-between gap-3">
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Cluster parent
                </p>

                <UButton
                  size="sm"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-git-compare-arrows"
                  @click="openParentClusterModal"
                >
                  Changer le parent
                </UButton>
              </div>

              <div
                v-if="cluster.parentClusters?.length"
                class="mt-4 flex flex-wrap items-center gap-2"
              >
                <template
                  v-for="(parentCluster, index) in cluster.parentClusters"
                  :key="parentCluster.id"
                >
                  <NuxtLink
                    :to="`/clusters/${parentCluster.id}`"
                    class="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                  >
                    {{ parentCluster.name }}
                  </NuxtLink>

                  <UIcon
                    v-if="index < cluster.parentClusters.length - 1"
                    name="i-lucide-chevron-right"
                    class="h-4 w-4 text-slate-400"
                  />
                </template>
              </div>

              <p v-else class="mt-4 text-sm text-slate-500">
                Aucun cluster parent pour le moment.
              </p>
            </div>

            <div
              class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div class="flex items-center justify-between gap-3">
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Clusters enfants
                </p>

                <UButton
                  size="sm"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-plus"
                  @click="openChildClusterModal"
                >
                  Ajouter un sous-cluster
                </UButton>
              </div>

              <div
                v-if="cluster.childClusters?.length"
                class="mt-4 flex flex-wrap gap-2"
              >
                <NuxtLink
                  v-for="childCluster in cluster.childClusters"
                  :key="childCluster.id"
                  :to="`/clusters/${childCluster.id}`"
                  class="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                >
                  {{ childCluster.name }}
                </NuxtLink>
              </div>

              <p v-else class="mt-3 text-sm text-slate-500">
                Aucun sous-cluster pour le moment.
              </p>
            </div>
          </div>
        </div>
      </template>
    </div>

    <SeoClusterIdeasModal
      :open="isIdeasModalOpen"
      :ideas-search="ideasSearch"
      :ideas-filter-mode="ideasFilterMode"
      :available-ideas="availableIdeas"
      :assigning-idea-id="assigningIdeaId"
      :is-assigning-all-ideas="isAssigningAllIdeas"
      @close="closeIdeasModal"
      @update:ideas-search="ideasSearch = $event"
      @update:ideas-filter-mode="ideasFilterMode = $event"
      @add-idea="addIdeaToCluster"
      @add-all="addVisibleIdeasToCluster"
    />

    <SeoClusterPillarArticleModal
      :open="isPillarArticleModalOpen"
      :articles="clusterArticles"
      :selecting-article-id="selectingPillarArticleId"
      @close="closePillarArticleModal"
      @select="selectPillarArticle"
    />

    <SeoClusterPillarKeywordGroupModal
      :open="isPillarKeywordGroupModalOpen"
      :keyword-groups="availableKeywordGroups"
      :selected-keyword-group-id="selectedPillarKeywordGroupId"
      :submitting="isUpdatingPillarKeywordGroup"
      @close="closePillarKeywordGroupModal"
      @select="submitPillarKeywordGroup"
    />

    <SeoClusterParentModal
      :open="isParentClusterModalOpen"
      :parent-cluster-search="parentClusterSearch"
      :available-parent-clusters="availableParentClusters"
      :current-parent-cluster-id="cluster?.parentCluster?.id ?? null"
      :has-parent-cluster="!!cluster?.parentCluster"
      :is-updating-parent-cluster="isUpdatingParentCluster"
      @close="closeParentClusterModal"
      @update:parent-cluster-search="parentClusterSearch = $event"
      @select-parent="updateParentCluster"
    />

    <SeoClusterChildCreateModal
      :open="isChildClusterModalOpen"
      :is-submitting="isSubmittingChildCluster"
      :error-message="childClusterFormErrorMessage"
      :parent-cluster-name="cluster?.name ?? ''"
      :form="childClusterForm"
      @close="closeChildClusterModal"
      @submit="submitChildCluster"
    />

    <SeoClusterKeywordGroupsModal
      :open="isKeywordGroupsModalOpen"
      :search="keywordGroupSearch"
      :selected-keyword-group-ids="selectedKeywordGroupIds"
      :available-keyword-groups="availableKeywordGroups"
      :pillar-keyword-group-id="cluster?.pillarKeywordGroupId ?? null"
      :is-submitting="isUpdatingKeywordGroups"
      @close="closeKeywordGroupsModal"
      @update:search="keywordGroupSearch = $event"
      @update:selected-keyword-group-ids="selectedKeywordGroupIds = $event"
      @submit="submitKeywordGroups"
    />
  </section>
</template>
