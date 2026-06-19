<script setup lang="ts">
import type { KeywordGroupRecord } from "~/types/keywords";
import type { SeoCluster } from "~/types/domain";
import SeoClusterOrphansModal from "~/components/clusters/SeoClusterOrphansModal.vue";
import AppViewModeSwitch from "~/components/common/AppViewModeSwitch.vue";
import { usePages } from "~/composables/usePages";
import { normalizeSearchText } from "~/utils/search-normalizer";

const {
  useSeoClustersList,
  createSeoCluster,
  updateSeoCluster,
  deleteSeoCluster,
} = useSeoClusters();
const { listKeywordGroups } = useKeywords();
const { listPages, updatePage } = usePages();

const isClusterModalOpen = ref(false);
const isOrphansModalOpen = ref(false);
const editingClusterId = ref<string | null>(null);
const isSubmittingCluster = ref(false);
const deletingClusterId = ref<string | null>(null);
const clusterFormErrorMessage = ref<string | null>(null);
const clusterModalRenderKey = ref(0);
const clustersViewMode = useCookie<"cards" | "table">("clusters-view-mode", {
  default: () => "cards",
});
const clusterSearch = ref("");
const cardsGridElement = ref<HTMLElement | null>(null);
const isCardsGridMenuOpen = ref(false);
const cardsGridMenuPosition = reactive({
  x: 0,
  y: 0,
});
const breadcrumbItems = [
  {
    label: "Clusters",
  },
  {
    label: "Liste",
  },
];
const { data: clusters, error, status } = await useSeoClustersList();
const { data: keywordGroups } = await useAsyncData(
  "seo-clusters:keyword-groups",
  () => listKeywordGroups(),
);
const { data: pages, status: pagesStatus } = await useAsyncData(
  "seo-clusters:pages",
  () => listPages(),
);

const form = reactive({
  name: "",
  parentClusterId: "",
  slug: "",
  icon: "",
  pillarKeywordGroupId: "",
  secondaryKeywordGroupIds: [] as string[],
  description: "",
  primaryKeyword: "",
  childClusterIds: [] as string[],
});

const filteredClusters = computed(() => {
  const search = normalizeSearchText(clusterSearch.value);

  if (!search) {
    return clusters.value ?? [];
  }

  return (clusters.value ?? []).filter((cluster) =>
    [
      cluster.name,
      cluster.slug,
      cluster.primaryKeyword,
      cluster.description,
      cluster.parentCluster?.name,
    ]
      .filter((value): value is string => typeof value === "string")
      .some((value) => normalizeSearchText(value).includes(search)),
  );
});

const sortedClusters = computed(() =>
  [...filteredClusters.value].sort((left, right) => {
    const leftIsFavorite = !!left.isFavorite;
    const rightIsFavorite = !!right.isFavorite;

    if (leftIsFavorite !== rightIsFavorite) {
      return leftIsFavorite ? -1 : 1;
    }

    const leftIsRoot = !left.parentClusterId;
    const rightIsRoot = !right.parentClusterId;

    if (leftIsRoot === rightIsRoot) {
      return 0;
    }

    return leftIsRoot ? -1 : 1;
  }),
);

const allClustersSorted = computed(() =>
  [...(clusters.value ?? [])].sort((left, right) =>
    left.name.localeCompare(right.name),
  ),
);

const editingClusterDescendantIds = computed(() =>
  editingClusterId.value
    ? getDescendantClusterIds(editingClusterId.value)
    : new Set<string>(),
);

const availableParentClusters = computed(() =>
  allClustersSorted.value.filter((cluster) => {
    if (cluster.id === editingClusterId.value) {
      return false;
    }

    if (!editingClusterId.value) {
      return true;
    }

    return !editingClusterDescendantIds.value.has(cluster.id);
  }),
);

const keywordGroupsById = computed(() => {
  return new Map(
    (keywordGroups.value ?? []).map(
      (keywordGroup) => [keywordGroup.id, keywordGroup] as const,
    ),
  );
});

