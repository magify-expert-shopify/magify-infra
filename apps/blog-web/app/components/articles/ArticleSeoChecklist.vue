<script setup lang="ts">
import type { PropType } from "vue";

interface ArticleSeoChecklistItem {
  label: string;
  detail?: string;
  passed: boolean;
}

interface ArticleSeoChecklistSection {
  id: string;
  title: string;
  items: ArticleSeoChecklistItem[];
}

defineProps({
  sections: {
    type: Array as PropType<ArticleSeoChecklistSection[]>,
    required: true,
  },
});
</script>

<template>
  <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div class="space-y-5">
      <div>
        <h2 class="text-lg font-semibold text-slate-900">Checklist automatique</h2>
        <p class="mt-1 text-sm text-slate-500">
          Cette checklist se met à jour automatiquement selon le contenu et les champs SEO de l’article.
        </p>
      </div>

      <div class="space-y-4">
        <div
          v-for="section in sections"
          :key="section.id"
          class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
        >
          <div class="mb-3 flex items-center justify-between gap-3">
            <h3 class="text-sm font-semibold text-slate-900">
              {{ section.title }}
            </h3>
            <UBadge
              :color="section.items.every((item) => item.passed) ? 'success' : 'warning'"
              variant="soft"
            >
              {{ section.items.filter((item) => item.passed).length }}/{{ section.items.length }}
            </UBadge>
          </div>

          <div class="space-y-2">
            <div
              v-for="item in section.items"
              :key="item.label"
              class="flex items-start gap-3 rounded-xl bg-white/80 px-3 py-2"
            >
              <div
                :class="[
                  'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold',
                  item.passed
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700',
                ]"
              >
                {{ item.passed ? "✓" : "!" }}
              </div>
              <div class="min-w-0">
                <p
                  :class="[
                    'text-sm',
                    item.passed ? 'text-slate-800' : 'text-slate-700',
                  ]"
                >
                  {{ item.label }}
                </p>
                <p v-if="item.detail" class="text-xs text-slate-500">
                  {{ item.detail }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
