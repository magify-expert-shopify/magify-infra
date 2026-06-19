<script setup lang="ts">
const props = defineProps<{
  done: number;
  running: number;
  pending: number;
  total: number;
  totalUrls: number;
  existingUrls: number;
  error?: string;
}>();

function getSegmentStyle(value: number) {
  if (value <= 0) {
    return {
      flexGrow: 0,
      flexBasis: "0px",
      minWidth: "0px",
    };
  }

  return {
    flexGrow: value,
    flexBasis: "0px",
    minWidth: "2rem",
  };
}
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <div class="text-xs font-medium uppercase tracking-wide text-slate-500">
      Analyse des URLs
    </div>

    <div class="mt-4 space-y-3">
      <div
        class="flex h-6 overflow-hidden rounded-full bg-slate-200 text-[11px] font-semibold text-white"
      >
        <div
          class="flex h-full items-center justify-center overflow-hidden bg-emerald-500 transition-[width] duration-500"
          :style="getSegmentStyle(props.done)"
          title="Scannées"
        >
          <span class="truncate px-1">{{ props.done }}</span>
        </div>
        <div
          class="flex h-full items-center justify-center overflow-hidden bg-sky-500 transition-[width] duration-500"
          :style="getSegmentStyle(props.running)"
          title="En cours"
        >
          <span class="truncate px-1">{{ props.running }}</span>
        </div>
        <div
          class="flex h-full items-center justify-center overflow-hidden bg-slate-300 text-slate-700 transition-[width] duration-500"
          :style="getSegmentStyle(props.pending)"
          title="En attente"
        >
          <span class="truncate px-1">{{ props.pending }}</span>
        </div>
      </div>

      <div class="flex flex-wrap gap-3 text-xs text-slate-600">
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span>Scannées</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full bg-sky-500" />
          <span>En cours</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span>En attente</span>
        </div>
      </div>

      <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div class="text-xs font-medium uppercase tracking-wide text-slate-500">
          Répartition
        </div>
        <div class="mt-2 space-y-2 text-xs">
          <div class="flex items-center justify-between gap-3">
            <span class="text-slate-500">Urls totales</span>
            <span class="font-semibold text-slate-900">{{
              props.totalUrls
            }}</span>
          </div>
          <div class="flex items-center justify-between gap-3">
            <span class="text-slate-500">Nouvelles</span>
            <span class="font-semibold text-slate-900">{{
              Math.max(0, props.totalUrls - props.existingUrls)
            }}</span>
          </div>
          <div class="flex items-center justify-between gap-3">
            <span class="text-slate-500">Déjà existantes</span>
            <span class="font-semibold text-slate-900">{{
              props.existingUrls
            }}</span>
          </div>
        </div>
      </div>

      <p v-if="props.error" class="text-xs text-rose-600">
        {{ props.error }}
      </p>
    </div>
  </section>
</template>
