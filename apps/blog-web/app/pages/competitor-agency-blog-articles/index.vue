<script setup lang="ts">
import BlogArticlesTable from '~/components/tables/BlogArticlesTable.vue';

const {
  useBlogArticlesList,
  refreshBlogArticle,
  refreshBlogArticles,
  deleteBlogArticle,
} = useBlogArticles();
const refreshingArticleIds = ref<Set<string>>(new Set());
const deletingArticleId = ref<string | null>(null);
const isScanningAllArticles = ref(false);

const {
  data: blogArticles,
  error,
  status,
} = await useBlogArticlesList();

const isInitialLoading = computed(
  () => status.value === "pending" && !(blogArticles.value?.length ?? 0),
);

async function rescanArticle(id: string) {
  if (refreshingArticleIds.value.has(id)) {
    return;
  }

  refreshingArticleIds.value = new Set(refreshingArticleIds.value).add(id);

  try {
    const response = await refreshBlogArticle(id);

    if (blogArticles.value) {
      blogArticles.value = blogArticles.value.map((article) =>
        article.id === id ? response.article : article,
      );
    }
  } finally {
    const nextRefreshingArticleIds = new Set(refreshingArticleIds.value);
    nextRefreshingArticleIds.delete(id);
    refreshingArticleIds.value = nextRefreshingArticleIds;
  }
}

async function rescanAllArticles() {
  if (isScanningAllArticles.value || !blogArticles.value?.length) {
    return;
  }

  isScanningAllArticles.value = true;

  try {
    await refreshBlogArticles(
      blogArticles.value.map((article) => article.id),
      "async",
    );
  } finally {
    isScanningAllArticles.value = false;
  }
}

async function removeArticle(id: string) {
  if (deletingArticleId.value) {
    return;
  }

  deletingArticleId.value = id;

  try {
    await deleteBlogArticle(id);

    if (blogArticles.value) {
      blogArticles.value = blogArticles.value.filter(
        (article) => article.id !== id,
      );
    }
  } finally {
    deletingArticleId.value = null;
  }
}
</script>

<template>
  <section class="space-y-4">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-slate-900">Blog Articles</h1>
      <p class="text-sm text-slate-500">
        Liste des articles de blogs recuperes depuis l'API.
      </p>
    </header>

    <div class="flex items-center justify-end">
      <UButton
        color="neutral"
        variant="soft"
        :loading="isScanningAllArticles"
        :disabled="isScanningAllArticles || !(blogArticles?.length ?? 0)"
        @click="rescanAllArticles"
      >
        {{ isScanningAllArticles ? "Scan en cours..." : "Scanner tout" }}
      </UButton>
    </div>

    <FeedbackLoadingMessage v-if="isInitialLoading">
      Chargement des articles...
    </FeedbackLoadingMessage>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :details="error.toString()"
      title="Impossible de charger les articles"
      description="Les articles concurrents n'ont pas pu être récupérés."
    />

    <BlogArticlesTable
      v-else
      :articles="blogArticles ?? []"
      :refreshing-article-ids="refreshingArticleIds"
      :deleting-article-id="deletingArticleId"
      @rescan="rescanArticle"
      @delete="removeArticle"
    />
  </section>
</template>
