<script setup lang="ts">
import type { StatsKpi } from '~/types/stats'

const props = withDefaults(defineProps<{
  kpi: StatsKpi
  showCounts?: boolean
}>(), {
  showCounts: false,
})

function formatPercent(value: number) {
  return `${value.toFixed(1)} %`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('fr-FR').format(value)
}

function formatKpiValue(kpi: StatsKpi) {
  if (kpi.format === 'percent') return formatPercent(kpi.value)
  if (kpi.format === 'score') return `${formatNumber(kpi.value)} / ${formatNumber(kpi.denominator)}`
  return formatNumber(kpi.value)
}

function getKpiValueClass(kpi: StatsKpi) {
  if (kpi.format !== 'percent') {
    return 'text-slate-900'
  }

  const value = kpi.value

  switch (kpi.key) {
    case 'shopifyDetectionRate':
      if (value >= 60) return 'text-emerald-600'
      if (value >= 35) return 'text-amber-600'
      return 'text-red-600'
    case 'contactFoundRate':
      if (value >= 25) return 'text-emerald-600'
      if (value >= 12) return 'text-amber-600'
      return 'text-red-600'
    case 'exploitablesRate':
      if (value >= 25) return 'text-emerald-600'
      if (value >= 12) return 'text-amber-600'
      return 'text-red-600'
    case 'contactedProspectsRate':
      if (value >= 60) return 'text-emerald-600'
      if (value >= 35) return 'text-amber-600'
      return 'text-red-600'
    case 'responseRate':
      if (value >= 25) return 'text-emerald-600'
      if (value >= 10) return 'text-amber-600'
      return 'text-red-600'
    case 'relaunchUsefulRate':
      if (value >= 15) return 'text-emerald-600'
      if (value >= 5) return 'text-amber-600'
      return 'text-red-600'
    case 'clientConversionRate':
      if (value >= 12) return 'text-emerald-600'
      if (value >= 5) return 'text-amber-600'
      return 'text-red-600'
    default:
      if (value >= 50) return 'text-emerald-600'
      if (value >= 20) return 'text-amber-600'
      return 'text-red-600'
  }
}
</script>

<template>
  <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
    <p class="eyebrow-muted">
      {{ props.kpi.label }}
    </p>
    <div class="mt-3 text-3xl font-semibold tracking-tight" :class="getKpiValueClass(props.kpi)">
      {{ formatKpiValue(props.kpi) }}
    </div>
    <p class="mt-2 body-muted text-xs">
      {{ props.kpi.helper }}
    </p>
    <p v-if="props.showCounts" class="mt-3 text-xs text-slate-500">
      {{ formatNumber(props.kpi.numerator) }} / {{ formatNumber(props.kpi.denominator) }}
    </p>
  </article>
</template>