const sortedKeywordGroups = computed(() =>
  [...(keywordGroups.value ?? [])].sort((left, right) =>
    left.name.localeCompare(right.name),
  ),
);

const availableChildClusters = computed(() => {
  const blockedIds = new Set<string>();

  if (editingClusterId.value) {
    blockedIds.add(editingClusterId.value);

    for (const ancestorId of getAncestorClusterIds(editingClusterId.value)) {
      blockedIds.add(ancestorId);
    }
  }

  if (form.parentClusterId) {
    blockedIds.add(form.parentClusterId);

    for (const ancestorId of getAncestorClusterIds(form.parentClusterId)) {
      blockedIds.add(ancestorId);
    }
  }

  return allClustersSorted.value.filter(
    (cluster) => !blockedIds.has(cluster.id),
  );
});

const selectedPillarKeywordGroup = computed<KeywordGroupRecord | null>(() => {
  if (!form.pillarKeywordGroupId) {
    return null;
  }

  return keywordGroupsById.value.get(form.pillarKeywordGroupId) ?? null;
});

const derivedClusterSlug = computed(() => {
  const primaryKeyword =
    selectedPillarKeywordGroup.value?.primaryKeyword?.trim();

  if (!primaryKeyword) {
    return "";
  }

  return toSlug(primaryKeyword);
});

const isEditingCluster = computed(() => !!editingClusterId.value);

watch(
  derivedClusterSlug,
  (value) => {
    if (value) {
      form.slug = value;
    } else if (!isEditingCluster.value) {
      form.slug = "";
    }
  },
  { immediate: true },
);

watch(
  selectedPillarKeywordGroup,
  (keywordGroup) => {
    const primaryKeyword = keywordGroup?.primaryKeyword?.trim() ?? "";

    if (primaryKeyword) {
      form.primaryKeyword = primaryKeyword;
    } else if (!isEditingCluster.value) {
      form.primaryKeyword = "";
    }
  },
  { immediate: true },
);

watch(
  availableChildClusters,
  (clusters) => {
    const allowedIds = new Set(clusters.map((cluster) => cluster.id));
    const filteredChildClusterIds = form.childClusterIds.filter((id) =>
      allowedIds.has(id),
    );

    if (filteredChildClusterIds.length !== form.childClusterIds.length) {
      form.childClusterIds = filteredChildClusterIds;
    }
  },
  { immediate: true },
);

function openCreateModal(parentCluster?: SeoCluster) {
  void navigateTo({
    path: "/clusters/add",
    query: parentCluster?.id
      ? {
          parentClusterId: parentCluster.id,
        }
      : undefined,
  });
}

function openEditModal(cluster: SeoCluster) {
  void navigateTo(`/clusters/edit/${cluster.id}`);
}

function closeClusterModal() {
  isClusterModalOpen.value = false;
  editingClusterId.value = null;
  resetForm();
}

function openOrphansModal() {
  isOrphansModalOpen.value = true;
}

function closeOrphansModal() {
  isOrphansModalOpen.value = false;
}

function getClusterSecondaryKeywordGroupIds(cluster: SeoCluster) {
  return (cluster.keywordGroups ?? [])
    .map((keywordGroup) => keywordGroup.id)
    .filter(
      (keywordGroupId) => keywordGroupId !== cluster.pillarKeywordGroupId,
    );
}

