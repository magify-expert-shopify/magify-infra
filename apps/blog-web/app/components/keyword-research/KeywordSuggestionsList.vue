<script setup lang="ts">
import {
  type KeywordSuggestion,
} from "~/types/keyword-analysis";
import { defaultKeywordDifficultyLevels } from "~/constants/keyword-difficulty";
import { getKeywordDifficultyLabel } from "~/utils/keyword-difficulty";
import { formatKeywordIntent } from "~/utils/keyword-intent";

defineProps<{
  show: boolean;
  isLoading: boolean;
  suggestions: KeywordSuggestion[];
  activeSuggestionIndex: number;
}>();

defineEmits<{
  select: [suggestion: KeywordSuggestion];
}>();

const { getKeywordDifficultyLevels } = useSettings();
const { data: keywordDifficultyLevelsSettings } = await useAsyncData(
  "settings:keyword-difficulty-levels",
  () => getKeywordDifficultyLevels(),
);
const keywordDifficultyLevels = computed(
  () =>
    keywordDifficultyLevelsSettings.value?.levels ?? defaultKeywordDifficultyLevels,
);

function isHistorySuggestion(suggestion: KeywordSuggestion) {
  return suggestion.source === "history";
}

function isApiSuggestSuggestion(suggestion: KeywordSuggestion) {
  return suggestion.source === "suggest";
}
</script>

<template>
  <div
    v-if="show"
    class="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
  >
    <div v-if="isLoading" class="px-4 py-3 text-sm text-slate-500">
      Recherche de suggestions...
    </div>

    <ul v-else-if="suggestions.length" class="divide-y divide-slate-100">
      <li
        v-for="(suggestion, index) in suggestions"
        :key="`${suggestion.keyword}-${index}`"
      >
        <button
          type="button"
          class="flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-50"
          :class="index === activeSuggestionIndex ? 'bg-slate-50' : 'bg-white'"
          @mousedown.prevent
          @click="$emit('select', suggestion)"
        >
          <span class="flex min-w-0 items-start gap-3">
            <UIcon
              v-if="isHistorySuggestion(suggestion)"
              name="i-lucide-history"
              class="mt-0.5 size-4 shrink-0 text-slate-400"
            />

            <span class="min-w-0">
              <span class="block truncate text-sm font-medium text-slate-900">
                {{ suggestion.keyword }}
              </span>
              <span class="mt-1 block text-xs text-slate-500">
                {{ suggestion.intent ? formatKeywordIntent(suggestion.intent) : "Suggestion API" }}
              </span>
            </span>
          </span>

          <span class="shrink-0 text-right text-xs text-slate-500">
            <span
              v-if="isApiSuggestSuggestion(suggestion)"
              class="mb-1 inline-flex rounded-full bg-cyan-50 px-2 py-0.5 font-medium text-cyan-700"
            >
              Google suggest
            </span>
            <span class="block">Vol. {{ suggestion.volume ?? "-" }}</span>
            <span class="mt-1 block">
              Diff. {{ suggestion.difficulty ?? "-" }}
              <template v-if="suggestion.difficulty !== null">
                ·
                {{
                  getKeywordDifficultyLabel(
                    suggestion.difficulty,
                    keywordDifficultyLevels,
                  )
                }}
              </template>
            </span>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>
