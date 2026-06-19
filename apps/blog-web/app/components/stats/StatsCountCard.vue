<script setup lang="ts">
defineProps<{
  label: string;
  value: number;
}>();
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {{ label }}
    </p>
    <p class="mt-2 text-3xl font-semibold text-slate-900">
      {{ value }}
    </p>
  </div>
</template>
