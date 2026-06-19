<script setup lang="ts">
import type { BadgeTone } from '~/types/site-settings'

const props = withDefaults(
  defineProps<{
    to: string
    eyebrow: string
    title: string
    description: string
    ctaLabel: string
    icon: string
    badgeLabel?: string
    badgeValue?: string | number
    badgeTone?: BadgeTone
  }>(),
  {
    badgeLabel: '',
    badgeValue: '',
    badgeTone: 'rose',
  },
)

const accentClasses = computed(() => ({
  wrapper: 'hover:border-slate-300',
  iconWrap: 'bg-slate-100 text-slate-700 ring-slate-200',
  cta: 'text-slate-700',
  arrow: 'text-slate-500',
}))

const badgeCount = computed(() => {
  const value = Number(props.badgeValue)
  return Number.isFinite(value) ? value : null
})

const badgeClasses = computed(() =>
  badgeCount.value !== null && badgeCount.value <= 0
    ? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
    : props.badgeTone === 'rose'
      ? 'bg-rose-600 text-white'
      : 'bg-slate-900 text-white',
)
</script>

<template>
  <NuxtLink
    :to="to"
    class="group rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
    :class="accentClasses.wrapper"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="space-y-2.5">
        <div class="flex items-center gap-2.5">
          <span
            class="inline-flex h-8 w-8 items-center justify-center rounded-full ring-1"
            :class="accentClasses.iconWrap"
          >
            <UIcon :name="icon" class="h-4 w-4" />
          </span>
          <div>
            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              {{ eyebrow }}
            </p>
            <h2 class="text-lg font-semibold text-slate-900">
              {{ title }}
            </h2>
          </div>
        </div>

        <p class="max-w-xl text-xs leading-5 text-slate-600">
          {{ description }}
        </p>
      </div>

      <div
        v-if="badgeLabel"
        class="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5"
      >
        <span class="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {{ badgeLabel }}
        </span>
        <span
          class="inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold"
          :class="badgeClasses"
        >
          {{ badgeValue }}
        </span>
      </div>
    </div>

    <div class="mt-4 flex items-center justify-between">
      <span class="text-xs font-medium transition group-hover:translate-x-0.5" :class="accentClasses.cta">
        {{ ctaLabel }}
      </span>
      <UIcon
        name="i-lucide-arrow-right"
        class="h-3.5 w-3.5 transition group-hover:translate-x-1"
        :class="accentClasses.arrow"
      />
    </div>
  </NuxtLink>
</template>
