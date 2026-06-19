<script setup lang="ts">
defineProps<{
  isImporting: boolean;
  summaryMessage: string;
  progress: {
    total: number;
    processed: number;
    createdProblems: number;
    updatedProblems: number;
    createdCategories: number;
    skippedProblems: number;
    currentTitle: string;
  };
  progressPercent: number;
}>();

defineEmits<{
  close: [];
}>();
</script>

<template>
  <div class="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 shadow-sm">
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-4">
        <div class="space-y-1">
          <p class="text-sm font-semibold text-sky-900">
            {{ isImporting ? "Import CSV en cours" : "Import CSV terminé" }}
          </p>
          <p class="text-sm text-sky-700">
            {{ isImporting ? "Le CSV est en cours de traitement." : summaryMessage }}
          </p>
        </div>

        <button
          v-if="!isImporting"
          type="button"
          class="rounded-full p-1 text-sky-700 transition hover:bg-white/70 hover:text-sky-900"
          @click="$emit('close')"
        >
          <UIcon name="i-lucide-x" class="h-4 w-4" />
        </button>
      </div>

      <ImportsImportProgressBar
        v-if="isImporting"
        :processed="progress.processed"
        :total="progress.total"
        :percent="progressPercent"
        current-label="Traitement"
        :current-value="progress.currentTitle"
      />

      <div class="flex flex-wrap gap-2 text-xs text-sky-800">
        <span class="rounded-full bg-white/70 px-3 py-1">
          Créés : {{ progress.createdProblems }}
        </span>
        <span class="rounded-full bg-white/70 px-3 py-1">
          Mis à jour : {{ progress.updatedProblems }}
        </span>
        <span class="rounded-full bg-white/70 px-3 py-1">
          Catégories créées : {{ progress.createdCategories }}
        </span>
        <span class="rounded-full bg-white/70 px-3 py-1">
          Doublons ignorés : {{ progress.skippedProblems }}
        </span>
      </div>
    </div>
  </div>
</template>
