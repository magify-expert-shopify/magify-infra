<script setup lang="ts">
import KeywordGroupSuggestionsGrid from "~/components/suggestions/KeywordGroupSuggestionsGrid.vue";
import type { KeywordGroupSuggestionRecord } from "~/types/keywords";

const props = withDefaults(
  defineProps<{
    suggestions: KeywordGroupSuggestionRecord[];
    loading?: boolean;
    error?: unknown;
    currentUserId?: string | null;
    title?: string;
    description?: string;
    seeAllTo?: string;
    seeAllLabel?: string;
    previewCount?: number;
    emptyMessage?: string;
    loadingMessage?: string;
    errorTitle?: string;
    errorDescription?: string;
  }>(),
  {
    title: "Suggestions de création de contenu",
    description:
      "Groupes contenant au moins un mot-clé éditorial sans page associée.",
    seeAllTo: "/suggestions",
    seeAllLabel: "Voir tout",
    previewCount: 3,
    emptyMessage: "Aucune suggestion de création de contenu pour le moment.",
    loadingMessage: "Chargement des suggestions de contenu...",
    errorTitle: "Impossible de charger les suggestions de contenu",
    errorDescription: "Les suggestions n'ont pas pu être récupérées.",
  },
);

defineEmits<{
  refresh: [];
}>();

const hasSuggestions = computed(() => props.suggestions.length > 0);
const previewSuggestions = computed(() =>
  props.suggestions.slice(0, props.previewCount),
);
const hasMoreSuggestions = computed(
  () => props.suggestions.length > props.previewCount,
);
const errorDetails = computed(() =>
  props.error instanceof Error
    ? props.error.toString()
    : props.error
      ? String(props.error)
      : undefined,
);
</script>

<template>
  <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-slate-900">
          {{ title }}
        </h2>
        <p class="text-sm text-slate-500">
          {{ description }}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <UBadge color="info" variant="soft">
          {{ suggestions.length }}
        </UBadge>

        <UButton
          :to="seeAllTo"
          color="neutral"
          variant="soft"
          icon="i-lucide-search"
        >
          {{ seeAllLabel }}
        </UButton>

        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-rotate-ccw"
          :loading="loading"
          @click="$emit('refresh')"
        >
          <!-- Rafraîchir -->
        </UButton>
      </div>
    </div>

    <FeedbackInlineMessage v-if="loading" class="mt-5 animate-pulse">
      {{ loadingMessage }}
    </FeedbackInlineMessage>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :title="errorTitle"
      :description="errorDescription"
      :details="errorDetails"
      action-label="Réessayer"
      class="mt-5"
      @action="$emit('refresh')"
    />

    <div
      v-else-if="!hasSuggestions"
      class="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500"
    >
      {{ emptyMessage }}
    </div>

  <div v-else class="mt-5">
      <KeywordGroupSuggestionsGrid
        :suggestions="previewSuggestions"
        :current-user-id="currentUserId"
      />

      <FeedbackInlineMessage v-if="hasMoreSuggestions" class="mt-4" tone="info">
        Il existe d’autres suggestions. Consulte la page dédiée pour tout
        parcourir.
      </FeedbackInlineMessage>
    </div>
  </section>
</template>
