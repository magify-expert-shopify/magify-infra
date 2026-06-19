<script setup lang="ts">
import type { LighthouseMetric } from "~/types/urls";

const props = defineProps<{
  metrics: LighthouseMetric[];
  checkedAt: string | null;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (event: "rescan-lighthouse"): void;
}>();

function metricTone(value: number | null) {
  if (value == null) return "bg-slate-100 text-slate-500 ring-slate-200";
  if (value >= 85) return "bg-emerald-100 text-emerald-700 ring-emerald-200";
  if (value >= 60) return "bg-amber-100 text-amber-700 ring-amber-200";
  return "bg-rose-100 text-rose-700 ring-rose-200";
}

function metricBarTone(value: number | null) {
  if (value == null) return "bg-slate-300";
  if (value >= 85) return "bg-emerald-500";
  if (value >= 60) return "bg-amber-500";
  return "bg-rose-500";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Non renseigné";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Non renseigné";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
</script>

<template>
  <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex items-start justify-between gap-4">
      <div>
        <div
          class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
        >
          Score Lighthouse
        </div>

        <h3 class="mt-1 text-base font-semibold text-slate-900">
          Performance du site
        </h3>
      </div>

      <UButton
        color="neutral"
        variant="soft"
        size="sm"
        icon="i-lucide-refresh-cw"
        :loading="props.loading"
        :disabled="props.loading"
        @click="emit('rescan-lighthouse')"
      >
        Relancer le scan
      </UButton>
    </div>

    <div class="mt-5 grid grid-cols-2 gap-3">
      <div
        v-for="metric in props.metrics"
        :key="metric.label"
        class="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 transition hover:-translate-y-0.5 hover:shadow-sm"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="text-xs font-medium text-slate-700">
            {{ metric.label }}
          </div>

          <div
            class="shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset"
            :class="metricTone(metric.value)"
          >
            {{ metric.value ?? "—" }}
          </div>
        </div>

        <div class="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="metricBarTone(metric.value)"
            :style="{ width: `${metric.value ?? 0}%` }"
          />
        </div>
      </div>
    </div>

    <p class="mt-4 text-xs text-slate-500">
      Dernier audit Lighthouse effectué le
      <span class="font-medium text-slate-700">
        {{ formatDate(props.checkedAt) }}
      </span>
    </p>
  </section>
</template>
