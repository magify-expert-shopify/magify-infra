<script setup lang="ts">
import {
  blogArticleStatusIcons,
  blogArticleStatusLabels,
} from "~/constants/blog-articles";
import { useAppToast } from "~/composables/useAppToast";
import { useBlogArticles } from "~/composables/useBlogArticles";
import type { BlogArticle } from "~/types/domain";

const { createBlankBlogArticle } = useBlogArticles();
const { showErrorToast, showSuccessToast } = useAppToast();
const { request } = useApi();
const { currentProject } = useCurrentProject();
const isCreatingBlankArticle = ref(false);

const projectId = computed(() => currentProject.value?.id ?? "");

const {
  data: articles,
  error,
  status,
  refresh,
} = await useAsyncData(
  () => `blog-articles:${projectId.value || "no-project"}`,
  () =>
    request<BlogArticle[]>("/blog-articles", {
      query: {
        projectId: projectId.value,
      },
    }),
  {
    watch: [projectId],
  },
);

const breadcrumbItems = [
  {
    label: "Accueil",
    to: "/",
  },
  {
    label: "Articles",
  },
];

const articleStatusSortOrder: Array<BlogArticle["status"]> = [
  "DRAFT",
  "READY_TO_PUBLISH",
  "PUSHED",
  "PLANNED",
  "PUBLISHED",
  "ARCHIVED",
  "IDEA",
];

const articleStatusSortIndex = new Map(
  articleStatusSortOrder.map((status, index) => [status, index]),
);

const sortedArticles = computed(() =>
  [...(articles.value ?? [])].sort((left, right) => {
    const leftIndex = articleStatusSortIndex.get(left.status ?? "DRAFT") ?? 999;
    const rightIndex = articleStatusSortIndex.get(right.status ?? "DRAFT") ?? 999;

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return left.title.localeCompare(right.title, "fr", { sensitivity: "base" });
  }),
);

function isPublishedOrPushedArticleStatus(
  status?: BlogArticle["status"] | null,
) {
  return status === "PUSHED" || status === "PUBLISHED";
}

function getArticleStatusLinkClass(status?: BlogArticle["status"] | null) {
  if (status === "PUBLISHED") {
    return "text-emerald-700 hover:text-emerald-900 hover:underline";
  }

  if (status === "PLANNED") {
    return "text-violet-700 hover:text-violet-900 hover:underline";
  }

  if (status === "PUSHED") {
    return "text-amber-700 hover:text-amber-900 hover:underline";
  }

  return "hover:text-slate-900 hover:underline";
}

function getArticleStatusIcon(status?: BlogArticle["status"] | null) {
  return blogArticleStatusIcons[status ?? "DRAFT"];
}

function getArticleStatusLabel(status?: BlogArticle["status"] | null) {
  return blogArticleStatusLabels[status ?? "DRAFT"];
}

async function handleCreateBlankArticle() {
  if (!projectId.value || isCreatingBlankArticle.value) {
    return;
  }

  try {
    isCreatingBlankArticle.value = true;

    const article = await createBlankBlogArticle(projectId.value);

    showSuccessToast(
      "Article créé",
      "Un nouvel article vide a été créé pour le projet courant.",
    );

    await navigateTo(`/articles/${article.id}`);
  } catch (error) {
    showErrorToast(
      "Impossible de créer l'article",
      error instanceof Error
        ? error.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    isCreatingBlankArticle.value = false;
  }
}
</script>

<template>
  <section class="space-y-4">
    <UBreadcrumb :items="breadcrumbItems" class="text-slate-500" />

    <header class="space-y-1">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Rédaction
      </p>
      <h1 class="text-2xl font-semibold text-slate-900">
        Articles du projet courant
      </h1>
      <p class="text-sm text-slate-500">
        {{ currentProject?.name || "Aucun projet" }}
      </p>
    </header>

    <div class="flex flex-wrap gap-3">
      <UButton
        to="/articles/calendar"
        color="neutral"
        variant="soft"
        icon="i-lucide-calendar-days"
      >
        Voir le calendrier éditorial
      </UButton>

      <UButton
        color="primary"
        variant="solid"
        icon="i-lucide-file-plus"
        :loading="isCreatingBlankArticle"
        :disabled="!projectId"
        @click="handleCreateBlankArticle"
      >
        Créer un article vide
      </UButton>
    </div>

    <p v-if="status === 'pending'" class="text-sm text-slate-500">
      Chargement des articles...
    </p>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :details="error.toString()"
      title="Impossible de charger les articles"
      description="Les articles du projet courant n'ont pas pu être récupérés."
      action-label="Réessayer"
      @action="refresh"
    />

    <ul
      v-else-if="sortedArticles.length"
      class="space-y-2 pl-2 text-slate-700"
    >
      <li v-for="article in sortedArticles" :key="article.id">
        <NuxtLink
          :to="`/articles/${article.id}`"
          :class="[
            'inline-flex items-center gap-2',
            getArticleStatusLinkClass(article.status),
          ]"
        >
          <UIcon
            :name="getArticleStatusIcon(article.status)"
            class="h-4 w-4 shrink-0"
            :title="getArticleStatusLabel(article.status)"
          />
          <span>{{ article.title }}</span>
        </NuxtLink>
      </li>
    </ul>

    <p v-else class="text-sm text-slate-500">
      Aucun article n'est rattaché à ce projet pour le moment.
    </p>

    <div
      class="mt-10 rounded-2xl border border-sky-200 bg-sky-50/80 p-4 shadow-sm"
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
