<script setup lang="ts">
import { keywordLengthTypeLabels, searchIntentLabels } from "~/constants/enums";
import { pageTypeLabels } from "~/constants/pages";
import { defaultKeywordDifficultyLevels } from "~/constants/keyword-difficulty";
import { defaultKeywordVolumeThresholds } from "~/constants/keyword-volume";
import type { KeywordRecord } from "~/types/keywords";
import {
  getKeywordDifficultyLabel,
  getKeywordDifficultyClass,
  getKeywordDifficultyRowToneClass,
  getKeywordDifficultySortRank,
} from "~/utils/keyword-difficulty";
import {
  getKeywordIntentIcon,
  getKeywordIntentToneClass,
} from "~/utils/keyword-intent";
import { buildKeywordResearchUrl } from "~/utils/keyword-research-url";
import {
  getKeywordPriorityIntentRank,
  getKeywordPriorityLevel,
} from "~/utils/keyword-priority";

const props = defineProps<{
  keywords: KeywordRecord[];
  updatingFavoriteIds?: string[];
  deletingKeywordIds?: string[];
}>();

const { getKeywordDifficultyLevels, getKeywordVolumeThresholds } =
  useSettings();
const { showErrorToast, showSuccessToast } = useAppToast();
const { data: keywordDifficultyLevelsSettings } = await useAsyncData(
  "settings:keyword-difficulty-levels",
  () => getKeywordDifficultyLevels(),
);
const { data: keywordVolumeThresholdsSettings } = await useAsyncData(
  "settings:keyword-volume-thresholds",
  () => getKeywordVolumeThresholds(),
);
const keywordDifficultyLevels = computed(
  () =>
    keywordDifficultyLevelsSettings.value?.levels ??
    defaultKeywordDifficultyLevels,
);
const keywordVolumeThresholds = computed(
  () => keywordVolumeThresholdsSettings.value ?? defaultKeywordVolumeThresholds,
);

type KeywordSortMode =
  | "difficulty"
  | "intent"
  | "alphabetical"
  | "priority"
  | "volume";

const sortMode = ref<KeywordSortMode>("difficulty");

const sortOptions = [
  { label: "Facilité", value: "difficulty" },
  { label: "Intent", value: "intent" },
  { label: "Nom alphabétique", value: "alphabetical" },
  { label: "Niveau hiérarchie", value: "priority" },
  { label: "Volume", value: "volume" },
] as const;

async function handleCopyKeywordId(keywordId: string) {
  try {
    await navigator.clipboard.writeText(keywordId);
    showSuccessToast("ID copié", "L'identifiant du mot-clé a été copié.");
  } catch {
    showErrorToast(
      "Copie impossible",
      "Le navigateur n'a pas autorisé la copie dans le presse-papiers.",
    );
  }
}

function compareKeywords(left: KeywordRecord, right: KeywordRecord) {
  const leftKeyword = left.keyword.trim();
  const rightKeyword = right.keyword.trim();

  if (sortMode.value === "alphabetical") {
    return leftKeyword.localeCompare(rightKeyword, "fr", {
      sensitivity: "base",
    });
  }

  if (sortMode.value === "volume") {
    const volumeDifference = (right.volume ?? -1) - (left.volume ?? -1);

    if (volumeDifference !== 0) {
      return volumeDifference;
    }

    const difficultyDifference =
      getKeywordDifficultySortRank(left.difficulty, keywordDifficultyLevels.value) -
      getKeywordDifficultySortRank(right.difficulty, keywordDifficultyLevels.value);

    if (difficultyDifference !== 0) {
      return difficultyDifference;
    }
  }

  if (sortMode.value === "intent") {
    const intentDifference =
      getKeywordPriorityIntentRank(left.searchIntent) -
      getKeywordPriorityIntentRank(right.searchIntent);

    if (intentDifference !== 0) {
      return intentDifference;
    }
  }

  if (sortMode.value === "priority") {
    const leftPriority = getKeywordPriorityLevel(
      left.searchIntent,
      left.volume,
      keywordVolumeThresholds.value,
    );
    const rightPriority = getKeywordPriorityLevel(
      right.searchIntent,
      right.volume,
      keywordVolumeThresholds.value,
    );
    const priorityDifference =
      (leftPriority ?? Number.POSITIVE_INFINITY) -
      (rightPriority ?? Number.POSITIVE_INFINITY);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }
  }

  if (sortMode.value === "difficulty") {
    const difficultyDifference =
      getKeywordDifficultySortRank(left.difficulty, keywordDifficultyLevels.value) -
      getKeywordDifficultySortRank(right.difficulty, keywordDifficultyLevels.value);

    if (difficultyDifference !== 0) {
      return difficultyDifference;
    }

    const volumeDifference = (right.volume ?? -1) - (left.volume ?? -1);

    if (volumeDifference !== 0) {
      return volumeDifference;
    }
  }

  return leftKeyword.localeCompare(rightKeyword, "fr", {
    sensitivity: "base",
  });
}

const sortedKeywords = computed(() => [...props.keywords].sort(compareKeywords));

