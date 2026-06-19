<script setup lang="ts">
import { defaultKeywordDifficultyLevels } from "~/constants/keyword-difficulty";
import type { KeywordGroupRecord } from "~/types/keywords";
import {
  getKeywordDifficultyClass,
  getKeywordDifficultyLabel,
  getKeywordDifficultyRowToneClass,
  getKeywordDifficultyToneClass,
  getKeywordDifficultySortRank,
} from "~/utils/keyword-difficulty";
import {
  getKeywordIntentIcon,
  getKeywordIntentToneClass,
  formatKeywordIntent,
} from "~/utils/keyword-intent";
import {
  getKeywordPriorityIntentRank,
  getKeywordPriorityLevel,
} from "~/utils/keyword-priority";

const { getKeywordDifficultyLevels } = useSettings();
const { data: keywordDifficultyLevelsSettings } = await useAsyncData(
  "keyword-groups-table:keyword-difficulty-levels",
  () => getKeywordDifficultyLevels(),
);

const props = defineProps<{
  groups: KeywordGroupRecord[];
  updatingFavoriteIds?: string[];
  deletingGroupIds?: string[];
}>();

const emit = defineEmits<{
  toggleFavorite: [group: KeywordGroupRecord];
  deleteGroup: [group: KeywordGroupRecord];
}>();

const groupsById = computed(() => {
  const map = new Map<string, KeywordGroupRecord>();

  for (const group of props.groups) {
    map.set(group.id, group);
  }

  return map;
});

const hierarchyLevelById = computed(() => {
  const memo = new Map<string, number>();

  function resolveLevel(group: KeywordGroupRecord, lineage = new Set<string>()) {
    if (memo.has(group.id)) {
      return memo.get(group.id) ?? 1;
    }

    if (lineage.has(group.id)) {
      return 1;
    }

    const parentIds = [
      ...(group.parentGroups?.map((parentGroup) => parentGroup.id) ?? []),
    ]
      .map((parentGroupId) => parentGroupId.trim())
      .filter(Boolean);

    if (!parentIds.length) {
      memo.set(group.id, 1);
      return 1;
    }

    const nextLineage = new Set(lineage);
    nextLineage.add(group.id);

    const parentLevels = parentIds.map((parentGroupId) => {
      const parentGroup = groupsById.value.get(parentGroupId);

      if (!parentGroup) {
        return 1;
      }

      return resolveLevel(parentGroup, nextLineage);
    });

    const level = 1 + Math.min(...parentLevels);
    memo.set(group.id, level);
    return level;
  }

  for (const group of props.groups) {
    resolveLevel(group);
  }

  return memo;
});