async function moveOrphanKeywordGroupToCluster(payload: {
  keywordGroupId: string;
  clusterId: string;
}) {
  const targetCluster = (clusters.value ?? []).find(
    (cluster) => cluster.id === payload.clusterId,
  );

  if (!targetCluster) {
    return;
  }

  const nextSecondaryKeywordGroupIds = [
    ...new Set([
      ...getClusterSecondaryKeywordGroupIds(targetCluster),
      payload.keywordGroupId,
    ]),
  ];

  try {
    const updatedCluster = await updateSeoCluster(targetCluster.id, {
      secondaryKeywordGroupIds: nextSecondaryKeywordGroupIds,
    });

    const nextKeywordGroupCluster = {
      id: targetCluster.id,
      name: targetCluster.name,
      slug: targetCluster.slug ?? null,
    };

    keywordGroups.value = (keywordGroups.value ?? []).map((item) =>
      item.id === payload.keywordGroupId
        ? {
            ...item,
            seoCluster: nextKeywordGroupCluster,
          }
        : item,
    );

    const targetClusterEntry = (clusters.value ?? []).find(
      (item) => item.id === targetCluster.id,
    );

    if (targetClusterEntry) {
      const currentKeywordGroups = Array.isArray(
        targetClusterEntry.keywordGroups,
      )
        ? targetClusterEntry.keywordGroups
        : [];
      const nextKeywordGroups = [
        ...currentKeywordGroups.filter(
          (item: { id: string }) => item.id !== payload.keywordGroupId,
        ),
      ];

      nextKeywordGroups.push({
        ...((keywordGroups.value ?? []).find(
          (item) => item.id === payload.keywordGroupId,
        ) ?? {
          id: payload.keywordGroupId,
          name: "",
          keywords: [],
        }),
        seoCluster: nextKeywordGroupCluster,
      });

      clusters.value = (clusters.value ?? []).map((cluster) =>
        cluster.id === targetCluster.id
          ? {
              ...cluster,
              ...updatedCluster,
              keywordGroups: nextKeywordGroups,
            }
          : cluster,
      );
    }
  } catch (error) {
    console.error(error);
  }
}

async function moveOrphanPageToCluster(payload: {
  pageId: string;
  clusterId: string;
}) {
  try {
    await updatePage(payload.pageId, {
      clusterId: payload.clusterId,
    });
    await Promise.all([
      refreshNuxtData("seo-clusters"),
      refreshNuxtData("seo-clusters:keyword-groups"),
      refreshNuxtData("seo-clusters:pages"),
    ]);
  } catch (error) {
    console.error(error);
  }
}

function openCardsGridContextMenu(event: MouseEvent) {
  const currentTarget = event.currentTarget;

  if (!(currentTarget instanceof HTMLElement)) {
    return;
  }

  const rect = currentTarget.getBoundingClientRect();
  cardsGridMenuPosition.x = event.clientX - rect.left;
  cardsGridMenuPosition.y = event.clientY - rect.top;
  isCardsGridMenuOpen.value = true;
}

function onDocumentClick() {
  isCardsGridMenuOpen.value = false;
}

