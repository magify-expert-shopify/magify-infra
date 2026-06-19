<script setup lang="ts">
import { pageTypeLabels, seoRoleLabels } from "~/constants/pages";
import ContentSuggestionsSection from "~/components/suggestions/ContentSuggestionsSection.vue";
import type { PageListRecord } from "~/types/pages";

const { listPages } = usePages();
const { listSuggestions } = useKeywords();
const { user } = useSupabaseAuth();
const {
  data: pages,
  status,
  error,
  refresh,
} = await useAsyncData("pages:list", () => listPages(), {
  default: () => [],
});
const {
  data: suggestions,
  status: suggestionsStatus,
  error: suggestionsError,
  refresh: refreshSuggestions,
} = await useAsyncData(
  "pages:suggestions",
  () => listSuggestions(),
  {
    default: () => [],
  },
);

const hidePagesAssignedToOthers = ref(true);
const currentUserId = computed(() => user.value?.id ?? null);

function normalizeUserId(userId?: string | null) {
  return userId?.trim() ?? "";
}

function isAssignedToCurrentUser(page: PageListRecord) {
  const assigneeId = normalizeUserId(page.assignedSupabaseUserId);
  const userId = normalizeUserId(currentUserId.value);

  return Boolean(assigneeId && userId && assigneeId === userId);
}

function isAssignedToAnotherUser(page: PageListRecord) {
  const assigneeId = normalizeUserId(page.assignedSupabaseUserId);

  return Boolean(assigneeId) && !isAssignedToCurrentUser(page);
}

const filteredPages = computed(() =>
  (pages.value ?? []).filter((page) => {
    if (!hidePagesAssignedToOthers.value) {
      return true;
    }

    return !isAssignedToAnotherUser(page);
  }),
);

const hasPages = computed(() => filteredPages.value.length > 0);
const hasAnyPages = computed(() => (pages.value?.length ?? 0) > 0);
const breadcrumbItems = [
  {
    label: "Accueil",
    to: "/",
  },
  {
    label: "Pages",
  },
];

function buildKeywordsCountLabel(page: PageListRecord) {
  return `${page._count?.keywords ?? 0} mot-clé(s)`;
}
</script>

<template>
  <section class="space-y-6">
    <UBreadcrumb :items="breadcrumbItems" class="text-slate-500" />

    <header class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900">
          Pages
        </h1>
        <p class="text-sm text-slate-500">
          Liste des pages créées à partir des mots-clés et des suggestions.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <UButton
          to="/pages/add"
          color="primary"
          variant="solid"
          icon="i-lucide-file-plus-2"
        >
          Créer une page
        </UButton>

        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-rotate-ccw"
          :loading="status === 'pending'"
          @click="refresh()"
        >
          <!-- Rafraîchir -->
        </UButton>
      </div>
    </header>

    <FeedbackInlineMessage
      v-if="status === 'pending' && !hasPages"
      class="animate-pulse"
      tone="info"
    >
      Chargement des pages...
    </FeedbackInlineMessage>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :details="error.toString()"
      title="Impossible de charger les pages"
      description="La liste des pages n’a pas pu être récupérée."
      action-label="Réessayer"
      @action="refresh()"
    />

    <div
      v-else-if="hasAnyPages"
      class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
    >
      <USwitch
        v-model="hidePagesAssignedToOthers"
        color="primary"
      />
      <div class="space-y-0.5">
        <p class="text-sm font-medium text-slate-900">
          Cacher les pages associées aux autres
        </p>
        <p class="text-xs text-slate-500">
          Actif par défaut pour garder seulement les pages non assignées ou les miennes.
        </p>
      </div>
    </div>

    <div v-if="hasPages" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="page in filteredPages"
        :key="page.id"
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1">
              <NuxtLink
                :to="`/pages/${page.id}`"
                class="text-lg font-semibold text-slate-900 underline decoration-transparent underline-offset-4 transition hover:decoration-slate-300"
              >
                Page {{ page.title }}
              </NuxtLink>

              <div class="flex flex-wrap items-center gap-2">
                <UBadge color="neutral" variant="soft">
                  {{ pageTypeLabels[page.pageType] }}
                </UBadge>
                <UBadge color="info" variant="soft">
                  {{ seoRoleLabels[page.seoRole] }}
                </UBadge>
                <UBadge color="neutral" variant="soft">
                  {{ buildKeywordsCountLabel(page) }}
                </UBadge>
              </div>
            </div>

            <UButton
              :to="`/pages/${page.id}`"
              color="neutral"
              variant="soft"
              icon="i-lucide-arrow-right"
              size="sm"
            >
              Ouvrir
            </UButton>
          </div>

          <p v-if="page.cluster" class="text-sm text-slate-500">
            Cluster :
            <span class="font-medium text-slate-900">
              {{ page.cluster.name }}
            </span>
          </p>

          <p class="break-all text-sm text-slate-600">
            {{ page.url }}
          </p>
        </div>
      </article>
    </div>

    <FeedbackInlineMessage v-else-if="hasAnyPages" tone="info">
      Aucune page ne correspond à ce filtre.
    </FeedbackInlineMessage>

    <ContentSuggestionsSection
      v-else
      :suggestions="suggestions ?? []"
      :loading="suggestionsStatus === 'pending'"
      :error="suggestionsError"
      :current-user-id="currentUserId"
      title="Suggestions de création de contenu"
      description="On n’a pas encore de page créée, mais certains groupes de mots-clés sont déjà prêts à devenir des contenus éditoriaux."
      see-all-to="/suggestions"
      see-all-label="Voir toutes les suggestions"
      empty-message="Recherche des suggestions..."
      :preview-count="3"
      @refresh="refreshSuggestions()"
    />

    <div
      class="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 shadow-sm"
    >
      <div
        class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="space-y-1">
          <p class="text-sm font-semibold text-sky-950">
            Besoin d'idées pour les prochains contenus ?
          </p>
          <p class="text-sm text-sky-800/80">
            Consulte la page des suggestions d’articles pour repérer
            rapidement les opportunités à rédiger.
          </p>
        </div>

        <UButton
          to="/suggestions/articles"
          color="primary"
          variant="solid"
          icon="i-lucide-lightbulb"
        >
          Voir les suggestions
        </UButton>
      </div>
    </div>
  </section>
</template>