function getHierarchyToneClasses(level: number) {
  if (level === 1) {
    return "border-amber-200 bg-amber-100 text-amber-800";
  }

  if (level === 2) {
    return "border-sky-200 bg-sky-100 text-sky-800";
  }

  if (level === 3) {
    return "border-rose-200 bg-rose-100 text-rose-800";
  }

  if (level === 4) {
    return "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  if (level === 5) {
    return "border-violet-200 bg-violet-100 text-violet-800";
  }

  if (level === 6) {
    return "border-cyan-200 bg-cyan-100 text-cyan-800";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

function isUpdatingFavorite(groupId: string) {
  return props.updatingFavoriteIds?.includes(groupId) ?? false;
}

function isDeletingGroup(groupId: string) {
  return props.deletingGroupIds?.includes(groupId) ?? false;
}

function normalizeKeyword(keyword?: string | null) {
  return keyword?.trim().toLowerCase() ?? "";
}

function getPrimaryKeyword(group: KeywordGroupRecord) {
  const primaryKeyword = normalizeKeyword(group.primaryKeyword);

  if (!primaryKeyword) {
    return null;
  }

  return (
    group.keywords.find(
      (keyword) => normalizeKeyword(keyword.keyword) === primaryKeyword,
    ) ?? null
  );
}

const keywordDifficultyLevels = computed(
  () =>
    keywordDifficultyLevelsSettings.value?.levels ??
    defaultKeywordDifficultyLevels,
);

type KeywordGroupSortMode =
  | "difficulty"
  | "intent"
  | "alphabetical"
  | "priority"
  | "volume";

const sortMode = ref<KeywordGroupSortMode>("difficulty");

const sortOptions = [
  { label: "Facilité", value: "difficulty" },
  { label: "Intent", value: "intent" },
  { label: "Nom alphabétique", value: "alphabetical" },
  { label: "Niveau hiérarchie", value: "priority" },
  { label: "Volume", value: "volume" },
] as const;

function formatDifficulty(difficulty?: number | null) {
  return difficulty !== null && difficulty !== undefined
    ? `${difficulty} - ${getKeywordDifficultyLabel(difficulty, keywordDifficultyLevels.value)}`
    : "-";
}

function compareGroupRecords(left: KeywordGroupRecord, right: KeywordGroupRecord) {
  const leftPrimaryKeyword = getPrimaryKeyword(left);
  const rightPrimaryKeyword = getPrimaryKeyword(right);

  const leftName = left.name.trim();
  const rightName = right.name.trim();

  if (sortMode.value === "alphabetical") {
    return leftName.localeCompare(rightName, "fr", { sensitivity: "base" });
  }

  if (sortMode.value === "volume") {
    const volumeDifference =
      (rightPrimaryKeyword?.volume ?? -1) - (leftPrimaryKeyword?.volume ?? -1);

    if (volumeDifference !== 0) {
      return volumeDifference;
    }

    const difficultyDifference =
      getKeywordDifficultySortRank(
        leftPrimaryKeyword?.difficulty,
        keywordDifficultyLevels.value,
      ) -
      getKeywordDifficultySortRank(
        rightPrimaryKeyword?.difficulty,
        keywordDifficultyLevels.value,
      );

    if (difficultyDifference !== 0) {
      return difficultyDifference;
    }
  }

  if (sortMode.value === "intent") {
    const intentDifference =
      getKeywordPriorityIntentRank(leftPrimaryKeyword?.searchIntent) -
      getKeywordPriorityIntentRank(rightPrimaryKeyword?.searchIntent);

    if (intentDifference !== 0) {
      return intentDifference;
    }
  }

  if (sortMode.value === "priority") {
    const leftPriority = getKeywordPriorityLevel(
      leftPrimaryKeyword?.searchIntent,
      leftPrimaryKeyword?.volume,
      keywordDifficultyLevels.value,
    );
    const rightPriority = getKeywordPriorityLevel(
      rightPrimaryKeyword?.searchIntent,
      rightPrimaryKeyword?.volume,
      keywordDifficultyLevels.value,
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
      getKeywordDifficultySortRank(
        leftPrimaryKeyword?.difficulty,
        keywordDifficultyLevels.value,
      ) -
      getKeywordDifficultySortRank(
        rightPrimaryKeyword?.difficulty,
        keywordDifficultyLevels.value,
      );

    if (difficultyDifference !== 0) {
      return difficultyDifference;
    }

    const volumeDifference =
      (rightPrimaryKeyword?.volume ?? -1) - (leftPrimaryKeyword?.volume ?? -1);

    if (volumeDifference !== 0) {
      return volumeDifference;
    }
  }

  return leftName.localeCompare(rightName, "fr", { sensitivity: "base" });
}

const sortedGroups = computed(() =>
  [...props.groups]
    .filter((group) => (group.keywords?.length ?? 0) > 0)
    .sort(compareGroupRecords),
);

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
          <th class="px-4 py-3 font-medium">Nom du groupe</th>
          <th class="px-4 py-3 font-medium">Description</th>
          <th class="w-0 px-4 py-3 font-medium">Volume</th>
          <th class="w-0 px-4 py-3 font-medium">Difficulté</th>
          <th class="w-0 px-4 py-3 font-medium">Intent</th>
          <th class="w-0 px-4 py-3 font-medium">Niveau</th>
          <th class="w-0 px-4 py-3 font-medium text-right">Supprimer</th>
        </tr>
      </thead>

      <tbody class="divide-y divide-slate-100">
        <tr
          v-for="group in sortedGroups"
          :key="group.id"
          :class="
            getKeywordDifficultyRowToneClass(
              getPrimaryKeyword(group)?.difficulty,
              keywordDifficultyLevels,
            )
          "
        >
          <td class="px-4 py-3 text-slate-600">
            <button
              type="button"
              class="group/favorite inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-amber-50"
              :title="
                group.isFavorite
                  ? 'Retirer des favoris'
                  : 'Ajouter aux favoris'
              "
              :disabled="isUpdatingFavorite(group.id)"
              @click="$emit('toggleFavorite', group)"
            >
              <UIcon
                name="i-lucide-star"
                class="h-5 w-5 transition-all"
                :class="[
                  group.isFavorite
                    ? 'fill-amber-500 text-amber-500 opacity-100'
                    : 'text-amber-600/40 opacity-50 group-hover/favorite:text-amber-600 group-hover/favorite:opacity-100',
                  isUpdatingFavorite(group.id) ? 'animate-pulse' : '',
                ]"
              />
            </button>
          </td>

          <td class="px-4 py-3">
            <NuxtLink
              :to="`/keyword-groups/${group.id}`"
              class="font-medium text-slate-900 underline decoration-transparent underline-offset-4 transition hover:decoration-slate-300"
            >
              {{ group.name }}
            </NuxtLink>
          </td>

          <td class="px-4 py-3 text-slate-600">
            <span class="line-clamp-2">
              {{ group.description || "-" }}
            </span>
          </td>

          <td class="px-4 py-3 text-slate-700">
            <template v-if="getPrimaryKeyword(group)">
              {{ getPrimaryKeyword(group)?.volume ?? "-" }}
            </template>
            <span v-else>-</span>
          </td>

          <td class="px-4 py-3 text-slate-700">
            <template v-if="getPrimaryKeyword(group)">
              <span
                class="whitespace-nowrap inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium"
                :class="
                  getKeywordDifficultyToneClass(
                    getPrimaryKeyword(group)?.difficulty,
                    keywordDifficultyLevels,
                  )
                "
                :title="formatDifficulty(getPrimaryKeyword(group)?.difficulty)"
              >
                <span
                  class="inline-block h-2.5 w-2.5 rounded-full"
                  :class="
                    getKeywordDifficultyClass(
                      getPrimaryKeyword(group)?.difficulty,
                      keywordDifficultyLevels,
                    )
                  "
                />
                {{ formatDifficulty(getPrimaryKeyword(group)?.difficulty) }}
              </span>
            </template>
            <span v-else>-</span>
          </td>

          <td class="px-4 py-3 text-slate-700">
            <template v-if="getPrimaryKeyword(group)">
              <span
                v-if="getPrimaryKeyword(group)?.searchIntent"
                class="inline-flex items-center gap-2"
                :class="getKeywordIntentToneClass(getPrimaryKeyword(group)?.searchIntent)"
              >
                <UIcon
                  :name="getKeywordIntentIcon(getPrimaryKeyword(group)?.searchIntent)"
                  class="h-5 w-5"
                />
                {{ formatKeywordIntent(getPrimaryKeyword(group)?.searchIntent) }}
              </span>
              <span v-else>-</span>
            </template>
            <span v-else>-</span>
          </td>

          <td class="px-4 py-3 text-slate-600">
            <UBadge
              variant="soft"
              :class="getHierarchyToneClasses(hierarchyLevelById.get(group.id) ?? 1)"
            >
              N{{ hierarchyLevelById.get(group.id) ?? 1 }}
            </UBadge>
          </td>

          <td class="px-4 py-3 text-right">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-trash-2"
              :loading="isDeletingGroup(group.id)"
              @click="$emit('deleteGroup', group)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  </div>
</template>
