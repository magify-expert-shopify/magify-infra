<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {{ title }}
    </p>
    <slot />
  </div>
</template>
