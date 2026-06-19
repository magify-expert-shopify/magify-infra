<script setup lang="ts">
import StatsCountsList from "~/components/stats/StatsCountsList.vue";
import StatsQueuesList from "~/components/stats/StatsQueuesList.vue";

const { useCurrentGoalData, useQueueDashboardData, useStatsCountsData } =
  useQueueDashboard();
const config = useRuntimeConfig();

const { data, error, status } = await useQueueDashboardData();
const { data: counts } = await useStatsCountsData();
const { data: currentGoal } = await useCurrentGoalData();
const bullDashboardUrl = `${config.public.apiUrl}/admin/queues`;
const currentMonthLabel = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
}).format(new Date());
</script>

<template>
  <section class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <p class="text-sm text-slate-500">
        Vue des queues BullMQ en cours et de leurs jobs recents.
      </p>
      <a
        :href="bullDashboardUrl"
        target="_blank"
        rel="noreferrer"
        class="inline-flex text-sm font-medium text-sky-600 underline underline-offset-2 transition hover:text-sky-700"
      >
        Ouvrir le Bull dashboard
      </a>
    </header>

    <p v-if="status === 'pending'" class="text-sm text-slate-500">
      Chargement du dashboard des queues...
    </p>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :details="error.toString()"
      title="Impossible de charger le dashboard"
      description="Les données des queues BullMQ n'ont pas pu être récupérées."
    />

    <div v-else class="space-y-6">
      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="space-y-1">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Objectif
          </p>
          <h2 class="text-lg font-semibold text-slate-900">
            Objectif du sprint
          </h2>
          <p class="text-sm text-slate-500">
            {{ currentMonthLabel }}
          </p>
        </div>

        <div class="mt-4 rounded-2xl bg-slate-50 px-4 py-3">
          <p class="text-sm font-medium text-slate-900">
            {{ currentGoal?.goalLabel || "Mettre en place le cluster \"Performance Shopify\"" }}
          </p>
        </div>

        <div class="mt-4 space-y-2">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-medium text-slate-700">
              Avancement de l’objectif en cours
            </p>
            <p class="text-sm font-semibold text-slate-900">
              {{ currentGoal?.current ?? 0 }}/{{ currentGoal?.target ?? 10 }}
            </p>
          </div>

          <div class="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              class="h-full rounded-full bg-sky-600 transition-all"
              :style="{ width: `${currentGoal?.progressPercentage ?? 0}%` }"
            />
          </div>

          <p class="text-xs text-slate-500">
            {{ currentGoal?.progressPercentage ?? 0 }}% de l’objectif atteint ce mois-ci.
          </p>
        </div>
      </div>

      <StatsCountsList :counts="counts" />
      <StatsQueuesList :queues="data?.queues ?? []" />
    </div>
  </section>
</template>
