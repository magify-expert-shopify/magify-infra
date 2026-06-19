<script setup lang="ts">
import { keywordLengthTypeLabels, searchIntentLabels } from "~/constants/enums";
import { defaultKeywordDifficultyLevels } from "~/constants/keyword-difficulty";
import { pageTypeLabels } from "~/constants/pages";
import type { KeywordDifficultyLevel } from "~/types/settings";
import type { KeywordPageType, KeywordRecord } from "~/types/keywords";
import { getKeywordDifficultyLabel } from "~/utils/keyword-difficulty";
import { buildKeywordResearchUrl } from "~/utils/keyword-research-url";

const props = withDefaults(
  defineProps<{
    keywords: KeywordRecord[];
    loading?: boolean;
    error?: unknown;
    pageTypeOptions: Array<{ value: KeywordPageType; label: string }>;
    keywordDifficultyLevels?: KeywordDifficultyLevel[];
    selectedTemplates: Record<string, KeywordPageType | "">;
    savingKeywordId?: string | null;
  }>(),
  {
    loading: false,
    error: null,
    keywordDifficultyLevels: () => defaultKeywordDifficultyLevels,
    selectedTemplates: () => ({}),
    savingKeywordId: null,
  },
);

const emit = defineEmits<{
  refresh: [];
  "update-template": [keywordId: string, value: KeywordPageType | ""];
  "assign-template": [keyword: KeywordRecord];
}>();

const hasKeywords = computed(() => props.keywords.length > 0);
const favoriteKeywordCards = computed(() => props.keywords.slice(0, 8));
const errorDetails = computed(() =>
  props.error instanceof Error
    ? props.error.toString()
    : props.error
      ? String(props.error)
      : undefined,
);

function getFavoriteKeywordTemplateValue(keyword: KeywordRecord) {
  return props.selectedTemplates[keyword.id] ?? keyword.page?.pageType ?? "";
}
</script>

<template>
  <section v-if="loading || error || hasKeywords" class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-slate-900">
          Mots-clés favoris
        </h2>
        <p class="text-sm text-slate-500">
          Priorise les favoris avec le plus de volume, analyse ceux qui manquent de données et associe un template quand aucune page n’est encore liée.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <UBadge color="warning" variant="soft">
          {{ keywords.length }}
        </UBadge>

        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-rotate-ccw"
          :loading="loading"
          @click="$emit('refresh')"
        >
          Rafraîchir
        </UButton>
      </div>
    </div>

    <FeedbackInlineMessage v-if="loading" class="mt-5 animate-pulse">
      Chargement des mots-clés favoris...
    </FeedbackInlineMessage>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      title="Impossible de charger les mots-clés favoris"
      description="La section des favoris n'a pas pu être récupérée."
      :details="errorDetails"
      action-label="Réessayer"
      class="mt-5"
      @action="$emit('refresh')"
    />

    <div
      v-else-if="!hasKeywords"
      class="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500"
    >
      Aucun mot-clé favori pour le moment.
    </div>

    <div v-else class="mt-5 grid gap-4 xl:grid-cols-2">
      <article
        v-for="keyword in favoriteKeywordCards"
        :key="keyword.id"
        class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-medium text-slate-900">
                {{ keyword.keyword }}
              </p>
              <UBadge color="warning" variant="soft">
                Favori
              </UBadge>
              <UBadge v-if="keyword.searchIntent" color="neutral" variant="soft">
                {{ searchIntentLabels[keyword.searchIntent] }}
              </UBadge>
            </div>

            <div class="flex flex-wrap gap-2 text-sm text-slate-500">
              <span>Volume: {{ keyword.volume ?? "-" }}</span>
              <span>
                Difficulté: {{ keyword.difficulty ?? "-" }}
                <template v-if="keyword.difficulty !== null">
                  ·
                  {{ getKeywordDifficultyLabel(keyword.difficulty, keywordDifficultyLevels) }}
                </template>
              </span>
              <span>
                Longueur:
                {{
                  keyword.lengthType
                    ? keywordLengthTypeLabels[keyword.lengthType]
                    : "-"
                }}
              </span>
            </div>
          </div>

          <UBadge
            :color="keyword.lastScannedAt ? 'success' : 'neutral'"
            variant="soft"
          >
            {{ keyword.lastScannedAt ? "Analysé" : "À analyser" }}
          </UBadge>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-3">
          <NuxtLink
            v-if="!keyword.lastScannedAt"
            :to="
              buildKeywordResearchUrl(keyword.keyword, {
                language: 'fr',
                country: 'fr',
                autorun: false,
              })
            "
            class="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
          >
            <UIcon name="i-lucide-scan-search" class="h-4 w-4" />
            Analyser
          </NuxtLink>

          <NuxtLink
            v-else
            :to="
              buildKeywordResearchUrl(keyword.keyword, {
                language: 'fr',
                country: 'fr',
                autorun: false,
              })
            "
            class="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
          >
            <UIcon name="i-lucide-chart-column-big" class="h-4 w-4" />
            Voir l’analyse
          </NuxtLink>

          <template v-if="keyword.lastScannedAt && !keyword.page">
            <select
              :value="getFavoriteKeywordTemplateValue(keyword)"
              class="min-w-52 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              @change="
                $emit(
                  'update-template',
                  keyword.id,
                  ($event.target as HTMLSelectElement).value as KeywordPageType | '',
                )
              "
            >
              <option value="">
                Associer un template...
              </option>
              <option
                v-for="option in pageTypeOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>

            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-file-plus-2"
              :loading="savingKeywordId === keyword.id"
              :disabled="!getFavoriteKeywordTemplateValue(keyword)"
              @click="$emit('assign-template', keyword)"
            >
              Associer
            </UButton>
          </template>

          <span
            v-else-if="!keyword.lastScannedAt"
            class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500"
          >
            <UIcon name="i-lucide-lock" class="h-4 w-4" />
            Analyse requise avant le template
          </span>

          <NuxtLink
            v-else
            to="/templates"
            class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <UIcon name="i-lucide-file-text" class="h-4 w-4" />
            {{ pageTypeLabels[keyword.page.pageType] }}
          </NuxtLink>
        </div>
      </article>
    </div>
  </section>
</template>