defineEmits<{
  toggleFavorite: [keyword: KeywordRecord];
  deleteKeyword: [keyword: KeywordRecord];
}>();
</script>

<template>
  <div class="mt-5 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="text-sm text-slate-500">
        Tri actuel:
        <span class="font-medium text-slate-700">
          {{ sortOptions.find((option) => option.value === sortMode)?.label }}
        </span>
      </div>

      <USelect
        v-model="sortMode"
        :items="sortOptions"
        value-key="value"
        label-key="label"
        class="w-full max-w-xs"
      />
    </div>

    <div class="overflow-x-auto">
    <table class="min-w-full divide-y divide-slate-200 text-sm">
      <thead>
        <tr class="text-left text-slate-500">
          <th class="w-0 px-4 py-3 font-medium">Favori</th>
          <th class="w-0 px-4 py-3 font-medium">Difficulté</th>
          <th class="px-4 py-3 font-medium">Mot-clé</th>
          <th class="px-4 py-3 font-medium">Volume</th>
          <th class="px-4 py-3 font-medium">Intent</th>
          <th class="px-4 py-3 font-medium">Longueur</th>
          <!-- <th class="px-4 py-3 font-medium">Priorité</th> -->
          <th class="px-4 py-3 font-medium">Groupe</th>
          <th class="px-4 py-3 font-medium">Template</th>
          <th class="px-4 py-3 font-medium">Page</th>
          <th class="w-0 px-4 py-3 font-medium">ID</th>
          <th class="px-4 py-3 font-medium">Statut</th>
          <th class="w-0 px-4 py-3 font-medium">Explorer</th>
          <th class="w-0 px-4 py-3 font-medium text-right">Supprimer</th>
        </tr>
      </thead>

      <tbody class="divide-y divide-slate-100">
        <tr
          v-for="keyword in sortedKeywords"
          :key="keyword.id"
          :class="
            getKeywordDifficultyRowToneClass(
              keyword.difficulty,
              keywordDifficultyLevels,
            )
          "
        >
          <td class="px-4 py-3 text-slate-600">
            <button
              type="button"
              class="group/favorite inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-amber-50"
              :title="
                keyword.isFavorite
                  ? 'Retirer des favoris'
                  : 'Ajouter aux favoris'
              "
              :disabled="props.updatingFavoriteIds?.includes(keyword.id)"
              @click="$emit('toggleFavorite', keyword)"
            >
              <UIcon
                :name="keyword.isFavorite ? 'i-lucide-star' : 'i-lucide-star'"
                class="h-5 w-5 transition-all"
                :class="[
                  keyword.isFavorite
                    ? 'fill-amber-500 text-amber-500 opacity-100'
                    : 'text-amber-600/40 opacity-50 group-hover/favorite:text-amber-600 group-hover/favorite:opacity-100',
                  props.updatingFavoriteIds?.includes(keyword.id)
                    ? 'animate-pulse'
                    : '',
                ]"
              />
            </button>
          </td>

          <!-- <td class="w-0 px-4 py-3">
            <div class="h-8 w-2" :class="getKeywordDifficultyToneClass(keyword.difficulty)"></div>
            <div
              class="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
              :class="
                getKeywordDifficultyToneClass(
                  keyword.difficulty,
                  keywordDifficultyLevels,
                )
              "
              :title="`${keyword.difficulty ?? '-'} - ${getKeywordDifficultyLabel(
                keyword.difficulty,
                keywordDifficultyLevels,
              )}`"
            >
              <span
                :class="
                  getKeywordDifficultyTextClass(
                    keyword.difficulty,
                    keywordDifficultyLevels,
                  )
                "
              >
                {{ keyword.difficulty }}
              </span>
            </div>
          </td> -->

          <td colspan="2" class="px-4 py-3 font-medium text-slate-900">
            <div class="flex gap-4 items-center">
              <UTooltip
                :text="`${keyword.difficulty ?? '-'} - ${getKeywordDifficultyLabel(keyword.difficulty, keywordDifficultyLevels)}`"
              >
                <div
                  class="h-8 w-3 rounded-full"
                  :class="
                    getKeywordDifficultyClass(
                      keyword.difficulty,
                      keywordDifficultyLevels,
                    )
                  "
                ></div>
              </UTooltip>
              <NuxtLink
                :to="
                  buildKeywordResearchUrl(keyword.keyword, {
                    autorun: false,
                    language: 'fr',
                    country: 'fr',
                  })
                "
                class="whitespace-nowrap underline decoration-transparent underline-offset-4 transition hover:decoration-slate-300"
              >
                {{ keyword.keyword }}
              </NuxtLink>
            </div>
          </td>

          <td class="w-0 px-8 py-3 text-slate-600">
            <span class="inline-flex items-center gap-2">
              <UIcon name="i-lucide-chart-column" class="h-5 w-5" />
              {{ keyword.volume ?? "-" }}
            </span>
          </td>

          <td class="w-0 px-8 py-3 text-slate-600">
            <span
              class="inline-flex items-center gap-2"
              :class="getKeywordIntentToneClass(keyword.searchIntent)"
            >
              <UIcon
                :name="getKeywordIntentIcon(keyword.searchIntent)"
                class="h-5 w-5"
              />
              {{
                keyword.searchIntent
                  ? searchIntentLabels[keyword.searchIntent]
                  : "-"
              }}
            </span>
          </td>

          <td class="w-0 px-8 py-3 text-slate-600">
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-ruler-dimension-line"
                class="shrink-0 h-5 w-5"
              />
              {{
                keyword.lengthType
                  ? keywordLengthTypeLabels[keyword.lengthType]
                  : "-"
              }}
            </div>
          </td>

          <!-- <td class="px-4 py-3 text-slate-600">
            <span
              class="whitespace-nowrap inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
              :class="
                getKeywordPriorityToneClass(
                  keyword.searchIntent,
                  keyword.volume,
                  keywordVolumeThresholds,
                )
              "
            >
              {{
                getKeywordPriorityLabel(
                  keyword.searchIntent,
                  keyword.volume,
                  keywordVolumeThresholds,
                )
              }}
            </span>
          </td> -->

          <td class="w-64 whitespace-nowrap px-8 py-3 text-slate-600">
            <NuxtLink
              v-if="keyword.keywordGroup?.id"
              :to="`/keyword-groups/${keyword.keywordGroup.id}`"
              class="inline-flex items-center gap-2 underline decoration-transparent underline-offset-4 transition hover:decoration-slate-300 hover:text-slate-900"
            >
              <UIcon name="i-lucide-folder" class="h-5 w-5" />
              {{ keyword.keywordGroup.name }}
            </NuxtLink>

            <span v-else class="inline-flex items-center gap-2">
              <UIcon name="i-lucide-folder" class="h-5 w-5" />
              -
            </span>
          </td>

          <td class="w-64 whitespace-nowrap px-8 py-3 text-slate-600">
            <span class="inline-flex items-center gap-2">
              <UIcon name="i-lucide-file-text" class="h-5 w-5" />
              {{
                keyword.template
                  ? pageTypeLabels[keyword.template]
                  : keyword.page?.pageType
                    ? pageTypeLabels[keyword.page.pageType]
                    : "-"
              }}
            </span>
          </td>

          <td class="w-72 whitespace-nowrap px-8 py-3 text-slate-600">
            <NuxtLink
              v-if="keyword.page?.url"
              :to="
                keyword.page.pageType === 'BLOG_ARTICLE'
                  ? `/articles/${keyword.page.id}`
                  : keyword.page.url
              "
              class="inline-flex max-w-full items-center gap-2 underline decoration-transparent underline-offset-4 transition hover:decoration-slate-300 hover:text-slate-900"
            >
              <UIcon name="i-lucide-file-text" class="h-5 w-5" />
              <span class="min-w-0 truncate">
                {{ keyword.page.title || keyword.page.url }}
              </span>
            </NuxtLink>

            <span v-else class="inline-flex items-center gap-2">
              <UIcon name="i-lucide-file-text" class="h-5 w-5" />
              -
            </span>
          </td>

          <td class="w-0 whitespace-nowrap px-4 py-3 text-slate-600">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-clipboard-copy"
              :title="`Copier l'ID ${keyword.id}`"
              class="transition hover:bg-slate-100"
              @click="handleCopyKeywordId(keyword.id)"
            />
          </td>

          <td class="w-0 px-8 py-3 text-slate-600">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge
                v-if="keyword.lastScannedAt"
                color="success"
                variant="soft"
                class="inline-flex items-center gap-1.5"
              >
                <UIcon name="i-lucide-badge-check" class="h-4 w-4" />
                Scanné
              </UBadge>

              <NuxtLink
                v-else
                :to="
                  buildKeywordResearchUrl(keyword.keyword, {
                    language: 'fr',
                    country: 'fr',
                  })
                "
                class="inline-flex whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-medium transition"
                :class="
                  keyword.lastScannedAt
                    ? 'border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
                "
              >
                <UIcon
                  :name="
                    keyword.lastScannedAt
                      ? 'i-lucide-chart-line'
                      : 'i-lucide-scan-search'
                  "
                  class="h-4 w-4"
                />
                {{ keyword.lastScannedAt ? "Voir l’analyse" : "Analyser" }}
              </NuxtLink>
            </div>
          </td>

          <td class="w-0 whitespace-nowrap px-8 py-3 text-slate-600">
            <NuxtLink
              :to="`/keywords/search?q=${encodeURIComponent(keyword.keyword)}`"
              class="inline-flex whitespace-nowrap rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-medium text-cyan-700 transition hover:bg-cyan-100 hover:text-cyan-800"
            >
              Explorer
            </NuxtLink>
          </td>

          <td class="w-0 whitespace-nowrap px-8 py-3 text-right">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-trash-2"
              class="text-slate-400 transition hover:bg-red-50 hover:text-red-600"
              :loading="props.deletingKeywordIds?.includes(keyword.id)"
              :disabled="props.deletingKeywordIds?.includes(keyword.id)"
              @click="$emit('deleteKeyword', keyword)"
            />
          </td>
        </tr>
      </tbody>
    </table>
    </div>
  </div>
</template>
