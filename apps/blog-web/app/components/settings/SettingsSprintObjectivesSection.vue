<script setup lang="ts">
import { normalizeSearchText } from "~/utils/search-normalizer";

const { getCurrentSprint, updateCurrentSprint } = useSettings();
const { useSeoClustersList } = useSeoClusters();
const { data: clusters } = await useSeoClustersList();

const clusterId = ref("");
const savedClusterId = ref("");
const clusterSearch = ref("");
const isClusterSuggestionsOpen = ref(false);
const blogArticleTargetCount = ref(0);
const savedBlogArticleTargetCount = ref(0);
const startDate = ref("");
const savedStartDate = ref("");
const durationDays = ref<number | null>(null);
const savedDurationDays = ref<number | null>(null);
const currentEndDate = ref("");
const isInProgress = ref(false);
const isLoading = ref(true);
const isSaving = ref(false);
const feedbackMessage = ref("");

const sprintClusterOptions = computed(() =>
  (clusters.value ?? []).map((cluster) => ({
    label: cluster.name,
    value: cluster.id,
  })),
);

const selectedSprintClusterLabel = computed(
  () =>
    sprintClusterOptions.value.find(
      (option) => option.value === clusterId.value,
    )?.label ?? "",
);

const filteredSprintClusterOptions = computed(() => {
  const search = normalizeSearchText(clusterSearch.value);

  if (!search) {
    return sprintClusterOptions.value.slice(0, 8);
  }

  return sprintClusterOptions.value
    .filter((option) => normalizeSearchText(option.label).includes(search))
    .slice(0, 8);
});

const canSave = computed(
  () =>
    clusterId.value !== savedClusterId.value ||
    blogArticleTargetCount.value !== savedBlogArticleTargetCount.value ||
    startDate.value !== savedStartDate.value ||
    durationDays.value !== savedDurationDays.value,
);

