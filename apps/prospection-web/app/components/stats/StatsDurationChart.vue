<script setup lang="ts">
import type { StatsDurationSeries } from "~/types/stats";

const props = defineProps<{
  series: StatsDurationSeries;
}>();

const maxValue = computed(() =>
  Math.max(1, ...props.series.points.map((point) => Number(point.value || 0))),
);

function barHeight(value: number) {
  return `${Math.max(3, Math.round((value / maxValue.value) * 100))}%`;
}

function formatDuration(value: number) {
  const rounded = Math.max(0, Math.round(Number(value || 0)));

  if (rounded < 1000) {
    return `${rounded} ms`;
  }

  return `${(rounded / 1000).toFixed(1)} s`;
}
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <p class="eyebrow-primary">
          {{ series.label }}
        </p>
        <p class="body-muted">
          {{ series.description }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div
          class="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          {{ formatDuration(series.average) }} moyenne période
        </div>
      </div>
    </div>

    <div class="mt-6 overflow-x-auto">
      <div class="flex min-h-72 items-end gap-2 pb-2 pt-1">
        <div
          v-for="point in series.points"
          :key="point.date"
          class="flex min-w-[2.5rem] flex-1 flex-col items-center gap-2"
        >
          <div class="flex h-60 w-full items-end">
            <div
              class="w-full rounded-t-lg bg-gradient-to-t from-primary-700 via-primary-500 to-primary-300 transition-all"
              :style="{ height: barHeight(point.value) }"
              :title="`${point.label}: ${formatDuration(point.value)}`"
            />
          </div>
          <div class="space-y-1 text-center">
            <div class="text-[11px] font-semibold text-slate-900">
              {{ formatDuration(point.value) }}
            </div>
            <div class="text-[10px] text-slate-500">
              {{ point.label }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
