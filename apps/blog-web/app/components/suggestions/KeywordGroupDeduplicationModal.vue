<script setup lang="ts">
import { useAppToast } from "~/composables/useAppToast";
import { useKeywords } from "~/composables/useKeywords";
import type { KeywordGroupSuggestionRecord } from "~/types/keywords";

const props = defineProps<{
  open: boolean;
  suggestions: KeywordGroupSuggestionRecord[];
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  merged: [
    payload: {
      targetGroup: KeywordGroupSuggestionRecord;
      mergedGroupIds: string[];
    },
  ];
}>();

const {
  deduplicateKeywordGroups,
  getCachedDeduplicatedKeywordGroups,
  mergeKeywordGroups,
} = useKeywords();
const { showErrorToast, showSuccessToast } = useAppToast();

const isScanning = ref(false);
const isMerging = ref(false);
const selectedMergeKey = ref<string | null>(null);
const manualKeepGroupId = ref<string | null>(null);
const manualDuplicateGroupId = ref<string | null>(null);
const duplicateMerges = ref<
  Array<{
    keepGroup: KeywordGroupSuggestionRecord;
    duplicateGroups: KeywordGroupSuggestionRecord[];
    reason: string;
  }>
>([]);

const suggestionsById = computed(
  () => new Map(props.suggestions.map((suggestion) => [suggestion.id, suggestion])),
);
const suggestionOptions = computed(() =>
  [...props.suggestions]
    .sort((left, right) => left.name.localeCompare(right.name, "fr", {
      sensitivity: "base",
    }))
    .map((suggestion) => ({
      label: suggestion.name,
      value: suggestion.id,
    })),
);
const duplicateSuggestionOptions = computed(() =>
  suggestionOptions.value.filter(
    (option) => option.value !== manualKeepGroupId.value,
  ),
);

async function loadCachedDuplicateSuggestions() {
  if (!props.suggestions.length) {
    duplicateMerges.value = [];
    return;
  }

  try {
    isScanning.value = true;
    const response = await getCachedDeduplicatedKeywordGroups(
      props.suggestions.map((suggestion) => ({
        id: suggestion.id,
        name: suggestion.name,
        description: suggestion.description ?? null,
      })),
    );

    duplicateMerges.value = response.merges
      .map((merge) => {
        const keepGroup = suggestionsById.value.get(merge.keepGroupId) ?? null;

        if (!keepGroup) {
          return null;
        }

        const duplicateGroups = merge.duplicateGroupIds
          .map((groupId) => suggestionsById.value.get(groupId) ?? null)
          .filter(
            (suggestion): suggestion is KeywordGroupSuggestionRecord =>
              Boolean(suggestion),
          );

        if (!duplicateGroups.length) {
          return null;
        }

        return {
          keepGroup,
          duplicateGroups,
          reason: merge.reason,
        };
      })
      .filter(
        (
          merge,
        ): merge is {
          keepGroup: KeywordGroupSuggestionRecord;
          duplicateGroups: KeywordGroupSuggestionRecord[];
          reason: string;
        } => Boolean(merge),
      );
  } catch (error) {
    console.error(
      "[KeywordGroupDeduplicationModal] cached scan failed",
      error,
    );
    duplicateMerges.value = [];
    showErrorToast(
      "Impossible de charger les doublons en cache",
      error instanceof Error
        ? error.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    isScanning.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      duplicateMerges.value = [];
      selectedMergeKey.value = null;
      manualKeepGroupId.value = null;
      manualDuplicateGroupId.value = null;
      return;
    }

    void loadCachedDuplicateSuggestions();
  },
  { immediate: true },
);

function closeModal() {
  emit("update:open", false);
}