const computedEndDate = computed(() => {
  if (!startDate.value || !durationDays.value) {
    return "";
  }

  const date = new Date(`${startDate.value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setUTCDate(date.getUTCDate() + durationDays.value - 1);

  return date.toISOString().slice(0, 10);
});

const formattedCurrentEndDate = computed(() =>
  currentEndDate.value
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date(`${currentEndDate.value}T00:00:00.000Z`))
    : "",
);

const formattedCurrentStartDate = computed(() =>
  startDate.value
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date(`${startDate.value}T00:00:00.000Z`))
    : "",
);

async function loadCurrentSprint() {
  isLoading.value = true;

  try {
    const sprint = await getCurrentSprint();

    clusterId.value = sprint.clusterId ?? "";
    savedClusterId.value = sprint.clusterId ?? "";
    clusterSearch.value = sprint.clusterName ?? "";

    blogArticleTargetCount.value = sprint.blogArticleTargetCount ?? 0;
    savedBlogArticleTargetCount.value = sprint.blogArticleTargetCount ?? 0;

    startDate.value = sprint.startDate ?? "";
    savedStartDate.value = sprint.startDate ?? "";

    durationDays.value = sprint.durationDays ?? null;
    savedDurationDays.value = sprint.durationDays ?? null;

    currentEndDate.value = sprint.endDate ?? "";
    isInProgress.value = sprint.isInProgress;
  } finally {
    isLoading.value = false;
  }
}

async function saveCurrentSprint() {
  if (isSaving.value) {
    return;
  }

  isSaving.value = true;
  feedbackMessage.value = "";

  try {
    const sprint = await updateCurrentSprint(
      clusterId.value || null,
      blogArticleTargetCount.value,
      isInProgress.value ? savedStartDate.value || null : startDate.value || null,
      isInProgress.value ? savedDurationDays.value : durationDays.value,
    );

    clusterId.value = sprint.clusterId ?? "";
    savedClusterId.value = sprint.clusterId ?? "";
    clusterSearch.value = sprint.clusterName ?? "";

    blogArticleTargetCount.value = sprint.blogArticleTargetCount ?? 0;
    savedBlogArticleTargetCount.value = sprint.blogArticleTargetCount ?? 0;

    startDate.value = sprint.startDate ?? "";
    savedStartDate.value = sprint.startDate ?? "";

    durationDays.value = sprint.durationDays ?? null;
    savedDurationDays.value = sprint.durationDays ?? null;

    currentEndDate.value = sprint.endDate ?? "";
    isInProgress.value = sprint.isInProgress;
    isClusterSuggestionsOpen.value = false;
    feedbackMessage.value = "Sprint enregistré.";
  } finally {
    isSaving.value = false;
  }
}

function selectSprintCluster(clusterIdValue: string, clusterName: string) {
  clusterId.value = clusterIdValue;
  clusterSearch.value = clusterName;
  isClusterSuggestionsOpen.value = false;
}

function clearSprintClusterSelection() {
  clusterId.value = "";
  clusterSearch.value = "";
  isClusterSuggestionsOpen.value = false;
}

watch(clusterSearch, (value) => {
  if (
    normalizeSearchText(value) !==
    normalizeSearchText(selectedSprintClusterLabel.value)
  ) {
    clusterId.value = "";
  }
});

onMounted(() => {
  void loadCurrentSprint();
});
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex flex-col gap-4">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-slate-900">Sprint</h2>
        <p class="text-sm leading-6 text-slate-500">
          Définissez le cluster prioritaire, le volume d’articles à publier et
          le calendrier du sprint.
        </p>
      </div>

      <div
        v-if="isLoading"
        class="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500"
      >
        Chargement du sprint...
      </div>

      <template v-else>
        <div class="grid gap-4 xl:grid-cols-2">
          <section class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div class="space-y-1">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-900">
                Objectifs du sprint
              </h3>
              <p class="text-sm leading-6 text-slate-500">
                Choisissez le cluster prioritaire et l’objectif de production.
              </p>
            </div>

            <div class="mt-4 space-y-4">
              <label class="block text-sm font-medium text-slate-700">
                <span class="mb-2 block">Cluster travaillé</span>

                <div class="relative">
                  <input
                    v-model="clusterSearch"
                    type="text"
                    placeholder="Rechercher un cluster..."
                    class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-24 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                    @focus="isClusterSuggestionsOpen = true"
                  />

                  <div
                    class="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400"
                  >
                    <UIcon name="i-lucide-search" class="h-4 w-4" />
                  </div>

                  <button
                    v-if="clusterSearch || clusterId"
                    type="button"
                    class="absolute right-10 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    @click="clearSprintClusterSelection"
                  >
                    <UIcon name="i-lucide-x" class="h-4 w-4" />
                  </button>

                  <div
                    v-if="isClusterSuggestionsOpen"
                    class="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
                  >
                    <button
                      type="button"
                      class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50"
                      :class="
                        !clusterId && !clusterSearch.trim()
                          ? 'bg-slate-50 text-slate-900'
                          : 'text-slate-700'
                      "
                      @click="clearSprintClusterSelection"
                    >
                      <span>Aucun cluster</span>
                      <UIcon
                        v-if="!clusterId && !clusterSearch.trim()"
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
                        option.value === clusterId
                          ? 'bg-violet-50 text-violet-700'
                          : ''
                      "
                      @click="selectSprintCluster(option.value, option.label)"
                    >
                      <span>{{ option.label }}</span>
                      <UIcon
                        v-if="option.value === clusterId"
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

              <label class="block text-sm font-medium text-slate-700">
                <span class="mb-2 block">Nombre d’articles de blog à publier</span>
                <input
                  v-model.number="blogArticleTargetCount"
                  type="number"
                  min="0"
                  class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                />
              </label>
            </div>
          </section>

          <section class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div class="space-y-1">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-900">
                Calendrier du sprint
              </h3>
              <p class="text-sm leading-6 text-slate-500">
                Définissez la durée et la date de démarrage tant que le sprint
                n’a pas encore commencé.
              </p>
            </div>

            <div class="mt-4 space-y-4">
              <div
                v-if="isInProgress"
                class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900"
              >
                <div class="flex items-center gap-2 font-medium">
                  <UIcon name="i-lucide-circle-play" class="h-4 w-4" />
                  Sprint en cours
                </div>
                <p class="mt-2 leading-6">
                  Démarré le <strong>{{ formattedCurrentStartDate }}</strong>
                  et prévu jusqu’au
                  <strong>{{ formattedCurrentEndDate }}</strong>.
                </p>
              </div>

              <template v-else>
                <label class="block text-sm font-medium text-slate-700">
                  <span class="mb-2 block">Date de début</span>
                  <input
                    v-model="startDate"
                    type="date"
                    class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  />
                </label>

                <label class="block text-sm font-medium text-slate-700">
                  <span class="mb-2 block">Durée du sprint en jours</span>
                  <input
                    v-model.number="durationDays"
                    type="number"
                    min="1"
                    class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  />
                </label>

                <div
                  v-if="computedEndDate"
                  class="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4 text-sm text-violet-900"
                >
                  Fin estimée du sprint:
                  <strong>{{ computedEndDate }}</strong>
                </div>
              </template>
            </div>
          </section>
        </div>

        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="text-sm text-slate-500">
            {{ feedbackMessage || "Les changements du sprint sont enregistrés ici." }}
          </p>

          <UButton
            icon="i-lucide-save"
            color="primary"
            :loading="isSaving"
            :disabled="!canSave"
            @click="saveCurrentSprint"
          >
            {{ isSaving ? "Enregistrement..." : "Enregistrer le sprint" }}
          </UButton>
        </div>
      </template>
    </div>
  </div>
</template>
