<script setup lang="ts">
const props = defineProps<{
  positionLabel: string;
  themeLabel: string;
  cmsLabel: string;
}>();
</script>

<template>
  <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="mb-5">
      <div
        class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
      >
        Récapitulatif
      </div>
      <h3 class="mt-1 text-base font-semibold text-slate-900">
        Positionnement et contexte
      </h3>
    </div>

    <div class="space-y-4">
      <div class="flex items-start gap-3">
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
        >
          ◉
        </div>

        <div class="min-w-0 flex-1">
          <div class="text-xs font-medium text-slate-500">Positionnement</div>
          <div class="mt-0.5 truncate text-xs font-semibold text-slate-900">
            {{ props.positionLabel || "—" }}
          </div>
        </div>
      </div>

      <div class="flex items-start gap-3">
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600"
        >
          S
        </div>

        <div class="min-w-0 flex-1">
          <div class="text-xs font-medium text-slate-500">CMS / thème</div>
          <div class="mt-0.5 truncate text-xs font-semibold text-slate-900">
            {{ props.cmsLabel || "—" }}
            <span class="text-slate-400">·</span>
            {{ props.themeLabel || "—" }}
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
