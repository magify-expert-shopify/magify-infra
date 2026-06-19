<script setup lang="ts">
import StatsKpiCard from '~/components/stats/StatsKpiCard.vue'
import type { StatsKpi } from '~/types/stats'

const props = defineProps<{
  kpis: StatsKpi[]
}>()

</script>

<template>
  <section class="space-y-4">
    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="eyebrow-primary">
          KPI principaux
        </p>
        <p class="mt-1 body-muted">
          Vue rapide des indicateurs les plus utiles de l’activité.
        </p>
      </div>
      <UButton to="/stats" color="neutral" variant="soft" icon="i-lucide-chart-column">
        Voir les stats
      </UButton>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <StatsKpiCard
        v-for="kpi in props.kpis"
        :key="kpi.key"
        :kpi="kpi"
      />
    </div>
  </section>
</template>
