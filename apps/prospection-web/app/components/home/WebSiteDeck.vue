<script setup lang="ts">
import type { HomeProspect } from '~/types/home-prospect'
import {
  WEBSITE_ALL_FILTER,
  getWebsiteCategoryConfig,
  type WebsiteCategoryKey,
} from '~/utils/home-website-categories'

const props = defineProps<{
  prospects: HomeProspect[]
}>()

const activeFilter = ref<WebsiteCategoryKey>('all')

function getCategoryKey(prospect: HomeProspect) {
  const redesignStatus = String(prospect.url?.redesignStatus || '').toLowerCase()

  if (redesignStatus === 'candidat refonte') {
    return 'refonte'
  }

  if (redesignStatus === 'candidat migration') {
    return 'migration'
  }

  return 'support'
}

const sortedProspects = computed(() =>
  [...props.prospects].sort((left, right) => {
    const scoreDelta = (Number(right.leadScore || 0) - Number(left.leadScore || 0))
      || (Number(right.score || 0) - Number(left.score || 0))

    if (scoreDelta !== 0) {
      return scoreDelta
    }

    return String(left.siteName || left.name).localeCompare(String(right.siteName || right.name), 'fr')
  }),
)

const counts = computed(() => {
  const base = {
    all: sortedProspects.value.length,
    support: 0,
    refonte: 0,
    migration: 0,
  }

  for (const prospect of sortedProspects.value) {
    const key = getCategoryKey(prospect)
    base[key] += 1
  }

  return base
})

const filteredProspects = computed(() => {
  if (activeFilter.value === 'all') {
    return sortedProspects.value
  }

  return sortedProspects.value.filter((prospect) => getCategoryKey(prospect) === activeFilter.value)
})

const filters = computed(() => [
  {
    ...WEBSITE_ALL_FILTER,
    count: counts.value.all,
  },
  ...(['support', 'refonte', 'migration'] as const).map((key) => {
    const config = getWebsiteCategoryConfig(key)

    return {
      key,
      label: config.label,
      count: counts.value[key],
      filterTone: config.filterTone,
      filterBadge: config.filterBadge,
      icon: config.icon,
    }
  }),
])
</script>

<template>
  <section class="w-full px-6 pb-10 lg:px-8">
    <div class="border-t border-slate-200 pt-8">
      <div class="space-y-2">
        <div class="flex items-center gap-3">
          <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            3
          </span>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Résultat
          </p>
        </div>
      </div>

      <div v-if="prospects.length" class="mt-4 flex flex-wrap gap-2">
        <UButton
          v-for="filter in filters"
          :key="filter.key"
          :class="activeFilter === filter.key ? filter.filterTone : 'bg-white text-slate-700'"
          :variant="activeFilter === filter.key ? 'solid' : 'soft'"
          color="neutral"
          size="sm"
          @click="activeFilter = filter.key"
        >
          <UIcon :name="filter.icon" class="mr-2 h-4 w-4" />
          {{ filter.label }}
          <span
            class="ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            :class="activeFilter === filter.key
              ? (filter.key === 'all'
                ? 'bg-slate-900 text-white ring-1 ring-slate-900/10'
                : 'bg-white text-slate-900 shadow-sm ring-1 ring-black/10')
              : filter.filterBadge"
          >
            {{ filter.count }}
          </span>
        </UButton>
      </div>
    </div>

    <div v-if="prospects.length" >
      <div v-if="filteredProspects.length" class="mt-5 grid w-full max-w-360 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <HomeWebSiteCard
          v-for="prospect in filteredProspects"
          :key="prospect.id"
          :prospect="prospect"
        />
      </div>

      <div
        v-else
        class="mt-5 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-muted-sm"
      >
        Aucun prospect ne correspond à ce filtre.
      </div>
    </div>
  </section>
</template>

