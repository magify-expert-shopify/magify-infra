<script setup lang="ts">
defineProps<{
  processed: number;
  total: number;
  percent: number;
  currentLabel?: string;
  currentValue?: string;
}>();
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <p class="text-sm font-semibold text-sky-900">
          {{ currentLabel || "Traitement en cours" }}
        </p>
        <p class="text-sm text-sky-700">
          {{
            currentValue
              ? `${currentLabel || "Traitement"} : ${currentValue}`
              : "Préparation de l’import..."
          }}
        </p>
      </div>

      <div class="text-right">
        <p class="text-sm font-semibold text-sky-900">
          {{ processed }} / {{ total }}
        </p>
        <p class="text-xs text-sky-700">
          {{ percent }}%
        </p>
      </div>
    </div>

    <div class="h-2 overflow-hidden rounded-full bg-sky-100">
      <div
        class="h-full rounded-full bg-sky-500 transition-[width] duration-200"
        :style="{ width: `${percent}%` }"
      />
    </div>
  </div>
</template>
