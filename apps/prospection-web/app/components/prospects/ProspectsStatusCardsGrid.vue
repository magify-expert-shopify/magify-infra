<script setup lang="ts">
type ProspectStatusCard = {
  status: string;
  label: string;
  tone: string;
  icon: string;
  count: number;
  to: string;
};

defineProps<{
  cards: ProspectStatusCard[];
}>();
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
    <NuxtLink
      v-for="item in cards"
      :key="item.status"
      :to="item.to"
      class="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <div
            class="text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            {{ item.status }}
          </div>
          <div class="mt-2 text-3xl font-semibold text-slate-900">
            {{ item.count }}
          </div>
        </div>
        <span
          class="inline-flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-inset"
          :class="item.tone"
          :title="item.label"
        >
          <UIcon :name="item.icon" class="h-4 w-4" />
        </span>
      </div>
      <div class="mt-3 text-xs font-medium text-slate-600">
        {{ item.label }}
      </div>
    </NuxtLink>
  </div>
</template>
