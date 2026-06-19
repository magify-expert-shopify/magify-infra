<script setup lang="ts">
import type { SeoCluster } from "~/types/domain";
import type { KeywordGroupRecord } from "~/types/keywords";
import type { PageListRecord } from "~/types/pages";
import { normalizeSearchText } from "~/utils/search-normalizer";

type DraggedItem =
  | {
      kind: "keyword-group";
      id: string;
    }
  | {
      kind: "page";
      id: string;
    };

const props = defineProps<{
  open: boolean;
  keywordGroups: KeywordGroupRecord[];
  pages: PageListRecord[];
  clusters: SeoCluster[];
  isLoading: boolean;
}>();

const emit = defineEmits<{
  close: [];
  "move:keyword-group": [
    payload: { keywordGroupId: string; clusterId: string },
  ];
  "move:page": [payload: { pageId: string; clusterId: string }];
}>();

type ClusterSuggestion = {
  suggestedClusterId: string | null;
  suggestedCluster?: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
  reason: string;
};

const { suggestClusterForKeywordGroup } = useSeoClusters();
const searchText = ref("");
const draggedItem = ref<DraggedItem | null>(null);
const hoveredClusterId = ref<string | null>(null);
const scanningKeywordGroupId = ref<string | null>(null);
const scanningAllKeywordGroups = ref(false);
const applyingKeywordGroupId = ref<string | null>(null);
const keywordGroupSuggestions = reactive<
  Record<string, ClusterSuggestion | null>
>({});

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      return;
    }

    scanningKeywordGroupId.value = null;
    scanningAllKeywordGroups.value = false;
    applyingKeywordGroupId.value = null;

    for (const key of Object.keys(keywordGroupSuggestions)) {
      delete keywordGroupSuggestions[key];
    }
  },
);

const orphanKeywordGroups = computed(() =>
  [...props.keywordGroups]
    .filter((keywordGroup) => {
      if (!(keywordGroup.keywords?.length ?? 0)) {
        return false;
      }

      if (keywordGroup.seoCluster?.id) {
        return false;
      }

      return !props.clusters.some(
        (cluster) => cluster.pillarKeywordGroup?.id === keywordGroup.id,
      );
    })
    .sort((left, right) => left.name.localeCompare(right.name)),
);

const orphanPages = computed(() =>
  props.pages.filter((page) => !page.cluster?.id),
);

const filteredClusters = computed(() => {
  const search = normalizeSearchText(searchText.value);

  const clusters = [...props.clusters].sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  if (!search) {
    return clusters;
  }

  return clusters.filter((cluster) =>
    [
      cluster.name,
      cluster.slug,
      cluster.primaryKeyword,
      cluster.description,
      cluster.pillarKeywordGroup?.name,
      cluster.pillarKeywordGroup?.primaryKeyword,
    ]
      .filter((value): value is string => typeof value === "string")
      .some((value) => normalizeSearchText(value).includes(search)),
  );
});

function serializeDraggedItem(item: DraggedItem) {
  return JSON.stringify(item);
}

function parseDraggedItem(rawValue: string | null): DraggedItem | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<DraggedItem>;

    if (
      parsed &&
      (parsed.kind === "keyword-group" || parsed.kind === "page") &&
      typeof parsed.id === "string" &&
      parsed.id.trim()
    ) {
      return {
        kind: parsed.kind,
        id: parsed.id.trim(),
      };
    }
  } catch {
    return null;
  }

  return null;
}

function startDragging(item: DraggedItem, event: DragEvent) {
  draggedItem.value = item;

  if (!event.dataTransfer) {
    return;
  }

  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/json", serializeDraggedItem(item));
  event.dataTransfer.setData("text/plain", serializeDraggedItem(item));
}

function endDragging() {
  draggedItem.value = null;
  hoveredClusterId.value = null;
}

function onClusterDragOver(clusterId: string, event: DragEvent) {
  const parsedItem = parseDraggedItem(
    event.dataTransfer?.getData("application/json") ?? null,
  );

  if (!draggedItem.value && !parsedItem) {
    return;
  }

  event.preventDefault();
  event.dataTransfer!.dropEffect = "move";
  hoveredClusterId.value = clusterId;
}

