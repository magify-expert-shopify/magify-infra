<script setup lang="ts">
import type { KeywordSheeterSearchResultItem } from "~/types/keyword-sheeter";
import { buildKeywordResearchUrl } from "~/utils/keyword-research-url";
import { formatKeywordIntent } from "~/utils/keyword-intent";

const props = defineProps<{
  item: KeywordSheeterSearchResultItem;
  isAnalyzing?: boolean;
}>();

defineEmits<{
  addToBase: [keyword: string];
  addToBaseAndFavorite: [keyword: string];
  analyze: [keyword: string];
}>();

</script>

<template>
  <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div
      class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
    >
      <div class="space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="text-base font-semibold text-slate-900">
            {{ props.item.keyword }}
          </h3>
          <UBadge variant="soft" color="neutral">
            {{ props.item.sourceQuery }}
          </UBadge>
          <UBadge
            v-if="props.item.existingKeyword"
            variant="soft"
            color="success"
          >
            En base
          </UBadge>
          <UBadge v-if="props.item.analysis" variant="soft" color="info">
            Scanné
          </UBadge>
        </div>

        <p class="text-sm text-slate-500">
          {{
            props.item.analysis
              ? "Mot-clé déjà analysé, tu peux ouvrir ses résultats."
              : props.item.existingKeyword
                ? "Mot-clé déjà enregistré en base."
                : "Suggestion générée à partir de Google Suggest."
          }}
        </p>

        <div v-if="props.item.analysis" class="grid grid-cols-3 gap-2 pt-1">
          <div class="rounded-xl bg-slate-50 px-3 py-2">
            <p
              class="text-[11px] font-medium uppercase tracking-wide text-slate-400"
            >
              Volume
            </p>
            <p class="mt-1 text-sm font-semibold text-slate-900">
              {{ props.item.analysis.volume }}
            </p>
          </div>

          <div class="rounded-xl bg-slate-50 px-3 py-2">
            <p
              class="text-[11px] font-medium uppercase tracking-wide text-slate-400"
            >
              Intention
            </p>
            <p class="mt-1 text-sm font-semibold text-slate-900">
              {{ formatKeywordIntent(props.item.analysis.intent) }}
            </p>
          </div>

          <div class="rounded-xl bg-slate-50 px-3 py-2">
            <p
              class="text-[11px] font-medium uppercase tracking-wide text-slate-400"
            >
              Difficulté
            </p>
            <p class="mt-1 text-sm font-semibold text-slate-900">
              {{ props.item.analysis.difficulty }}%
            </p>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <UButton
          v-if="props.item.canAnalyze"
          color="info"
          variant="soft"
          icon="i-lucide-chart-column-big"
          :loading="props.isAnalyzing"
          :disabled="props.isAnalyzing"
          :title="'Analyser le mot-clé'"
          @click="$emit('analyze', props.item.keyword)"
        />

        <UButton
          v-if="props.item.canAddToBase"
          color="neutral"
          variant="soft"
          icon="i-lucide-plus"
          :title="'Ajouter le mot-clé en base'"
          @click="$emit('addToBase', props.item.keyword)"
        />

        <UButton
          v-if="props.item.canAddToBaseAndFavorite"
          color="warning"
          variant="soft"
          icon="i-lucide-star"
          :title="'Ajouter le mot-clé en base et le mettre en favori'"
          @click="$emit('addToBaseAndFavorite', props.item.keyword)"
        />

        <NuxtLink
          :to="
            buildKeywordResearchUrl(props.item.keyword, {
              autorun: false,
              language: 'fr',
              country: 'fr',
            })
          "
          class="inline-flex whitespace-nowrap rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
        >
          {{ props.item.analysis ? "Voir l’analyse" : "Ouvrir" }}
        </NuxtLink>
      </div>
    </div>
  </article>
</template>
