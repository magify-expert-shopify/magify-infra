<script setup lang="ts">
import type { KeywordMonthlySearch } from "~/types/keyword-analysis";

const props = defineProps<{
  monthlySearches: KeywordMonthlySearch[];
}>();

function formatMonthlySearchLabel(entry: KeywordMonthlySearch) {
  const date = new Date(entry.year, entry.month - 1, 1);

  return date.toLocaleDateString("fr-FR", {
    month: "short",
    year: "2-digit",
  });
}

function getMonthlySearchBarHeight(entry: KeywordMonthlySearch) {
  const maxVolume = Math.max(
    ...props.monthlySearches.map((item) => item.searchVolume),
    1,
  );

  return `${Math.max((entry.searchVolume / maxVolume) * 100, 10)}%`;
}
</script>

<template>
  <!-- <div class="flex items-start justify-between gap-3">
    <p class="mt-1 text-sm text-slate-500">12 derniers mois</p>
    <UIcon name="i-lucide-chart-column" class="size-5 text-sky-600" />
  </div> -->

  <div v-if="monthlySearches.length" class="mt-4 flex h-32 items-end gap-2">
    <div
      v-for="entry in monthlySearches"
      :key="`${entry.year}-${entry.month}`"
      class="flex min-w-0 flex-1 flex-col items-center gap-2"
    >
      <div class="flex h-24 w-full items-end">
        <UTooltip
          :text="`${formatMonthlySearchLabel(entry)} : ${entry.searchVolume}`"
        >
          <div
            class="w-full rounded-t-md bg-slate-300/80 transition hover:bg-slate-300"
            :style="{ height: getMonthlySearchBarHeight(entry) }"
          />
        </UTooltip>
        </div>
      <span class="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {{ formatMonthlySearchLabel(entry) }}
      </span>
    </div>
  </div>

  <p v-else class="mt-4 text-sm text-slate-400">
    Aucune donnée mensuelle disponible.
  </p>
</template>