function onClusterDragEnter(clusterId: string, event: DragEvent) {
  const parsedItem = parseDraggedItem(
    event.dataTransfer?.getData("application/json") ?? null,
  );

  if (!draggedItem.value && !parsedItem) {
    return;
  }

  event.preventDefault();
  hoveredClusterId.value = clusterId;
}

function onClusterDragLeave(clusterId: string) {
  if (hoveredClusterId.value === clusterId) {
    hoveredClusterId.value = null;
  }
}

function onClusterDrop(clusterId: string, event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();

  const item =
    draggedItem.value ??
    parseDraggedItem(event.dataTransfer?.getData("application/json") ?? null);

  if (!item) {
    endDragging();
    return;
  }

  if (item.kind === "keyword-group") {
    emit("move:keyword-group", {
      keywordGroupId: item.id,
      clusterId,
    });
  } else {
    emit("move:page", {
      pageId: item.id,
      clusterId,
    });
  }

  endDragging();
}

function isClusterDropTarget(clusterId: string) {
  return hoveredClusterId.value === clusterId && !!draggedItem.value;
}

async function scanKeywordGroup(keywordGroupId: string) {
  if (scanningKeywordGroupId.value) {
    return;
  }

  scanningKeywordGroupId.value = keywordGroupId;

  try {
    const suggestion = await suggestClusterForKeywordGroup(keywordGroupId);

    if (!props.open) {
      return;
    }

    keywordGroupSuggestions[keywordGroupId] = {
      suggestedClusterId: suggestion.suggestedClusterId ?? null,
      suggestedCluster: suggestion.suggestedCluster ?? null,
      reason: suggestion.reason,
    };
  } catch (error) {
    console.error(error);

    if (!props.open) {
      return;
    }

    keywordGroupSuggestions[keywordGroupId] = {
      suggestedClusterId: null,
      suggestedCluster: null,
      reason: "Impossible de générer une suggestion.",
    };
  } finally {
    scanningKeywordGroupId.value = null;
  }
}

async function scanAllKeywordGroups() {
  if (scanningAllKeywordGroups.value || !orphanKeywordGroups.value.length) {
    return;
  }

  scanningAllKeywordGroups.value = true;

  try {
    for (const keywordGroup of orphanKeywordGroups.value) {
      await scanKeywordGroup(keywordGroup.id);
    }
  } finally {
    scanningAllKeywordGroups.value = false;
  }
}

