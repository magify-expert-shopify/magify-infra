<script setup lang="ts">
import type { UrlAnalysisRow } from "~/types/imports";

defineProps<{
  rows: UrlAnalysisRow[];
}>();
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <div class="text-xs font-medium uppercase tracking-wide text-slate-500">
      URLs
    </div>
    <div class="mt-3 max-h-[40rem] space-y-2 overflow-auto lg:max-h-[52rem]">
      <NuxtLink
        v-for="item in rows"
        :key="item.id || item.url"
        :to="item.id ? `/urls/${item.id}` : undefined"
        class="group block rounded-lg border p-3 transition"
        :class="
          item.state === 'done'
            ? 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-300 hover:bg-emerald-50'
            : item.state === 'running'
              ? 'border-sky-200 bg-sky-50 ring-2 ring-sky-100 animate-pulse'
              : item.state === 'missing'
                ? 'pointer-events-none border-rose-200 bg-rose-50 opacity-95'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
        "
      >
        <div class="flex items-center gap-3">
          <UIcon
            :name="
              item.state === 'done'
                ? 'i-lucide-circle-check-big'
                : item.state === 'running'
                  ? 'i-lucide-circle-dashed'
                  : item.state === 'missing'
                    ? 'i-lucide-triangle-alert'
                    : 'i-lucide-circle'
            "
            class="h-4 w-4 shrink-0"
            :class="
              item.state === 'done'
                ? 'text-emerald-600'
                : item.state === 'running'
                  ? 'animate-spin text-sky-600'
                  : item.state === 'missing'
                    ? 'text-rose-600'
                    : 'text-slate-400'
            "
          />
          <span
            class="min-w-0 flex-1 truncate text-xs font-medium text-slate-900"
          >
            {{ item.url }}
          </span>
          <UBadge
            :color="
              item.state === 'done'
                ? 'success'
                : item.state === 'running'
                  ? 'primary'
                  : item.state === 'missing'
                    ? 'error'
                    : 'neutral'
            "
            variant="soft"
          >
            {{
              item.state === "missing"
                ? "Absente"
                : item.state === "done"
                  ? "Analysée"
                  : item.state === "running"
                    ? "En cours"
                    : "À analyser"
            }}
          </UBadge>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>
