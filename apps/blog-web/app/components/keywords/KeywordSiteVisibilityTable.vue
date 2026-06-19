<script setup lang="ts">
import { computed } from "vue";
import type { KeywordSiteVisibilityItem } from "~/types/keyword-site-visibility";
import { defaultKeywordDifficultyLevels } from "~/constants/keyword-difficulty";
import {
  getKeywordDifficultyLabel,
  getKeywordDifficultyTextClass,
  getKeywordDifficultyToneClass,
} from "~/utils/keyword-difficulty";
import {
  getKeywordIntentIcon,
  getKeywordIntentToneClass,
  formatKeywordIntent,
} from "~/utils/keyword-intent";
import { buildKeywordResearchUrl } from "~/utils/keyword-research-url";

const props = defineProps<{
  items: KeywordSiteVisibilityItem[];
}>();

function getKeywordLink(item: KeywordSiteVisibilityItem) {
  if (item.existingKeyword?.lastScannedAt) {
    return buildKeywordResearchUrl(item.keyword, {
      autorun: false,
      language: "fr",
      country: "fr",
    });
  }

  return `/keywords/search?q=${encodeURIComponent(item.keyword)}`;
}

const rows = computed(() => props.items);
</script>

<template>
  <div class="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
    <table class="min-w-full divide-y divide-slate-200 text-sm">
      <thead class="bg-slate-50">
        <tr class="text-left text-slate-500">
          <th class="px-4 py-3 font-medium">
            <span class="inline-flex items-center gap-2"> Mot-clé </span>
          </th>
          <th class="px-4 py-3 font-medium">
            <span class="inline-flex items-center gap-2"> Page </span>
          </th>
          <th class="px-4 py-3 font-medium">
            <span class="inline-flex items-center gap-2"> Position </span>
          </th>
          <th class="px-4 py-3 font-medium">
            <span class="inline-flex items-center gap-2"> Statut </span>
          </th>
          <th class="px-4 py-3 font-medium">
            <span class="inline-flex items-center gap-2"> Volume </span>
          </th>
          <th class="px-4 py-3 font-medium">
            <span class="inline-flex items-center gap-2"> Intention </span>
          </th>
          <th class="px-4 py-3 font-medium">
            <span class="inline-flex items-center gap-2"> Difficulté </span>
          </th>
        </tr>
      </thead>

      <tbody class="divide-y divide-slate-100 bg-white">
        <tr v-for="item in rows" :key="`${item.keyword}-${item.position}`">
          <td class="px-4 py-3 font-medium text-slate-900">
            <NuxtLink
              :to="getKeywordLink(item)"
              class="inline-flex items-center gap-2 underline decoration-transparent underline-offset-4 transition hover:decoration-slate-300"
            >
              <UIcon name="i-lucide-file-search" class="h-4 w-4 text-slate-400" />
              {{ item.keyword }}
            </NuxtLink>
          </td>

          <td class="px-4 py-3 text-slate-700">
            <span class="block max-w-[18rem] truncate">
              {{ item.pageTitle ?? "-" }}
            </span>
          </td>

          <td class="px-4 py-3">
            <UBadge
              color="neutral"
              variant="soft"
              class="inline-flex items-center gap-1"
            >
              <UIcon name="i-lucide-rank" class="h-4 w-4" />
              #{{ item.position }}
            </UBadge>
          </td>

          <td class="px-4 py-3">
            <UBadge
              :color="item.existingKeyword?.lastScannedAt ? 'success' : 'warning'"
              variant="soft"
            >
              {{
                item.existingKeyword?.lastScannedAt ? "Scanné" : "Non scanné"
              }}
            </UBadge>
          </td>

          <td class="px-4 py-3">
            <span class="inline-flex items-center gap-2 text-slate-700">
              <UIcon name="i-lucide-chart-column" class="h-5 w-5" />
              {{ item.existingKeyword?.volume ?? "-" }}
            </span>
          </td>

          <td class="px-4 py-3">
            <span
              class="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium"
              :class="
                getKeywordIntentToneClass(item.existingKeyword?.searchIntent)
              "
            >
              <UIcon
                :name="getKeywordIntentIcon(item.existingKeyword?.searchIntent)"
                class="h-5 w-5"
              />
                  {{ formatKeywordIntent(item.existingKeyword?.searchIntent) }}
            </span>
          </td>

          <td class="px-4 py-3">
            <div
              class="whitespace-nowrap inline-flex gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
              :class="
                getKeywordDifficultyToneClass(
                  item.existingKeyword?.difficulty ?? null,
                  defaultKeywordDifficultyLevels,
                )
              "
            >
              <span
                :class="
                  getKeywordDifficultyTextClass(
                    item.existingKeyword?.difficulty ?? null,
                    defaultKeywordDifficultyLevels,
                  )
                "
              >
                {{ item.existingKeyword?.difficulty ?? "-" }}
              </span>
              -
              {{
                getKeywordDifficultyLabel(
                  item.existingKeyword?.difficulty ?? null,
                  defaultKeywordDifficultyLevels,
                )
              }}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