function applyKeywordGroupSuggestion(keywordGroupId: string) {
  const suggestion = keywordGroupSuggestions[keywordGroupId];

  if (!suggestion?.suggestedClusterId) {
    return;
  }

  applyingKeywordGroupId.value = keywordGroupId;

  emit("move:keyword-group", {
    keywordGroupId,
    clusterId: suggestion.suggestedClusterId,
  });

  delete keywordGroupSuggestions[keywordGroupId];
  applyingKeywordGroupId.value = null;
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
    @pointerdown.self="emit('close')"
  >
    <div
      class="max-h-[90vh] w-full max-w-7xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
      @pointerdown.stop
    >
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-xl font-semibold text-slate-900">
            Éléments sans cluster
          </h2>
          <p class="text-sm text-slate-500">
            Glissez un KeywordGroup ou une page sur un cluster existant pour les
            rattacher rapidement.
          </p>
        </div>

        <button
          type="button"
          class="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          @click="emit('close')"
        >
          <UIcon name="i-lucide-x" class="h-5 w-5" />
        </button>
      </div>

      <div v-if="isLoading" class="mt-6 text-sm text-slate-500">
        Chargement des éléments orphelins...
      </div>

      <div v-else class="mt-6 space-y-4">
        <div class="grid gap-4 lg:grid-cols-2">
          <section class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-base font-semibold text-slate-900">
                KeywordGroups sans cluster
              </h3>
              <div class="flex items-center gap-2">
                <UBadge color="neutral" variant="soft">
                  {{ orphanKeywordGroups.length }}
                </UBadge>

                <UButton
                  size="xs"
                  color="primary"
                  variant="soft"
                  icon="i-lucide-scan-search"
                  :loading="scanningAllKeywordGroups"
                  :disabled="
                    !orphanKeywordGroups.length || scanningAllKeywordGroups
                  "
                  @click="scanAllKeywordGroups"
                >
                  Tout analyser
                </UButton>
              </div>
            </div>

            <div class="mt-4 max-h-[20rem] space-y-2 overflow-y-auto pr-1">
              <div
                v-for="keywordGroup in orphanKeywordGroups"
                :key="keywordGroup.id"
                draggable="true"
                class="flex w-full cursor-grab items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50 active:cursor-grabbing"
                @dragstart="
                  startDragging(
                    {
                      kind: 'keyword-group',
                      id: keywordGroup.id,
                    },
                    $event,
                  )
                "
                @dragend="endDragging"
              >
                <div class="min-w-0 flex-1 space-y-2">
                  <div class="space-y-1">
                    <NuxtLink
                      :to="`/keyword-groups/${keywordGroup.id}`"
                      @click.stop
                      class="block truncate text-sm font-semibold text-slate-900 underline decoration-transparent underline-offset-4 transition hover:decoration-slate-300"
                    >
                      {{ keywordGroup.name }}
                    </NuxtLink>
                    <p
                      v-if="keywordGroup.primaryKeyword"
                      class="truncate text-xs text-slate-500"
                    >
                      Mot-clé principal : {{ keywordGroup.primaryKeyword }}
                    </p>
                    <p
                      v-if="keywordGroup.description"
                      class="line-clamp-2 text-xs text-slate-400"
                    >
                      {{ keywordGroup.description }}
                    </p>
                  </div>

                  <div
                    v-if="keywordGroupSuggestions[keywordGroup.id]"
                    class="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 flex items-center"
                  >
                    <div class="text-xs text-slate-600">
                      <p class="font-medium text-slate-800">
                        Suggestion de cluster
                      </p>
                      <p
                        v-if="
                          keywordGroupSuggestions[keywordGroup.id]
                            ?.suggestedCluster
                        "
                        class="mt-1 truncate"
                      >
                        {{
                          keywordGroupSuggestions[keywordGroup.id]
                            ?.suggestedCluster?.name
                        }}
                      </p>
                      <p v-else class="mt-1 text-amber-700">
                        Aucune suggestion fiable
                      </p>
                      <p class="mt-1 line-clamp-2 text-slate-500">
                        {{ keywordGroupSuggestions[keywordGroup.id]?.reason }}
                      </p>
                    </div>
                    <UButton
                      v-if="
                        keywordGroupSuggestions[keywordGroup.id]
                          ?.suggestedClusterId
                      "
                      size="xs"
                      color="primary"
                      variant="soft"
                      icon="i-lucide-check"
                      :loading="applyingKeywordGroupId === keywordGroup.id"
                      @pointerdown.stop
                      @click.stop="applyKeywordGroupSuggestion(keywordGroup.id)"
                    >
                      <!-- Appliquer -->
                    </UButton>
                  </div>
                </div>

                <div class="flex shrink-0 flex-col items-end gap-2">
                  <div class="flex items-center gap-1">
                    <UButton
                      v-if="!keywordGroupSuggestions[keywordGroup.id]"
                      size="xs"
                      color="neutral"
                      variant="soft"
                      icon="i-lucide-scan-search"
                      :loading="scanningKeywordGroupId === keywordGroup.id"
                      @pointerdown.stop
                      @click.stop="scanKeywordGroup(keywordGroup.id)"
                    >
                      Scanner
                    </UButton>
                  </div>

                  <UIcon
                    name="i-lucide-grip-vertical"
                    class="mt-0.5 h-4 w-4 shrink-0 text-slate-300"
                  />
                </div>
              </div>

              <p
                v-if="!orphanKeywordGroups.length"
                class="text-sm text-slate-500"
              >
                Aucun KeywordGroup sans cluster.
              </p>
            </div>
          </section>

          <section class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-base font-semibold text-slate-900">
                Pages sans cluster
              </h3>
              <UBadge color="neutral" variant="soft">
                {{ orphanPages.length }}
              </UBadge>
            </div>

            <div class="mt-4 max-h-[26rem] space-y-2 overflow-y-auto pr-1">
              <div
                v-for="page in orphanPages"
                :key="page.id"
                draggable="true"
                class="flex w-full cursor-grab items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50 active:cursor-grabbing"
                @dragstart="
                  startDragging(
                    {
                      kind: 'page',
                      id: page.id,
                    },
                    $event,
                  )
                "
                @dragend="endDragging"
              >
                <div class="min-w-0 space-y-1">
                  <NuxtLink
                    :to="`/pages/${page.id}`"
                    @click.stop
                    class="block truncate text-sm font-semibold text-slate-900 underline decoration-transparent underline-offset-4 transition hover:decoration-slate-300"
                  >
                    {{ page.title }}
                  </NuxtLink>
                  <p class="truncate text-xs text-slate-500">
                    {{ page.pageType }} · {{ page.seoRole }}
                  </p>
                  <p class="truncate text-xs text-slate-400">
                    {{ page.slug ? `/${page.slug}` : page.url }}
                  </p>
                </div>

                <UIcon
                  name="i-lucide-grip-vertical"
                  class="mt-0.5 h-4 w-4 shrink-0 text-slate-300"
                />
              </div>

              <p v-if="!orphanPages.length" class="text-sm text-slate-500">
                Aucune page sans cluster.
              </p>
            </div>
          </section>
        </div>

        <section class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="space-y-1">
              <h3 class="text-base font-semibold text-slate-900">
                Clusters existants
              </h3>
              <p class="text-sm text-slate-500">
                Dépose un élément sur une carte pour le rattacher à ce cluster.
              </p>
            </div>

            <label class="min-w-[18rem] max-w-full flex-1 space-y-1">
              <span
                class="text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                Filtrer les clusters
              </span>
              <input
                v-model="searchText"
                type="text"
                placeholder="Nom, slug, mot-clé principal..."
                class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              />
            </label>
          </div>

          <div
            class="-mb-4 py-4 grid max-h-[28rem] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3"
          >
            <div
              v-for="cluster in filteredClusters"
              :key="cluster.id"
              class="rounded-2xl border bg-white p-4 transition"
              :class="
                isClusterDropTarget(cluster.id)
                  ? 'border-sky-300 bg-sky-50! ring-4 ring-sky-100'
                  : 'border-slate-200'
              "
              @dragenter.prevent="onClusterDragEnter(cluster.id, $event)"
              @dragover="onClusterDragOver(cluster.id, $event)"
              @dragleave.self="onClusterDragLeave(cluster.id)"
              @drop.prevent.stop="onClusterDrop(cluster.id, $event)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 space-y-1">
                  <NuxtLink
                    :to="`/clusters/${cluster.id}`"
                    class="block truncate text-sm font-semibold text-slate-900 underline decoration-transparent underline-offset-4 transition hover:decoration-slate-300"
                  >
                    {{ cluster.name }}
                  </NuxtLink>
                  <p
                    v-if="cluster.slug"
                    class="truncate text-xs text-slate-500"
                  >
                    /{{ cluster.slug }}
                  </p>
                </div>

                <!-- <UButton
                  size="xs"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-external-link"
                  :to="`/clusters/${cluster.id}`"
                >
                  Ouvrir
                </UButton> -->
              </div>

              <!-- <div class="mt-3 flex flex-wrap gap-2">
                <UBadge color="neutral" variant="soft">
                  {{ cluster.keywordGroups?.length ?? 0 }} groupes
                </UBadge>
                <UBadge color="neutral" variant="soft">
                  {{ cluster.pages?.length ?? 0 }} pages
                </UBadge>
              </div> -->

              <!-- <p
                class="mt-3 text-xs text-slate-500"
                :class="isClusterDropTarget(cluster.id) ? 'text-sky-700' : ''"
              >
                {{ draggedItem ? "Relâchez pour déplacer ici" : "Déposez un élément ici" }}
              </p> -->
            </div>

            <p
              v-if="!filteredClusters.length"
              class="col-span-full text-sm text-slate-500"
            >
              Aucun cluster ne correspond à la recherche.
            </p>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
