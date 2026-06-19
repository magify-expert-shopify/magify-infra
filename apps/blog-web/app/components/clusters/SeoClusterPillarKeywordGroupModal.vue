<script setup lang="ts">
import type { KeywordGroupRecord } from "~/types/keywords";
import { normalizeSearchText } from "~/utils/search-normalizer";

const props = defineProps<{
  open: boolean;
  keywordGroups: KeywordGroupRecord[];
  selectedKeywordGroupId: string | null;
  submitting: boolean;
}>();

const emit = defineEmits<{
  close: [];
  select: [keywordGroupId: string];
}>();

const search = ref("");

const filteredKeywordGroups = computed(() => {
  const normalizedSearch = normalizeSearchText(search.value);

  if (!normalizedSearch) {
    return props.keywordGroups;
  }

  return props.keywordGroups.filter((keywordGroup) => {
    return [
      keywordGroup.name,
      keywordGroup.primaryKeyword,
      keywordGroup.description,
    ]
      .filter((value): value is string => typeof value === "string")
      .some((value) => normalizeSearchText(value).includes(normalizedSearch));
  });
});

watch(
  () => props.open,
  (value) => {
    if (!value) {
      search.value = "";
    }
  },
);
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
    @pointerdown.self="emit('close')"
  >
    <div
      class="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl"
      @pointerdown.stop
    >
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-xl font-semibold text-slate-900">
            Définir le KeywordGroup pilier
          </h2>
          <p class="text-sm text-slate-500">
            Choisissez le sujet principal du cluster. Ce choix servira ensuite de base au pilier.
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

      <div class="mt-6 space-y-4">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Rechercher un KeywordGroup..."
        />

        <ul
          v-if="filteredKeywordGroups.length"
          class="max-h-[24rem] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3"
        >
          <li
            v-for="keywordGroup in filteredKeywordGroups"
            :key="keywordGroup.id"
            class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition"
            :class="
              selectedKeywordGroupId === keywordGroup.id
                ? 'border-sky-300 bg-sky-50 ring-2 ring-sky-100'
                : 'hover:bg-slate-50'
            "
          >
            <div class="min-w-0 space-y-1">
              <p class="truncate text-sm font-medium text-slate-900">
                {{ keywordGroup.name }}
              </p>
              <p class="truncate text-xs text-slate-500">
                Mot-clé principal : {{ keywordGroup.primaryKeyword || "—" }}
              </p>
            </div>

            <UButton
              size="sm"
              icon="i-lucide-check"
              :loading="submitting && selectedKeywordGroupId === keywordGroup.id"
              :disabled="submitting"
              @click="emit('select', keywordGroup.id)"
            >
              Choisir
            </UButton>
          </li>
        </ul>

        <p v-else class="text-sm text-slate-500">
          Aucun KeywordGroup ne correspond à cette recherche.
        </p>
      </div>
    </div>
  </div>
</template>
