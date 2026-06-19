<script setup lang="ts">
import CustomElementHtmlRenderer from "~/components/content/CustomElementHtmlRenderer.vue";

const route = useRoute();
const { getArticle, pullArticle } = useShopify();

const articleId = computed(() => String(route.params.id ?? ""));
const isPullingArticle = ref(false);
const pullErrorMessage = ref<string | null>(null);

const {
  data: article,
  error,
  status,
  refresh,
} = await useAsyncData(
  () => `shopify-article-${articleId.value}`,
  () => getArticle(articleId.value),
  {
    watch: [articleId],
  },
);

const breadcrumbItems = computed(() => {
  const items = [
    {
      label: "Shopify",
    },
    {
      label: "Blogs",
      to: "/shopify/blogs",
    },
  ];

  if (article.value?.blog) {
    items.push({
      label: article.value.blog.title,
      to: `/shopify/blogs/${encodeURIComponent(article.value.blog.id)}/articles`,
    });
  }

  items.push({
    label: article.value?.title || "Article Shopify",
  });

  return items;
});

async function handlePullArticle() {
  if (!article.value || isPullingArticle.value) {
    return;
  }

  pullErrorMessage.value = null;
  isPullingArticle.value = true;

  try {
    await pullArticle(article.value.id);
    await refresh();
  } catch (error) {
    pullErrorMessage.value =
      error instanceof Error
        ? error.message
        : "Impossible de puller l’article Shopify.";
  } finally {
    isPullingArticle.value = false;
  }
}
</script>

<template>
  <section class="space-y-6">
    <UBreadcrumb :items="breadcrumbItems" />

    <header
      class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
    >
      <div class="space-y-2">
        <p v-if="article?.blog" class="text-sm text-slate-500">
          {{ article.blog.title }}
        </p>
        <h1 class="text-3xl font-semibold text-slate-900">
          {{ article?.title || "Article Shopify" }}
        </h1>
        <p v-if="article?.publishedAt" class="text-sm text-slate-500">
          {{ article.publishedAt }}
        </p>
      </div>

      <div
        v-if="article"
        class="flex w-full flex-col items-stretch gap-2 lg:w-auto lg:min-w-[16rem]"
      >
        <UButton
          v-if="article.associatedBlogArticle"
          color="neutral"
          variant="soft"
          icon="i-lucide-file-pen-line"
          @click="navigateTo(`/articles/${article.associatedBlogArticle.id}`)"
        >
          Ouvrir l’article local
        </UButton>

        <UButton
          v-else
          icon="i-lucide-download"
          :loading="isPullingArticle"
          @click="handlePullArticle"
        >
          Puller l’article
        </UButton>

        <p
          v-if="article.associatedBlogArticle"
          class="text-xs leading-5 text-emerald-700"
        >
          Associé à l’article local "{{ article.associatedBlogArticle.title }}".
        </p>

        <p v-else class="text-xs leading-5 text-slate-500">
          Aucun article local n’est encore associé à cet article Shopify.
        </p>

        <p v-if="pullErrorMessage" class="text-xs leading-5 text-rose-600">
          {{ pullErrorMessage }}
        </p>
      </div>
    </header>

    <p v-if="status === 'pending'" class="text-sm text-slate-500">
      Chargement de l’article Shopify...
    </p>

    <p v-else-if="error" class="text-sm text-rose-600">
      Impossible de charger l’article Shopify.
    </p>

    <div
      v-else
      class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <p v-if="article?.summary" class="mb-6 text-sm leading-6 text-slate-500">
        <span v-html="article.summary" />
      </p>

      <CustomElementHtmlRenderer
        :html="article?.body"
        fallback-html="<p>Aucun contenu disponible.</p>"
        content-class="shopify-article-preview prose prose-slate max-w-none"
      />

      <div
        v-if="article?.tags?.length"
        class="mt-8 border-t border-slate-200 pt-6"
      >
        <p class="mb-3 text-sm font-medium text-slate-700">Tags</p>
        <ul class="flex flex-wrap gap-2">
          <li v-for="tag in article.tags" :key="tag">
            <UBadge
              variant="soft"
              color="neutral"
              class="rounded-full px-3 py-1 text-xs"
            >
              {{ tag }}
            </UBadge>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.shopify-article-preview :deep(h1),
.shopify-article-preview :deep(h2),
.shopify-article-preview :deep(h3),
.shopify-article-preview :deep(h4),
.shopify-article-preview :deep(h5),
.shopify-article-preview :deep(h6) {
  color: #0f172a;
  font-weight: 600;
}

.shopify-article-preview :deep(p),
.shopify-article-preview :deep(li) {
  color: #334155;
  line-height: 1.75;
}

.shopify-article-preview :deep(ul) {
  list-style: disc;
  padding-left: 1.5rem;
}

.shopify-article-preview :deep(ol) {
  list-style: decimal;
  padding-left: 1.5rem;
}

.shopify-article-preview :deep(a) {
  color: #0369a1;
  text-decoration: underline;
}

.shopify-article-preview :deep(img) {
  border-radius: 1rem;
}
</style>
