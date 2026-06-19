<script setup lang="ts">
import SeoClusterFormModal from "~/components/clusters/SeoClusterFormModal.vue";
import type { SeoCluster } from "~/types/domain";
import type { KeywordGroupRecord } from "~/types/keywords";

const route = useRoute();
const clusterId = computed(() => String(route.params.id ?? ""));
const { updateSeoCluster, useSeoCluster, useSeoClustersList } = useSeoClusters();
const { listKeywordGroups } = useKeywords();

const isSubmittingCluster = ref(false);
const clusterFormErrorMessage = ref<string | null>(null);
type BreadcrumbItem = {
  label: string;
  to?: string;
};

const breadcrumbItems = computed<BreadcrumbItem[]>(() => [
  {
    label: "Clusters",
    to: "/clusters",
  },
  {
    label: cluster.value?.name || "Cluster",
    to: cluster.value ? `/clusters/${cluster.value.id}` : undefined,
  },
  {
    label: "Modifier le cluster",
  },
]);

const {
  data: cluster,
  error,
  status,
} = await useSeoCluster(clusterId.value);
const { data: clusters, status: clustersStatus } = await useSeoClustersList();
const { data: keywordGroups, status: keywordGroupsStatus } = await useAsyncData(
  "seo-clusters:edit:keyword-groups",
  () => listKeywordGroups(),
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

const clustersById = computed(() => {
  return new Map((clusters.value ?? []).map((item) => [item.id, item] as const));
});

const sortedKeywordGroups = computed(() =>
  [...(keywordGroups.value ?? [])].sort((left, right) =>
    left.name.localeCompare(right.name),
  ),
);

const keywordGroupsById = computed(() => {
  return new Map(
    (keywordGroups.value ?? []).map(
      (keywordGroup) => [keywordGroup.id, keywordGroup] as const,
    ),
  );
});

const allClustersSorted = computed(() =>
  [...(clusters.value ?? [])].sort((left, right) =>
    left.name.localeCompare(right.name),
  ),
);

const editingClusterDescendantIds = computed(() =>
  cluster.value ? getDescendantClusterIds(cluster.value.id) : new Set<string>(),
);

const availableParentClusters = computed(() =>
  allClustersSorted.value.filter((item) => {
    if (item.id === cluster.value?.id) {
      return false;
    }

    if (!cluster.value) {
      return true;
    }

    return !editingClusterDescendantIds.value.has(item.id);
  }),
);

const selectedPillarKeywordGroup = computed<KeywordGroupRecord | null>(() => {
  if (!form.pillarKeywordGroupId) {
    return null;
  }

  return keywordGroupsById.value.get(form.pillarKeywordGroupId) ?? null;
});

const selectedParentCluster = computed(() => {
  if (!form.parentClusterId) {
    return null;
  }

  return clustersById.value.get(form.parentClusterId) ?? null;
});

const derivedClusterSlug = computed(() => {
  const primaryKeyword = selectedPillarKeywordGroup.value?.primaryKeyword?.trim();

  if (!primaryKeyword) {
    return "";
  }

  return toSlug(primaryKeyword);
});

const availableChildClusters = computed(() => {
  const blockedIds = new Set<string>();

  if (cluster.value) {
    blockedIds.add(cluster.value.id);

    for (const ancestorId of getAncestorClusterIds(cluster.value.id)) {
      blockedIds.add(ancestorId);
    }
  }

  if (form.parentClusterId) {
    blockedIds.add(form.parentClusterId);

    for (const ancestorId of getAncestorClusterIds(form.parentClusterId)) {
      blockedIds.add(ancestorId);
    }
  }

  return allClustersSorted.value.filter((item) => !blockedIds.has(item.id));
});

watch(
  cluster,
  (value) => {
    if (!value) {
      return;
    }

    form.name = value.name;
    form.parentClusterId = value.parentClusterId ?? "";
    form.slug = value.slug ?? "";
    form.icon = value.icon?.replace(/^i-lucide-/, "") ?? "";
    form.pillarKeywordGroupId = value.pillarKeywordGroupId ?? "";
    form.secondaryKeywordGroupIds = (value.keywordGroups ?? [])
      .map((keywordGroup) => keywordGroup.id)
      .filter((keywordGroupId) => keywordGroupId !== value.pillarKeywordGroupId);
    form.description = value.description ?? "";
    form.primaryKeyword = value.primaryKeyword;
    form.childClusterIds = (value.childClusters ?? []).map(
      (childCluster) => childCluster.id,
    );
  },
  { immediate: true },
);

watch(
  selectedParentCluster,
  (parentCluster) => {
    if (!parentCluster?.icon?.trim() || form.icon.trim()) {
      return;
    }

    form.icon = parentCluster.icon.replace(/^i-lucide-/, "");
  },
  { immediate: true },
);

watch(
  derivedClusterSlug,
  (value) => {
    if (value) {
      form.slug = value;
    } else if (!form.slug.trim()) {
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
    }
  },
  { immediate: true },
);

watch(
  availableChildClusters,
  (clustersList) => {
    const allowedIds = new Set(clustersList.map((item) => item.id));
    const filteredChildClusterIds = form.childClusterIds.filter((id) =>
      allowedIds.has(id),
    );

    if (filteredChildClusterIds.length !== form.childClusterIds.length) {
      form.childClusterIds = filteredChildClusterIds;
    }
  },
  { immediate: true },
);

function toggleChildCluster(clusterIdValue: string) {
  const nextChildClusterIds = form.childClusterIds.includes(clusterIdValue)
    ? form.childClusterIds.filter((id) => id !== clusterIdValue)
    : [...form.childClusterIds, clusterIdValue];

  form.childClusterIds = nextChildClusterIds;
}

function toggleSecondaryKeywordGroup(keywordGroupId: string) {
  const nextSecondaryKeywordGroupIds = form.secondaryKeywordGroupIds.includes(
    keywordGroupId,
  )
    ? form.secondaryKeywordGroupIds.filter((id) => id !== keywordGroupId)
    : [...form.secondaryKeywordGroupIds, keywordGroupId];

  form.secondaryKeywordGroupIds = nextSecondaryKeywordGroupIds.filter(
    (id) => id !== form.pillarKeywordGroupId,
  );
}

function selectKeywordGroup(keywordGroup: KeywordGroupRecord) {
  if (!keywordGroup.primaryKeyword?.trim()) {
    return;
  }

  form.pillarKeywordGroupId = keywordGroup.id;
}

function closePage() {
  void navigateTo(cluster.value ? `/clusters/${cluster.value.id}` : "/clusters");
}

function getAncestorClusterIds(clusterIdValue: string) {
  const ancestors = new Set<string>();
  let currentParentId =
    clustersById.value.get(clusterIdValue)?.parentClusterId ?? null;

  while (currentParentId) {
    if (ancestors.has(currentParentId)) {
      break;
    }

    ancestors.add(currentParentId);
    currentParentId =
      clustersById.value.get(currentParentId)?.parentClusterId ?? null;
  }

  return ancestors;
}

function getDescendantClusterIds(clusterIdValue: string) {
  const descendants = new Set<string>();
  const childrenByParentId = new Map<string, string[]>();

  for (const item of clusters.value ?? []) {
    if (!item.parentClusterId) {
      continue;
    }

    const children = childrenByParentId.get(item.parentClusterId) ?? [];
    children.push(item.id);
    childrenByParentId.set(item.parentClusterId, children);
  }

  const queue = [...(childrenByParentId.get(clusterIdValue) ?? [])];

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

function toSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function submitCluster() {
  if (
    isSubmittingCluster.value ||
    !cluster.value ||
    !form.name.trim() ||
    !form.slug.trim() ||
    !form.primaryKeyword.trim()
  ) {
    return;
  }

  isSubmittingCluster.value = true;
  clusterFormErrorMessage.value = null;

  try {
    await updateSeoCluster(cluster.value.id, {
      name: form.name.trim(),
      parentClusterId: form.parentClusterId || null,
      slug: form.slug.trim(),
      icon: form.icon.trim().replace(/^i-lucide-/, ""),
      pillarKeywordGroupId: form.pillarKeywordGroupId || null,
      secondaryKeywordGroupIds: form.secondaryKeywordGroupIds,
      childClusterIds: form.childClusterIds,
      description: form.description.trim(),
      primaryKeyword: form.primaryKeyword.trim(),
    });

    await navigateTo(`/clusters/${cluster.value.id}`);
  } catch (submissionError) {
    clusterFormErrorMessage.value = "Impossible de modifier le cluster.";
    console.error(submissionError);
  } finally {
    isSubmittingCluster.value = false;
  }
}
</script>

<template>
  <section class="space-y-6">
    <UBreadcrumb :items="breadcrumbItems" class="text-slate-500" />

    <!-- <header class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold text-slate-900">
          Modifier le cluster
        </h1>
        <p class="text-sm text-slate-500">
          Mettez à jour la structure éditoriale, les groupes liés et le lien hiérarchique.
        </p>
      </div>

      <UButton
        :to="cluster ? `/clusters/${cluster.id}` : '/clusters'"
        variant="soft"
        color="neutral"
        icon="i-lucide-arrow-left"
      >
        Retour
      </UButton>
    </header> -->

    <FeedbackInlineMessage
      v-if="status === 'pending' || clustersStatus === 'pending' || keywordGroupsStatus === 'pending'"
      tone="info"
    >
      Chargement du cluster...
    </FeedbackInlineMessage>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :details="error.toString()"
      title="Impossible de charger le cluster"
      description="Le cluster demandé n'a pas pu être récupéré."
    />

    <div v-else class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <SeoClusterFormModal
        inline
        :open="true"
        :is-editing="true"
        :is-submitting="isSubmittingCluster"
        :error-message="clusterFormErrorMessage"
        :form="form"
        :available-parent-clusters="availableParentClusters"
        :available-keyword-groups="sortedKeywordGroups"
        :available-child-clusters="availableChildClusters"
        @close="closePage"
        @submit="submitCluster"
      />
    </div>
  </section>
</template>
