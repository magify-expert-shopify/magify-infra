<script setup lang="ts">
import StatsMetricChart from "~/components/stats/StatsMetricChart.vue";
import StatsDurationChart from "~/components/stats/StatsDurationChart.vue";
import StatsKpiCard from "~/components/stats/StatsKpiCard.vue";
import type {
  StatsDashboardResponse,
  StatsDurationMetricKey,
  StatsMetricKey,
  StatsMetricSeries,
  StatsDurationSeries,
} from "~/types/stats";

const runtimeConfig = useRuntimeConfig();
const selectedRange = ref<StatsDashboardResponse["period"]["range"]>("week");
const isRefreshing = ref(false);
const rangeOptions = [
  { label: "La semaine", value: "week" },
  { label: "Le mois", value: "month" },
  { label: "Le trimestre", value: "quarter" },
  { label: "L’année", value: "year" },
  { label: "Depuis toujours", value: "all" },
] as const;

const { data, pending, error, refresh } = await useFetch<StatsDashboardResponse>(
  () => `${runtimeConfig.public.apiUrl}/stats/dashboard`,
  {
    default: () => ({
      period: { range: "week", label: "La semaine", days: 7, from: "", to: "" },
      charts: [],
      durationCharts: [],
      kpis: [],
    }),
    query: computed(() => ({
      range: selectedRange.value,
    })),
  },
);

const selectedMetricKey = ref<StatsMetricKey>("emailsSent");
const selectedDurationKey = ref<StatsDurationMetricKey>("shopify");

const metricOptions = computed(() =>
  (data.value?.charts || []).map((series) => ({
    label: series.label,
    value: series.key,
  })),
);

watch(
  metricOptions,
  (options) => {
    if (options.length === 0) {
      return;
    }

    if (!options.some((option) => option.value === selectedMetricKey.value)) {
      selectedMetricKey.value = options[0].value;
    }
  },
  { immediate: true },
);

const selectedSeries = computed<StatsMetricSeries | null>(() => {
  return (
    data.value?.charts.find(
      (series) => series.key === selectedMetricKey.value,
    ) ||
    data.value?.charts[0] ||
    null
  );
});

const durationMetricOptions = computed(() =>
  (data.value?.durationCharts || []).map((series) => ({
    label: series.label,
    value: series.key,
  })),
);

watch(
  durationMetricOptions,
  (options) => {
    if (options.length === 0) {
      return;
    }

    if (!options.some((option) => option.value === selectedDurationKey.value)) {
      selectedDurationKey.value = options[0].value;
    }
  },
  { immediate: true },
);

const selectedDurationSeries = computed<StatsDurationSeries | null>(() => {
  return (
    data.value?.durationCharts.find(
      (series) => series.key === selectedDurationKey.value,
    ) ||
    data.value?.durationCharts[0] ||
    null
  );
});

const kpis = computed(() => data.value?.kpis || []);

async function refreshStatsView() {
  if (isRefreshing.value) {
    return;
  }

  isRefreshing.value = true;

  try {
    await refresh();
  } finally {
    isRefreshing.value = false;
  }
}
</script>

<template>
  <LayoutPageShell
    eyebrow="Tableau de bord"
    title="Statistiques"
    description="Vue synthétique de l’activité de prospection, des détections et des principaux KPI."
    max-width="6xl"
  >
    <template #actions>
      <UButton
        color="neutral"
        variant="soft"
        icon="i-lucide-refresh-cw"
        :loading="isRefreshing"
        :disabled="pending"
        aria-label="Actualiser les statistiques"
        title="Actualiser les statistiques"
        @click="refreshStatsView"
      />
      <UButton
        to="/settings"
        color="neutral"
        variant="soft"
        icon="i-lucide-settings-2"
      >
        Paramètres
      </UButton>
    </template>

    <section class="space-y-4">
      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div
          class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div class="space-y-1">
            <p class="eyebrow-primary">Série d’activité</p>
            <p class="body-muted">
              Les graphiques couvrent
              {{ data?.period.label || "la période choisie" }}.
            </p>
          </div>

          <div class="w-full space-y-3 sm:w-72">
            <div>
              <label
                class="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                Période
              </label>
              <select
                v-model="selectedRange"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                <option
                  v-for="option in rangeOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div>
              <label
                class="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                Indicateur
              </label>
              <select
                v-model="selectedMetricKey"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 sm:hidden"
              >
                <option
                  v-for="option in metricOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <div class="mt-4 hidden gap-2 sm:flex">
          <button
            v-for="option in metricOptions"
            :key="option.value"
            type="button"
            class="rounded-full px-4 py-2 text-xs font-medium transition"
            :class="
              selectedMetricKey === option.value
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            "
            @click="selectedMetricKey = option.value"
          >
            {{ option.label }}
          </button>
        </div>

        <div class="mt-5">
          <StatsMetricChart v-if="selectedSeries" :series="selectedSeries" />
          <div
            v-else
            class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-muted-sm"
          >
            Chargement des statistiques...
          </div>
        </div>
      </div>
    </section>

    <section class="mt-6">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <p class="eyebrow-primary">Durées de scan</p>
          <p class="mt-1 body-muted">
            Moyenne des temps de scan enregistrés selon l’étape choisie.
          </p>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="space-y-1">
            <p class="body-muted">
              Sélectionne une étape pour voir son temps moyen de scan.
            </p>
          </div>

          <div class="w-full sm:w-80">
            <label class="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Étape
            </label>
            <select
              v-model="selectedDurationKey"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              <option
                v-for="option in durationMetricOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>
        </div>

        <div class="mt-5">
          <StatsDurationChart
            v-if="selectedDurationSeries"
            :series="selectedDurationSeries"
          />
          <div
            v-else
            class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-muted-sm"
          >
            Chargement des durées de scan...
          </div>
        </div>
      </div>
    </section>

    <section class="mt-6">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <p class="eyebrow-primary">KPI</p>
          <p class="mt-1 body-muted">
            Les indicateurs ci-dessous synthétisent la performance commerciale
            du projet.
          </p>
        </div>
      </div>

      <div
        v-if="pending"
        class="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-muted-sm"
      >
        Chargement des KPI...
      </div>
      <div
        v-else-if="error"
        class="rounded-2xl border border-red-200 bg-white px-6 py-10 text-xs text-red-600"
      >
        Impossible de charger les statistiques.
      </div>
      <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsKpiCard
          v-for="kpi in kpis"
          :key="kpi.key"
          :kpi="kpi"
          show-counts
        />
      </div>
    </section>
  </LayoutPageShell>
</template>
