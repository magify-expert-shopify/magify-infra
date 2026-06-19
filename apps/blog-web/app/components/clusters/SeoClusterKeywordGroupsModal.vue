<script setup lang="ts">
import type { KeywordGroupRecord } from "~/types/keywords";
import { normalizeSearchText } from "~/utils/search-normalizer";

const props = defineProps<{
  open: boolean;
  search: string;
  selectedKeywordGroupIds: string[];
  availableKeywordGroups: KeywordGroupRecord[];
  pillarKeywordGroupId?: string | null;
  isSubmitting: boolean;
  errorMessage?: string | null;
}>();

const emit = defineEmits<{
  close: [];
  "update:search": [value: string];
  "update:selectedKeywordGroupIds": [value: string[]];
  submit: [];
}>();

const selectedKeywordGroupIds = computed({
  get: () => props.selectedKeywordGroupIds,
  set: (value: string[]) => emit("update:selectedKeywordGroupIds", value),
});
const onlyWithoutCluster = ref(true);

const filteredKeywordGroups = computed(() => {
  const search = normalizeSearchText(props.search);

  return props.availableKeywordGroups.filter((keywordGroup) => {
    if (keywordGroup.id === props.pillarKeywordGroupId) {
      return false;
    }

    if (onlyWithoutCluster.value && keywordGroup.seoCluster?.id) {
      return false;
    }

    if (!search) {
      return true;
    }

    return [
      keywordGroup.name,
      keywordGroup.primaryKeyword,
      keywordGroup.description,
    ]
      .filter((value): value is string => typeof value === "string")
      .some((value) => normalizeSearchText(value).includes(search));
  });
});

function toggleKeywordGroup(keywordGroupId: string) {
  const nextSelectedKeywordGroupIds = selectedKeywordGroupIds.value.includes(
    keywordGroupId,
  )
    ? selectedKeywordGroupIds.value.filter((id) => id !== keywordGroupId)
    : [...selectedKeywordGroupIds.value, keywordGroupId];

  selectedKeywordGroupIds.value = nextSelectedKeywordGroupIds.filter(
    (id) => id !== props.pillarKeywordGroupId,
  );
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
    @pointerdown.self="emit('close')"
  >
    <div
      class="w-full max-w-5xl rounded-3xl bg-white p-6 shadow-2xl"
      @pointerdown.stop
    >
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-xl font-semibold text-slate-900">
            Ajouter des KeywordGroups
          </h2>
          <p class="text-sm text-slate-500">
            Recherchez puis cochez un ou plusieurs groupes à associer à ce cluster.
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

      <div class="mt-6">
        <label class="block space-y-2">
          <span class="text-sm font-medium text-slate-700">
            Rechercher un KeywordGroup
          </span>
          <input
            :value="search"
            type="text"
            placeholder="Nom, mot-clé principal ou description..."
            class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            @input="
              emit(
                'update:search',
                ($event.target as HTMLInputElement | null)?.value ?? '',
              )
            "
          />
        </label>
      </div>

      <div class="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div class="space-y-0.5">
          <p class="text-sm font-medium text-slate-900">
            Uniquement les KeywordGroups non associés à un cluster
          </p>
          <p class="text-xs text-slate-500">
            Le filtre est activé par défaut pour aller plus vite.
          </p>
        </div>

        <USwitch
          :model-value="onlyWithoutCluster"
          @update:model-value="onlyWithoutCluster = $event"
        />
      </div>

      <div class="mt-5 flex items-center justify-between gap-3">
        <p class="text-sm text-slate-500">
          {{ selectedKeywordGroupIds.length }} groupe{{
            selectedKeywordGroupIds.length > 1 ? "s" : ""
          }}
          sélectionné{{ selectedKeywordGroupIds.length > 1 ? "s" : "" }}
        </p>

        <div class="flex items-center gap-2">
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            :disabled="!filteredKeywordGroups.length"
            @click="
              selectedKeywordGroupIds = filteredKeywordGroups
                .filter((keywordGroup) => keywordGroup.id !== pillarKeywordGroupId)
                .map((keywordGroup) => keywordGroup.id)
            "
          >
            Tout cocher
          </UButton>

          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            :disabled="!selectedKeywordGroupIds.length"
            @click="selectedKeywordGroupIds = []"
          >
            Tout décocher
          </UButton>
        </div>
      </div>

      <div
        class="mt-3 max-h-[24rem] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3"
      >
        <div v-if="filteredKeywordGroups.length" class="space-y-2">
          <button
            v-for="keywordGroup in filteredKeywordGroups"
            :key="keywordGroup.id"
            type="button"
            class="flex w-full items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50"
            :class="
              selectedKeywordGroupIds.includes(keywordGroup.id)
                ? 'border-sky-300 bg-sky-50 ring-2 ring-sky-100'
                : ''
            "
            :disabled="keywordGroup.id === pillarKeywordGroupId"
            @click="toggleKeywordGroup(keywordGroup.id)"
          >
            <div class="min-w-0 space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="truncate text-sm font-medium text-slate-900">
                  {{ keywordGroup.name }}
                </p>
                <UBadge
                  v-if="keywordGroup.id === pillarKeywordGroupId"
                  color="primary"
                  variant="soft"
                  class="rounded-full"
                >
                  Pilier
                </UBadge>
              </div>

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

            <UIcon
              v-if="selectedKeywordGroupIds.includes(keywordGroup.id)"
              name="i-lucide-check"
              class="h-4 w-4 shrink-0 text-sky-600"
            />
          </button>
        </div>

        <p v-else class="px-2 py-4 text-sm text-slate-500">
          Aucun KeywordGroup ne correspond à cette recherche.
        </p>
      </div>

      <FeedbackErrorMessage v-if="errorMessage" class="mt-4">
        {{ errorMessage }}
      </FeedbackErrorMessage>

      <div class="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        <UButton type="button" color="neutral" variant="soft" @click="emit('close')">
          Annuler
        </UButton>

        <UButton
          color="primary"
          :loading="isSubmitting"
          :disabled="isSubmitting"
          @click="emit('submit')"
        >
          Sauvegarder les {{ selectedKeywordGroupIds.length }} groupe{{
            selectedKeywordGroupIds.length > 1 ? "s" : ""
          }}
        </UButton>
      </div>
    </div>
  </div>
</template>