function resetForm() {
  form.name = "";
  form.parentClusterId = "";
  form.slug = "";
  form.icon = "";
  form.pillarKeywordGroupId = "";
  form.secondaryKeywordGroupIds = [];
  form.description = "";
  form.primaryKeyword = "";
  form.childClusterIds = [];
  clusterFormErrorMessage.value = null;
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

function getAncestorClusterIds(clusterId: string) {
  const ancestors = new Set<string>();
  const clustersById = new Map(
    (clusters.value ?? []).map((cluster) => [cluster.id, cluster] as const),
  );
  let currentParentId = clustersById.get(clusterId)?.parentClusterId ?? null;

  while (currentParentId) {
    if (ancestors.has(currentParentId)) {
      break;
    }

    ancestors.add(currentParentId);
    currentParentId =
      clustersById.get(currentParentId)?.parentClusterId ?? null;
  }

  return ancestors;
}

function getDescendantClusterIds(clusterId: string) {
  const descendants = new Set<string>();
  const childrenByParentId = new Map<string, string[]>();

  for (const cluster of clusters.value ?? []) {
    if (!cluster.parentClusterId) {
      continue;
    }

    const children = childrenByParentId.get(cluster.parentClusterId) ?? [];
    children.push(cluster.id);
    childrenByParentId.set(cluster.parentClusterId, children);
  }

  const queue = [...(childrenByParentId.get(clusterId) ?? [])];

  while (queue.length) {
    const currentClusterId = queue.shift();

    if (!currentClusterId || descendants.has(currentClusterId)) {
      continue;
    }

    descendants.add(currentClusterId);
    queue.push(...(childrenByParentId.get(currentClusterId) ?? []));
  }

  return descendants;
}

async function submitCluster() {
  if (
    isSubmittingCluster.value ||
    !form.name.trim() ||
    !form.slug.trim() ||
    !form.primaryKeyword.trim() ||
    (!isEditingCluster.value && !form.pillarKeywordGroupId.trim())
  ) {
    return;
  }

  isSubmittingCluster.value = true;
  clusterFormErrorMessage.value = null;

  try {
    const payload = {
      name: form.name.trim(),
      parentClusterId: form.parentClusterId || undefined,
      slug: form.slug.trim(),
      icon: form.icon.trim().replace(/^i-lucide-/, ""),
      pillarKeywordGroupId: form.pillarKeywordGroupId || undefined,
      secondaryKeywordGroupIds: form.secondaryKeywordGroupIds,
      childClusterIds: form.childClusterIds,
      description: form.description.trim(),
      primaryKeyword: form.primaryKeyword.trim(),
    };

    if (editingClusterId.value) {
      await updateSeoCluster(editingClusterId.value, {
        ...payload,
        parentClusterId: form.parentClusterId || null,
      });
    } else {
      await createSeoCluster(payload);
    }

    await refreshNuxtData("seo-clusters");
    closeClusterModal();
  } catch (error) {
    clusterFormErrorMessage.value = isEditingCluster.value
      ? "Impossible de modifier le cluster."
      : "Impossible de créer le cluster.";
    console.error(error);
  } finally {
    isSubmittingCluster.value = false;
  }
}

async function removeCluster(cluster: SeoCluster) {
  if (deletingClusterId.value) {
    return;
  }

  const confirmed = window.confirm(`Supprimer le cluster "${cluster.name}" ?`);

  if (!confirmed) {
    return;
  }

  deletingClusterId.value = cluster.id;

  try {
    await deleteSeoCluster(cluster.id);
    await refreshNuxtData("seo-clusters");
  } catch (error) {
    console.error(error);
  } finally {
    deletingClusterId.value = null;
  }
}

async function toggleFavorite(cluster: SeoCluster) {
  try {
    await updateSeoCluster(cluster.id, {
      isFavorite: !cluster.isFavorite,
    });
    await refreshNuxtData("seo-clusters");
  } catch (error) {
    console.error(error);
  }
}

async function toggleSprintCluster(cluster: SeoCluster) {
  try {
    await updateSeoCluster(cluster.id, {
      isSprintCluster: !cluster.isSprintCluster,
    });
    await refreshNuxtData("seo-clusters");
  } catch (error) {
    console.error(error);
  }
}

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onDocumentClick);
});
</script>

