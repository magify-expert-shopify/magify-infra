<script setup lang="ts">
const props = withDefaults(defineProps<{
  eyebrow?: string
  title: string
  description?: string
  maxWidth?: '3xl' | '4xl' | '5xl' | '6xl' | 'none'
}>(), {
  eyebrow: 'Prospection Magify',
  description: '',
  maxWidth: '5xl',
})

const maxWidthClass = computed(() => {
  if (props.maxWidth === '3xl') return 'max-w-3xl'
  if (props.maxWidth === '4xl') return 'max-w-4xl'
  if (props.maxWidth === '6xl') return 'max-w-6xl'
  if (props.maxWidth === 'none') return 'max-w-none'

  return 'max-w-5xl'
})
</script>

<template>
  <main class="min-h-screen bg-background text-slate-900">
    <section class="w-full px-5 py-6 lg:px-8">
      <div class="mx-auto space-y-5" :class="maxWidthClass">
        <header class="flex flex-wrap items-start justify-between gap-4">
          <div class="space-y-2">
            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-sky-700">
              {{ eyebrow }}
            </p>
            <h1 class="page-title">
              {{ title }}
            </h1>
            <p v-if="description" class="max-w-2xl body-muted">
              {{ description }}
            </p>
          </div>

          <div v-if="$slots.actions" class="flex flex-wrap gap-2">
            <slot name="actions" />
          </div>
        </header>

        <slot />
      </div>
    </section>
  </main>
</template>
