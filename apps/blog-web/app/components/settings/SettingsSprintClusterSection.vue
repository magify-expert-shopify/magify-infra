<script setup lang="ts">
import { normalizeSearchText } from "~/utils/search-normalizer";

const { getSprintCluster, updateSprintCluster } = useSettings();
const { useSeoClustersList } = useSeoClusters();
const { data: clusters } = await useSeoClustersList();

const sprintClusterId = ref("");
const savedSprintClusterId = ref("");

const sprintClusterSearch = ref("");
const isSprintClusterSuggestionsOpen = ref(false);
const isLoading = ref(true);
const isSavingSprintCluster = ref(false);
const sprintClusterFeedbackMessage = ref("");

const sprintClusterOptions = computed(() =>
  (clusters.value ?? []).map((cluster) => ({
    label: cluster.name,
    value: cluster.id,
  })),
);

const selectedSprintClusterLabel = computed(
  () =>
    sprintClusterOptions.value.find(
      (option) => option.value === sprintClusterId.value,
    )?.label ?? "",
);

const filteredSprintClusterOptions = computed(() => {
  const search = normalizeSearchText(sprintClusterSearch.value);

  if (!search) {
    return sprintClusterOptions.value.slice(0, 8);
  }

  return sprintClusterOptions.value
    .filter((option) => normalizeSearchText(option.label).includes(search))
    .slice(0, 8);
});

const hasSprintClusterChanges = computed(
  () => sprintClusterId.value !== savedSprintClusterId.value,
);

async function loadSprintCluster() {
  isLoading.value = true;

  try {
    const sprintClusterSettings = await getSprintCluster();
    sprintClusterId.value = sprintClusterSettings.clusterId ?? "";
    savedSprintClusterId.value = sprintClusterSettings.clusterId ?? "";
    sprintClusterSearch.value = sprintClusterSettings.clusterName ?? "";
  } finally {
    isLoading.value = false;
  }
}

async function saveSprintCluster() {
  if (isSavingSprintCluster.value) {
    return;
  }

  isSavingSprintCluster.value = true;
  sprintClusterFeedbackMessage.value = "";

  try {
    const response = await updateSprintCluster(sprintClusterId.value || null);
    sprintClusterId.value = response.clusterId ?? "";
    savedSprintClusterId.value = response.clusterId ?? "";
    sprintClusterSearch.value = response.clusterName ?? "";
    isSprintClusterSuggestionsOpen.value = false;
    sprintClusterFeedbackMessage.value = response.clusterId
      ? "Cluster du sprint enregistré."
      : "Cluster du sprint retiré.";
  } finally {
    isSavingSprintCluster.value = false;
  }
}

function selectSprintCluster(clusterId: string, clusterName: string) {
  sprintClusterId.value = clusterId;
  sprintClusterSearch.value = clusterName;
  isSprintClusterSuggestionsOpen.value = false;
}

function clearSprintClusterSelection() {
  sprintClusterId.value = "";
  sprintClusterSearch.value = "";
  isSprintClusterSuggestionsOpen.value = false;
}

watch(sprintClusterSearch, (value) => {
  if (value.trim() !== selectedSprintClusterLabel.value.trim()) {
    sprintClusterId.value = "";
  }
});

onMounted(() => {
  void loadSprintCluster();
});
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex flex-col gap-4">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-slate-900">Cluster du sprint</h2>
        <p class="text-sm leading-6 text-slate-500">
          Choisissez le cluster à travailler spécifiquement pendant le sprint en
          cours.
        </p>
      </div>

      <div
        v-if="isLoading"
        class="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500"
      >
        Chargement du cluster du sprint...
      </div>

      <template v-else>
        <label class="block text-sm font-medium text-slate-700">
          <span class="mb-2 block">Cluster du sprint</span>

          <div class="relative">
            <input
              v-model="sprintClusterSearch"
              type="text"
              placeholder="Rechercher un cluster..."
              class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-24 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              @focus="isSprintClusterSuggestionsOpen = true"
            />

            <div
              class="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400"
            >
              <UIcon name="i-lucide-search" class="h-4 w-4" />
            </div>

            <button
              v-if="sprintClusterSearch || sprintClusterId"
              type="button"
              class="absolute right-10 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              @click="clearSprintClusterSelection"
            >
              <UIcon name="i-lucide-x" class="h-4 w-4" />
            </button>

            <div
              v-if="isSprintClusterSuggestionsOpen"
              class="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            >
              <button
                type="button"
                class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50"
                :class="
                  !sprintClusterId && !sprintClusterSearch.trim()
                    ? 'bg-slate-50 text-slate-900'
                    : 'text-slate-700'
                "
                @click="clearSprintClusterSelection"
              >
                <span>Aucun cluster du sprint</span>
                <UIcon
                  v-if="!sprintClusterId && !sprintClusterSearch.trim()"
                  name="i-lucide-check"
                  class="h-4 w-4 text-violet-600"
                />
              </button>

              <button
                v-for="option in filteredSprintClusterOptions"
                :key="option.value"
                type="button"
                class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                :class="
                  option.value === sprintClusterId
                    ? 'bg-violet-50 text-violet-700'
                    : ''
                "
                @click="selectSprintCluster(option.value, option.label)"
              >
                <span>{{ option.label }}</span>
                <UIcon
                  v-if="option.value === sprintClusterId"
                  name="i-lucide-check"
                  class="h-4 w-4 text-violet-600"
                />
              </button>

              <div
                v-if="!filteredSprintClusterOptions.length"
                class="px-4 py-3 text-sm text-slate-500"
              >
                Aucun cluster trouvé.
              </div>
            </div>
          </div>
        </label>

        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="text-sm text-slate-500">
            {{
              sprintClusterFeedbackMessage ||
              "Ce réglage alimente le flag isSprintCluster sur le cluster choisi."
            }}
          </p>

          <UButton
            icon="i-lucide-flag"
            color="primary"
            :loading="isSavingSprintCluster"
            :disabled="!hasSprintClusterChanges"
            @click="saveSprintCluster"
          >
            {{
              isSavingSprintCluster
                ? "Enregistrement..."
                : "Enregistrer le cluster du sprint"
            }}
          </UButton>
        </div>
      </template>
    </div>
  </div>
</template>
