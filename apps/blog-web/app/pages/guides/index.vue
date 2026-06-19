<script setup lang="ts">
import { pageTypeLabels } from "~/constants/pages";
import type { PageListRecord } from "~/types/pages";

const { listPages } = usePages();

const {
  data: pages,
  error,
  status,
  refresh,
} = await useAsyncData("guides:pages", () => listPages(), {
  default: () => [],
});

const breadcrumbItems = [
  {
    label: "Accueil",
    to: "/",
  },
  {
    label: "Guides",
  },
];

const filteredPages = computed(() =>
  (pages.value ?? [])
    .filter((page) => page.pageType === "GUIDE")
    .sort((left, right) =>
      left.title.localeCompare(right.title, "fr", { sensitivity: "base" }),
    ),
);

function buildKeywordsCountLabel(page: PageListRecord) {
  return `${page._count?.keywords ?? 0} mot-clé(s)`;
}
</script>

<template>
  <section class="space-y-6">
    <UBreadcrumb :items="breadcrumbItems" class="text-slate-500" />

    <header class="space-y-1">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Rédaction
      </p>
      <h1 class="text-2xl font-semibold text-slate-900">
        Guides du projet courant
      </h1>
      <p class="text-sm text-slate-500">
        Liste des pages de type guide rattachées au projet courant.
      </p>
    </header>

    <p v-if="status === 'pending'" class="text-sm text-slate-500">
      Chargement des guides...
    </p>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :details="error.toString()"
      title="Impossible de charger les guides"
      description="Les pages de type guide n’ont pas pu être récupérées."
      action-label="Réessayer"
      @action="refresh"
    />

    <ul v-else-if="filteredPages.length" class="space-y-2 pl-2 text-slate-700">
      <li v-for="page in filteredPages" :key="page.id">
        <NuxtLink
          :to="`/pages/${page.id}`"
          class="inline-flex items-center gap-2 hover:underline hover:text-slate-900"
        >
          <span class="font-medium">{{ page.title }}</span>
          <UBadge color="neutral" variant="soft">
            {{ pageTypeLabels[page.pageType] }}
          </UBadge>
          <span class="text-sm text-slate-500">
            {{ buildKeywordsCountLabel(page) }}
          </span>
        </NuxtLink>
      </li>
    </ul>

    <p v-else class="text-sm text-slate-500">
      Aucune page de type guide n'est rattachée à ce projet pour le moment.
    </p>

    <div class="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 shadow-sm">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="space-y-1">
          <p class="text-sm font-semibold text-sky-950">
            Besoin d'idées pour les prochains contenus ?
          </p>
          <p class="text-sm text-sky-800/80">
            Consulte la page des suggestions de guides pour repérer rapidement
            les opportunités à rédiger.
          </p>
        </div>

        <UButton
          to="/suggestions/guides"
          color="primary"
          variant="solid"
          icon="i-lucide-lightbulb"
        >
          Voir les suggestions de guides
        </UButton>
      </div>
    </div>
  </section>
</template>
