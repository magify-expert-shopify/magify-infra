<script setup lang="ts">
type DashboardSummaryCard = {
  label: string;
  value: number;
  icon: string;
  toneClass: string;
};

defineProps<{
  cards: DashboardSummaryCard[];
}>();
</script>

<template>
  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    <article
      v-for="card in cards"
      :key="card.label"
      class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="space-y-1">
          <p class="text-sm text-slate-500">{{ card.label }}</p>
          <p class="text-3xl font-semibold text-slate-900">{{ card.value }}</p>
        </div>
        <div
          class="flex h-11 w-11 items-center justify-center rounded-2xl"
          :class="card.toneClass"
        >
          <UIcon :name="card.icon" class="h-5 w-5" />
        </div>
      </div>
    </article>
  </div>
</template>
