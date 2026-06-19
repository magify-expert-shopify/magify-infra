<script setup lang="ts">
import { computed } from "vue";
import type { KeywordSheeterSearchResultItem } from "~/types/keyword-sheeter";
import { defaultKeywordDifficultyLevels } from "~/constants/keyword-difficulty";
import {
  getKeywordDifficultyLabel,
  getKeywordDifficultyClass,
} from "~/utils/keyword-difficulty";
import {
  getKeywordIntentIcon,
  getKeywordIntentToneClass,
  formatKeywordIntent,
} from "~/utils/keyword-intent";
import { buildKeywordResearchUrl } from "~/utils/keyword-research-url";
import { normalizeSearchText } from "~/utils/search-normalizer";

const props = defineProps<{
  items: KeywordSheeterSearchResultItem[];
  analyzingKeywords: string[];
  addingToBaseKeywords: string[];
  addingToBaseAndFavoriteKeywords: string[];
}>();

defineEmits<{
  analyze: [keyword: string];
  addToBase: [keyword: string];
  addToBaseAndFavorite: [keyword: string];
}>();

function isAnalyzing(keyword: string, analyzingKeywords: string[]) {
  return analyzingKeywords.includes(normalizeSearchText(keyword));
}

function isAddingToBase(keyword: string, addingToBaseKeywords: string[]) {
  return addingToBaseKeywords.includes(normalizeSearchText(keyword));
}

function isAddingToBaseAndFavorite(
  keyword: string,
  addingToBaseAndFavoriteKeywords: string[],
) {
  return addingToBaseAndFavoriteKeywords.includes(normalizeSearchText(keyword));
}

const rows = computed(() => props.items);
</script>

<template>
  <div class="mt-5 overflow-x-auto">
    <table class="min-w-full divide-y divide-slate-200 text-sm">
      <thead>
        <tr class="text-left text-slate-500">
          <th class="px-4 py-3 font-medium">
            <span class="inline-flex items-center gap-2"> Mot-clé </span>
          </th>
          <!-- <th class="px-4 py-3 font-medium">Source</th> -->
          <th class="px-4 py-3 font-medium">
            <span class="inline-flex items-center gap-2"> Volume </span>
          </th>
          <th class="px-4 py-3 font-medium">
            <span class="inline-flex items-center gap-2"> Intention </span>
          </th>
          <th class="px-4 py-3 font-medium">
            <span class="inline-flex items-center gap-2"> Difficulté </span>
          </th>
          <th class="px-4 py-3 font-medium">Actions</th>
        </tr>
      </thead>

      <tbody class="divide-y divide-slate-100">
        <tr v-for="item in rows" :key="`${item.keyword}-${item.sourceQuery}`">
          <td class="px-4 py-3 font-medium text-slate-900">
            <div class="inline-flex items-center gap-2">
              <NuxtLink
                :to="
                  buildKeywordResearchUrl(item.keyword, {
                    autorun: !!item.analysis ? false : undefined,
                    language: 'fr',
                    country: 'fr',
                  })
                "
                class="inline-flex items-center gap-2 underline decoration-transparent underline-offset-4 transition hover:decoration-slate-300"
              >
                <UIcon
                  name="i-lucide-file-search"
                  class="h-4 w-4 text-slate-400"
                />
                {{ item.keyword }}
              </NuxtLink>

              <UButton
                v-if="item.canAddToBase"
                variant="soft"
                color="neutral"
                icon="i-lucide-plus"
                size="xs"
                :loading="isAddingToBase(item.keyword, addingToBaseKeywords)"
                :disabled="
                  isAddingToBase(item.keyword, addingToBaseKeywords) ||
                  isAddingToBaseAndFavorite(
                    item.keyword,
                    addingToBaseAndFavoriteKeywords,
                  )
                "
                class="h-8 w-8 rounded-full p-0 items-center justify-center"
                :title="'Ajouter le mot-clé en base'"
                @click="$emit('addToBase', item.keyword)"
              />
            </div>
          </td>

          <!-- <td class="px-4 py-3">
            <UBadge color="neutral" variant="soft">
              {{ item.sourceQuery }}
            </UBadge>
          </td> -->

          <template v-if="item.analysis">
            <td class="w-0 px-4 py-3">
              <span class="inline-flex items-center gap-2">
                <UIcon name="i-lucide-chart-column" class="h-5 w-5" />
                {{ item.analysis.volume ?? "-" }}
              </span>
            </td>

            <td class="w-0 px-4 py-3">
              <span
                class="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium"
                :class="getKeywordIntentToneClass(item.analysis.intent)"
              >
                <UIcon
                  :name="getKeywordIntentIcon(item.analysis.intent)"
                  class="h-5 w-5"
                />
                {{ formatKeywordIntent(item.analysis.intent) }}
              </span>
            </td>

            <td class="w-0 px-4 py-3">
              <UTooltip
                :text="`${item.analysis.difficulty ?? '-'} - ${getKeywordDifficultyLabel(
                  item.analysis.difficulty,
                  defaultKeywordDifficultyLevels,
                )}`"
              >
                <div
                  class="h-8 w-3 rounded-full"
                  :class="getKeywordDifficultyClass(item.analysis.difficulty)"
                >
                </div>
              </UTooltip>
            </td>
          </template>
          <td v-else colspan="3" class="px-4 py-3">
            <UButton
              color="info"
              variant="ghost"
              icon="i-lucide-chart-column-big"
              size="sm"
              :loading="isAnalyzing(item.keyword, analyzingKeywords)"
              :disabled="isAnalyzing(item.keyword, analyzingKeywords)"
              class="w-full items-center justify-center cursor-pointer"
              @click="$emit('analyze', item.keyword)"
            >
              Analyser
            </UButton>
          </td>

          <td class="w-0 px-4 py-3">
            <div class="flex flex-wrap items-center gap-2 md:flex-nowrap">
              <UButton
                v-if="item.canAddToBaseAndFavorite"
                color="warning"
                variant="soft"
                icon="i-lucide-star"
                size="sm"
                :loading="
                  isAddingToBaseAndFavorite(
                    item.keyword,
                    addingToBaseAndFavoriteKeywords,
                  )
                "
                :disabled="
                  isAddingToBase(item.keyword, addingToBaseKeywords) ||
                  isAddingToBaseAndFavorite(
                    item.keyword,
                    addingToBaseAndFavoriteKeywords,
                  )
                "
                @click="$emit('addToBaseAndFavorite', item.keyword)"
              >
                Favori
              </UButton>
              <NuxtLink
                v-if="item.analysis"
                :to="
                  buildKeywordResearchUrl(item.keyword, {
                    autorun: false,
                    language: 'fr',
                    country: 'fr',
                  })
                "
                class="inline-flex whitespace-nowrap rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
              >
                Voir l’analyse
              </NuxtLink>
              <!-- <UBadge
                v-else-if="item.existingKeyword"
                color="success"
                variant="soft"
              >
                Déjà en base
              </UBadge> -->
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
