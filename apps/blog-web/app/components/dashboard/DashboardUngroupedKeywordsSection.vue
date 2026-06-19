<script setup lang="ts">
import { searchIntentLabels } from "~/constants/enums";
import type { KeywordRecord } from "~/types/keywords";

const props = defineProps<{
  keywords: KeywordRecord[];
}>();

const hasKeywords = computed(() => props.keywords.length > 0);
const ungroupedKeywordCards = computed(() => props.keywords.slice(0, 8));

function getKeywordResearchHref(keyword: string) {
  return `/keywords/research?q=${encodeURIComponent(keyword)}`;
}
</script>

<template>
  <section v-if="hasKeywords" class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-slate-900">
          Mots-clés non groupés
        </h2>
        <p class="text-sm text-slate-500">
          Ces mots-clés n’ont encore aucun groupe associé. Tu peux les organiser dès maintenant.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <UBadge color="neutral" variant="soft">
          {{ keywords.length }}
        </UBadge>

        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-folder-tree"
          to="/keywords/groups"
        >
          Organiser
        </UButton>
      </div>
    </div>

    <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article
        v-for="keyword in ungroupedKeywordCards"
        :key="keyword.id"
        class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/40"
      >
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-2">
              <p class="font-medium text-slate-900">
                {{ keyword.keyword }}
              </p>
              <div class="flex flex-wrap gap-2 text-xs text-slate-500">
                <span>Volume: {{ keyword.volume ?? "-" }}</span>
                <span>
                  Diff.: {{ keyword.difficulty ?? "-" }}
                </span>
              </div>
            </div>

            <UIcon name="i-lucide-folder-x" class="mt-1 size-5 text-slate-300" />
          </div>

          <div class="flex flex-wrap gap-2">
            <UBadge
              v-if="keyword.searchIntent"
              color="neutral"
              variant="soft"
            >
              {{ searchIntentLabels[keyword.searchIntent] }}
            </UBadge>

            <UBadge
              :color="keyword.lastScannedAt ? 'success' : 'neutral'"
              variant="soft"
            >
              {{ keyword.lastScannedAt ? "Analysé" : "Pas scanné" }}
            </UBadge>
          </div>

          <div class="flex flex-wrap gap-2">
            <NuxtLink
              :to="getKeywordResearchHref(keyword.keyword)"
              class="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
            >
              <UIcon name="i-lucide-chart-column-big" class="h-4 w-4" />
              Analyser
            </NuxtLink>

            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-folder-tree"
              to="/keywords/groups"
            >
              Grouper
            </UButton>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
