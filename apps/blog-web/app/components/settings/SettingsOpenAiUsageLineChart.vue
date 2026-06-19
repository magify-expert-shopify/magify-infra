<script setup lang="ts">
import type { ChartData, ChartDataset, ChartOptions } from "chart.js";
import { CategoryScale, Chart as ChartJS, Filler, Legend, LineElement, LinearScale, PointElement, Tooltip } from "chart.js";
import { Line } from "vue-chartjs";
import type { OpenAiUsageEntryStats } from "~/types/stats";
import { getOpenAiModelColors } from "~/constants/openai-model-colors";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const props = defineProps<{
  entries: OpenAiUsageEntryStats[];
}>();

const visibleEntries = computed(() => props.entries);

const labels = computed(() =>
  visibleEntries.value.map((entry) =>
    new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(entry.createdAt)),
  ),
);

const modelGroups = computed(() => {
  const groups = new Map<string, OpenAiUsageEntryStats[]>();

  for (const entry of visibleEntries.value) {
    const group = groups.get(entry.model) ?? [];
    group.push(entry);
    groups.set(entry.model, group);
  }

  return Array.from(groups.entries()).map(([model, entries]) => ({
    model,
    entries,
  }));
});

const data = computed<ChartData<"line", (number | null)[], string>>(() => {
  const datasets: ChartDataset<"line", (number | null)[]>[] = modelGroups.value.map((group) => {
    const colors = getOpenAiModelColors(group.model);
    const dataPoints = visibleEntries.value.map((entry) =>
      entry.model === group.model ? entry.totalTokens : null,
    );

    return {
      label: group.model,
      data: dataPoints,
      borderColor: colors.border,
      backgroundColor: colors.background,
      fill: false,
      tension: 0.35,
      borderWidth: 3,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBorderWidth: 2,
      pointBorderColor: "#ffffff",
      pointBackgroundColor: colors.border,
      spanGaps: true,
    };
  });

  return {
    labels: labels.value,
    datasets,
  };
});

const options = computed<ChartOptions<"line">>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: "index",
    intersect: false,
  },
  plugins: {
    legend: { display: true, position: "top" },
    tooltip: {
      callbacks: {
        label(context) {
          const index = context.dataIndex;
          const entry = visibleEntries.value[index];

          if (!entry) {
            return [];
          }

          return [
            `${entry.model}`,
            `${entry.label}`,
            `${entry.totalTokens.toLocaleString("fr-FR")} tokens`,
            `${entry.inputTokens.toLocaleString("fr-FR")} entrée / ${entry.outputTokens.toLocaleString("fr-FR")} sortie`,
          ];
        },
      },
    },
  },
  scales: {
    x: {
      grid: {
        color: "rgb(241 245 249)",
      },
      ticks: {
        color: "rgb(100 116 139)",
        maxRotation: 0,
        autoSkip: true,
      },
    },
    y: {
      beginAtZero: true,
      grid: {
        color: "rgb(241 245 249)",
      },
      ticks: {
        color: "rgb(100 116 139)",
      },
    },
  },
}));
</script>

<template>
  <ClientOnly>
    <div class="h-[360px]">
      <Line :data="data" :options="options" />
    </div>
  </ClientOnly>
</template>
