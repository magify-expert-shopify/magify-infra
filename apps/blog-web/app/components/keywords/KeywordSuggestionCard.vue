<script setup lang="ts">
import { searchIntentLabels } from "~/constants/enums";
import type { SuggestedKeywordCard } from "~/types/keyword-search";
import { buildKeywordResearchUrl } from "~/utils/keyword-research-url";

const props = defineProps<{
  item: SuggestedKeywordCard;
  deletingKeywordId?: string | null;
}>();

defineEmits<{
  delete: [item: SuggestedKeywordCard];
  edit: [item: SuggestedKeywordCard];
  toggleFavorite: [item: SuggestedKeywordCard];
}>();

function getSearchIntentLabel(searchIntent?: string | null) {
  if (!searchIntent) {
    return "";
  }

  return (
    searchIntentLabels[searchIntent as keyof typeof searchIntentLabels] ??
    searchIntent
  );
}
</script>

<template>
  <article
    class="rounded-2xl border p-4 transition"
    :class="
      props.item.isAnalyzed
        ? 'border-emerald-200 bg-emerald-50/70'
        : 'border-slate-200 bg-slate-50/70'
    "
  >
    <div class="flex items-start justify-between gap-3">
      <div class="space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="font-medium text-left text-slate-900 underline decoration-transparent underline-offset-4 transition hover:decoration-slate-300"
            @click="$emit('edit', props.item)"
          >
            {{ props.item.keyword }}
          </button>
          <UBadge
            v-if="props.item.isAnalyzed"
            color="success"
            variant="soft"
          >
            Déjà analysé
          </UBadge>
          <UBadge
            v-if="props.item.searchIntent"
            color="neutral"
            variant="soft"
          >
            {{ getSearchIntentLabel(props.item.searchIntent) }}
          </UBadge>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <UButton
          v-if="props.item.globalKeywordId"
          color="warning"
          variant="ghost"
          class="group"
          :title="
            props.item.isFavorite
              ? 'Retirer des favoris'
              : 'Ajouter aux favoris'
          "
          @click="$emit('toggleFavorite', props.item)"
        >
          <span class="relative inline-flex h-5 w-5 items-center justify-center">
            <UIcon
              name="i-lucide-star"
              class="absolute h-5 w-5 transition-all"
              :class="
                props.item.isFavorite
                  ? 'text-amber-600 opacity-100 group-hover:opacity-0'
                  : 'text-amber-600 opacity-25 group-hover:opacity-60'
              "
            />
            <UIcon
              name="i-lucide-star-off"
              class="absolute h-5 w-5 text-amber-600 opacity-0 transition-all"
              :class="props.item.isFavorite ? 'group-hover:opacity-100' : ''"
            />
          </span>
        </UButton>

        <UButton
          v-if="props.item.globalKeywordId"
          color="neutral"
          variant="ghost"
          icon="i-lucide-trash-2"
          class="hover:bg-red-50 hover:text-red-600"
          :loading="props.deletingKeywordId === props.item.globalKeywordId"
          @click="$emit('delete', props.item)"
        />

        <NuxtLink
          :to="
            buildKeywordResearchUrl(props.item.keyword, {
              language: 'fr',
              country: 'fr',
            })
          "
          class="inline-flex whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium transition"
          :class="
            props.item.isAnalyzed
              ? 'border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
          "
        >
          {{ props.item.isAnalyzed ? "Voir l’analyse" : "Analyser" }}
        </NuxtLink>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <span
        v-for="problem in props.item.sourceProblems"
        :key="problem.id"
        class="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700"
      >
        {{ problem.title }}
      </span>
      <span
        v-if="!props.item.sourceProblems.length"
        class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
      >
        Mot-clé global
      </span>
    </div>
  </article>
</template>