async function performMerge(
  keepGroupId: string,
  sourceGroupIds: string[],
  successMessage: string,
) {
  const keepGroup = suggestionsById.value.get(keepGroupId) ?? null;

  if (!keepGroup || !sourceGroupIds.length || isMerging.value) {
    return;
  }

  const mergedGroups = sourceGroupIds
    .map((groupId) => suggestionsById.value.get(groupId) ?? null)
    .filter(
      (group): group is KeywordGroupSuggestionRecord => Boolean(group),
    );

  try {
    isMerging.value = true;
    selectedMergeKey.value = keepGroupId;

    const response = await mergeKeywordGroups(keepGroupId, sourceGroupIds);

    emit("merged", response);

    const removedIds = new Set([keepGroupId, ...sourceGroupIds]);

    duplicateMerges.value = duplicateMerges.value.filter(
      (entry) =>
        ![
          entry.keepGroup.id,
          ...entry.duplicateGroups.map((group) => group.id),
        ].some((groupId) => removedIds.has(groupId)),
    );

    manualDuplicateGroupId.value = null;
    if (manualKeepGroupId.value && removedIds.has(manualKeepGroupId.value)) {
      manualKeepGroupId.value = keepGroupId;
    }

    showSuccessToast("Groupes fusionnés", successMessage);
  } catch (error) {
    console.error("[KeywordGroupDeduplicationModal] merge failed", error);
    showErrorToast(
      "Impossible de fusionner les groupes",
      error instanceof Error
        ? error.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    isMerging.value = false;
    selectedMergeKey.value = null;
  }
}

async function handleMergeSuggestion(mergeIndex: number) {
  const suggestion = duplicateMerges.value[mergeIndex];

  if (!suggestion) {
    return;
  }

  await performMerge(
    suggestion.keepGroup.id,
    suggestion.duplicateGroups.map((group) => group.id),
    `${suggestion.keepGroup.name} a absorbé ${suggestion.duplicateGroups.length} groupe(s) doublon.`,
  );
}

async function handleManualMerge() {
  const keepGroupId = manualKeepGroupId.value?.trim() ?? "";
  const duplicateGroupId = manualDuplicateGroupId.value?.trim() ?? "";

  if (!keepGroupId || !duplicateGroupId || keepGroupId === duplicateGroupId) {
    return;
  }

  const keepGroup = suggestionsById.value.get(keepGroupId) ?? null;
  const duplicateGroup = suggestionsById.value.get(duplicateGroupId) ?? null;

  if (!keepGroup || !duplicateGroup) {
    return;
  }

  await performMerge(
    keepGroupId,
    [duplicateGroupId],
    `${keepGroup.name} a absorbé ${duplicateGroup.name}.`,
  );
}

async function relaunchAnalysis() {
  if (isScanning.value) {
    return;
  }

  try {
    isScanning.value = true;
    const response = await deduplicateKeywordGroups(
      props.suggestions.map((suggestion) => ({
        id: suggestion.id,
        name: suggestion.name,
        description: suggestion.description ?? null,
      })),
    );

    duplicateMerges.value = response.merges
      .map((merge) => {
        const keepGroup = suggestionsById.value.get(merge.keepGroupId) ?? null;

        if (!keepGroup) {
          return null;
        }

        const duplicateGroups = merge.duplicateGroupIds
          .map((groupId) => suggestionsById.value.get(groupId) ?? null)
          .filter(
            (suggestion): suggestion is KeywordGroupSuggestionRecord =>
              Boolean(suggestion),
          );

        if (!duplicateGroups.length) {
          return null;
        }

        return {
          keepGroup,
          duplicateGroups,
          reason: merge.reason,
        };
      })
      .filter(
        (
          merge,
        ): merge is {
          keepGroup: KeywordGroupSuggestionRecord;
          duplicateGroups: KeywordGroupSuggestionRecord[];
          reason: string;
        } => Boolean(merge),
      );
  } catch (error) {
    console.error("[KeywordGroupDeduplicationModal] relaunch failed", error);
    showErrorToast(
      "Impossible de relancer l'analyse",
      error instanceof Error
        ? error.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    isScanning.value = false;
  }
}
</script>

<template>
  <UModal
    :open="open"
    :ui="{ content: 'sm:max-w-5xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="rounded-3xl bg-gradient-to-br from-white to-slate-50 p-6 shadow-xl">
        <div class="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div class="space-y-2">
            <div class="space-y-1">
              <h2 class="text-xl font-semibold text-slate-900">
                Dédoublonner les suggestions
              </h2>
              <p class="max-w-3xl text-sm leading-6 text-slate-500">
                OpenAI analyse les suggestions visibles et propose les groupes à
                fusionner quand ils semblent représenter le même sujet.
              </p>
            </div>

            <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
              {{ props.suggestions.length }} suggestions analysées
            </p>
          </div>

          <div class="flex items-center gap-2">
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-rotate-ccw"
              :loading="isScanning"
              @click="relaunchAnalysis()"
            >
              Relancer l’analyse
            </UButton>

            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-x"
              @click="closeModal"
            />
          </div>
        </div>

        <div class="mt-6 space-y-4">
          <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="space-y-1">
              <h3 class="text-sm font-semibold text-slate-900">
                Merge manuel
              </h3>
              <p class="text-sm text-slate-500">
                Choisissez le groupe à conserver, puis celui à fusionner dedans.
              </p>
            </div>

            <div class="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <USelect
                v-model="manualKeepGroupId"
                :items="suggestionOptions"
                value-key="value"
                label-key="label"
                placeholder="Groupe à garder"
                size="lg"
              />

              <USelect
                v-model="manualDuplicateGroupId"
                :items="duplicateSuggestionOptions"
                value-key="value"
                label-key="label"
                placeholder="Groupe à fusionner"
                size="lg"
              />

              <UButton
                color="primary"
                variant="solid"
                icon="i-lucide-git-merge"
                :loading="
                  isMerging &&
                  selectedMergeKey !== null &&
                  selectedMergeKey === manualKeepGroupId
                "
                :disabled="
                  !manualKeepGroupId ||
                  !manualDuplicateGroupId ||
                  manualKeepGroupId === manualDuplicateGroupId
                "
                class="whitespace-nowrap"
                @click="handleManualMerge"
              >
                Fusionner
              </UButton>
            </div>
          </section>

          <FeedbackInlineMessage v-if="isScanning" tone="info">
            Recherche des doublons en cours...
          </FeedbackInlineMessage>

          <FeedbackInlineMessage
            v-else-if="!duplicateMerges.length"
            tone="info"
          >
            Aucun doublon en cache n’a été détecté pour le moment.
          </FeedbackInlineMessage>

          <div v-else class=" max-h-[24rem] overflow-y-auto space-y-4">
            <article
              v-for="(merge, index) in duplicateMerges"
              :key="`${merge.keepGroup.id}-${index}`"
              class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div class="space-y-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <UBadge color="primary" variant="soft">Garder</UBadge>
                    <NuxtLink
                      :to="`/keyword-groups/${merge.keepGroup.id}`"
                      class="text-base font-semibold text-slate-900 underline decoration-transparent underline-offset-4 transition hover:decoration-slate-300"
                    >
                      {{ merge.keepGroup.name }}
                    </NuxtLink>
                  </div>

                  <p
                    v-if="merge.keepGroup.description"
                    class="text-sm leading-6 text-slate-500"
                  >
                    {{ merge.keepGroup.description }}
                  </p>

                  <div class="grid gap-2 md:grid-cols-2">
                    <div
                      v-for="duplicateGroup in merge.duplicateGroups"
                      :key="duplicateGroup.id"
                      class="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <p class="font-medium text-slate-800">
                        {{ duplicateGroup.name }}
                      </p>
                      <p
                        v-if="duplicateGroup.description"
                        class="mt-1 text-xs leading-5 text-slate-500"
                      >
                        {{ duplicateGroup.description }}
                      </p>
                    </div>
                  </div>

                  <p class="text-sm text-slate-500">
                    {{ merge.reason }}
                  </p>
                </div>

                <UButton
                  color="primary"
                  variant="solid"
                  icon="i-lucide-git-merge"
                  :loading="isMerging && selectedMergeKey === merge.keepGroup.id"
                  class="whitespace-nowrap"
                  @click="handleMergeSuggestion(index)"
                >
                  Fusionner
                </UButton>
              </div>
            </article>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
