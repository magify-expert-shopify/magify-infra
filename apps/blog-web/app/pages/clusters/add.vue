<script setup lang="ts">
import SeoClusterFormModal from "~/components/clusters/SeoClusterFormModal.vue";
import type { SeoCluster } from "~/types/domain";
import type { KeywordGroupRecord } from "~/types/keywords";

const route = useRoute();
const { createSeoCluster, useSeoClustersList } = useSeoClusters();
const { listKeywordGroups } = useKeywords();

const isSubmittingCluster = ref(false);
const clusterFormErrorMessage = ref<string | null>(null);
const breadcrumbItems = [
  {
    label: "Clusters",
    to: "/clusters",
  },
  {
    label: "Ajouter un cluster",
  },
];

const {
  data: clusters,
  status: clustersStatus,
  error,
} = await useSeoClustersList();
const { data: keywordGroups, status: keywordGroupsStatus } = await useAsyncData(
  "seo-clusters:add:keyword-groups",
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
  return new Map(
    (clusters.value ?? []).map((cluster) => [cluster.id, cluster] as const),
  );
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
  const primaryKeyword =
    selectedPillarKeywordGroup.value?.primaryKeyword?.trim();

  if (!primaryKeyword) {
    return "";
  }

  return toSlug(primaryKeyword);
});

const availableParentClusters = computed(() => allClustersSorted.value);

const availableChildClusters = computed(() => {
  const blockedIds = new Set<string>();

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

watch(
  () => route.query.parentClusterId,
  (value) => {
    const parentClusterId = typeof value === "string" ? value : "";

    if (parentClusterId) {
      form.parentClusterId = parentClusterId;
    }
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
    } else {
      form.slug = "";
    }
  },
  { immediate: true },
);

watch(
  selectedPillarKeywordGroup,
  (keywordGroup) => {
    const primaryKeyword = keywordGroup?.primaryKeyword?.trim() ?? "";

    form.primaryKeyword = primaryKeyword;
  },
  { immediate: true },
);

watch(
  availableChildClusters,
  (clustersList) => {
    const allowedIds = new Set(clustersList.map((cluster) => cluster.id));
    const filteredChildClusterIds = form.childClusterIds.filter((id) =>
      allowedIds.has(id),
    );

    if (filteredChildClusterIds.length !== form.childClusterIds.length) {
      form.childClusterIds = filteredChildClusterIds;
    }
  },
  { immediate: true },
);

function toggleChildCluster(clusterId: string) {
  const nextChildClusterIds = form.childClusterIds.includes(clusterId)
    ? form.childClusterIds.filter((id) => id !== clusterId)
    : [...form.childClusterIds, clusterId];

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
  void navigateTo("/clusters");
}

function getAncestorClusterIds(clusterId: string) {
  const ancestors = new Set<string>();
  let currentParentId =
    clustersById.value.get(clusterId)?.parentClusterId ?? null;

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
    !form.name.trim() ||
    !form.slug.trim() ||
    !form.primaryKeyword.trim() ||
    !form.pillarKeywordGroupId.trim()
  ) {
    return;
  }

  isSubmittingCluster.value = true;
  clusterFormErrorMessage.value = null;

  try {
    const createdCluster = await createSeoCluster({
      name: form.name.trim(),
      parentClusterId: form.parentClusterId || undefined,
      slug: form.slug.trim(),
      icon: form.icon.trim().replace(/^i-lucide-/, ""),
      pillarKeywordGroupId: form.pillarKeywordGroupId || undefined,
      secondaryKeywordGroupIds: form.secondaryKeywordGroupIds,
      childClusterIds: form.childClusterIds,
      description: form.description.trim(),
      primaryKeyword: form.primaryKeyword.trim(),
    });

    await navigateTo(`/clusters/${createdCluster.id}`);
  } catch (submissionError) {
    clusterFormErrorMessage.value = "Impossible de créer le cluster.";
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
          Ajouter un cluster
        </h1>
        <p class="text-sm text-slate-500">
          Créez un cluster et liez-le à un groupe pilier puis à ses groupes secondaires.
        </p>
      </div>

      <UButton to="/clusters" variant="soft" color="neutral" icon="i-lucide-arrow-left">
        Retour
      </UButton>
    </header> -->

    <FeedbackInlineMessage
      v-if="clustersStatus === 'pending' || keywordGroupsStatus === 'pending'"
      tone="info"
    >
      Préparation du formulaire...
    </FeedbackInlineMessage>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :details="error.toString()"
      title="Impossible de charger les clusters"
      description="La liste des clusters n'a pas pu être récupérée."
    />

    <div
      v-else
      class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <SeoClusterFormModal
        inline
        :open="true"
        :is-editing="false"
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