<template>
  <section class="relative space-y-6">
    <UBreadcrumb :items="breadcrumbItems" />

    <header class="flex items-end gap-4 sm:items-start sm:justify-between">
      <!-- <div class="space-y-1">
        <h1 class="text-2xl font-semibold text-slate-900">Clusters SEO</h1>
        <p class="text-sm text-slate-500">
          Organisez vos clusters et préparez leur structuration éditoriale.
        </p>
      </div> -->
    </header>

    <div class="fixed right-4 bottom-4 z-50 flex flex-col gap-2 md:right-6">
      <UTooltip
        text="Sans cluster"
        :delay-duration="150"
        :content="{ side: 'left' }"
      >
        <UButton
          color="neutral"
          variant="soft"
          square
          class="flex h-12 w-12 items-center justify-center rounded-full p-0 shadow-lg"
          icon="i-lucide-scan-search"
          @click="openOrphansModal"
        />
      </UTooltip>

      <UTooltip
        text="Ajouter un cluster"
        :delay-duration="150"
        :content="{ side: 'left' }"
      >
        <UButton
          square
          class="flex h-12 w-12 items-center justify-center rounded-full p-0 shadow-lg"
          icon="i-lucide-plus"
          @click="openCreateModal"
        />
      </UTooltip>
    </div>

    <FeedbackInlineMessage v-if="status === 'pending'" tone="info" class="mt-2">
      Chargement des clusters...
    </FeedbackInlineMessage>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :details="error.toString()"
      title="Impossible de charger les clusters"
      description="La liste des clusters n'a pas pu être récupérée."
    />

    <template v-else>
      <div
        class="flex flex-col items-end gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="relative w-full sm:max-w-sm">
          <input
            v-model="clusterSearch"
            type="text"
            placeholder="Filtrer les clusters..."
            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pl-10 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          />
          <div
            class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"
          >
            <UIcon name="i-lucide-search" class="h-4 w-4" />
          </div>
        </div>

        <AppViewModeSwitch
          v-model="clustersViewMode"
          :items="[
            { value: 'cards', label: 'Cards', icon: 'i-lucide-layout-grid' },
            {
              value: 'table',
              label: 'Tableau',
              icon: 'i-lucide-table-properties',
            },
          ]"
        />
      </div>

      <div
        v-if="!(clusters?.length ?? 0)"
        class="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm"
      >
        <p class="text-base font-medium text-slate-900">
          Aucun cluster pour le moment
        </p>
        <p class="mt-2 text-sm text-slate-500">
          Créez un premier cluster via le bouton ci-dessus.
        </p>
      </div>

      <div
        v-else-if="!sortedClusters.length"
        class="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm"
      >
        <p class="text-base font-medium text-slate-900">
          Aucun cluster ne correspond à ce filtre
        </p>
        <p class="mt-2 text-sm text-slate-500">
          Essayez un autre nom, slug ou mot-clé principal.
        </p>
      </div>

      <div
        v-else-if="clustersViewMode === 'cards'"
        ref="cardsGridElement"
        class="relative grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
        @contextmenu.prevent="openCardsGridContextMenu"
      >
        <ClustersSeoClusterCard
          v-for="cluster in sortedClusters"
          :key="cluster.id"
          :cluster="cluster"
          :deleting="deletingClusterId === cluster.id"
          @create-child="openCreateModal"
          @edit="openEditModal"
          @delete="removeCluster"
          @toggle-favorite="toggleFavorite"
          @toggle-sprint-cluster="toggleSprintCluster"
        />

        <div
          v-if="isCardsGridMenuOpen"
          class="absolute z-20 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"
          :style="{
            left: `${cardsGridMenuPosition.x}px`,
            top: `${cardsGridMenuPosition.y}px`,
          }"
          @click.stop
        >
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
            @click="openCreateModal"
          >
            <UIcon name="i-lucide-plus" class="h-4 w-4" />
            <span>Ajouter un cluster</span>
          </button>
        </div>
      </div>

      <ClustersSeoClusterTable
        v-else
        :clusters="sortedClusters"
        :deleting-cluster-id="deletingClusterId"
        @edit="openEditModal"
        @delete="removeCluster"
        @toggle-favorite="toggleFavorite"
        @toggle-sprint-cluster="toggleSprintCluster"
      />
    </template>

    <ClustersSeoClusterFormModal
      :key="clusterModalRenderKey"
      :open="isClusterModalOpen"
      :is-editing="isEditingCluster"
      :is-submitting="isSubmittingCluster"
      :error-message="clusterFormErrorMessage"
      :form="form"
      :available-parent-clusters="availableParentClusters"
      :available-keyword-groups="sortedKeywordGroups"
      :available-child-clusters="availableChildClusters"
      @close="closeClusterModal"
      @submit="submitCluster"
    />

    <SeoClusterOrphansModal
      :open="isOrphansModalOpen"
      :keyword-groups="keywordGroups ?? []"
      :pages="pages ?? []"
      :clusters="clusters ?? []"
      :is-loading="status === 'pending' || pagesStatus === 'pending'"
      @close="closeOrphansModal"
      @move:keyword-group="moveOrphanKeywordGroupToCluster"
      @move:page="moveOrphanPageToCluster"
    />
  </section>
</template>
