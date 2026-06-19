<script setup lang="ts">
import {
  isProjectShopifyStoreNotLinkedError,
  isShopifyUnavailableError,
} from "~/utils/shopify-errors";

const { getBlogArticlesListPage } = useShopify();
const route = useRoute();
const router = useRouter();

const breadcrumbItems = [
  {
    label: "Shopify",
  },
  {
    label: "Articles",
  },
];

const pageSize = 20;

const pageOptions = computed(() => {
  if (typeof route.query.before === "string") {
    return {
      last: pageSize,
      before: route.query.before,
    };
  }

  return {
    first: pageSize,
    after:
      typeof route.query.after === "string" ? route.query.after : undefined,
  };
});

const {
  data: articlesPage,
  error,
  status,
} = await useAsyncData(
  "shopify-blog-articles",
  () => getBlogArticlesListPage(pageOptions.value),
  {
    watch: [pageOptions],
  },
);

const articles = computed(() => articlesPage.value?.items ?? []);
const pageInfo = computed(() => articlesPage.value?.pageInfo);
const showShopifyStoreNotice = computed(() =>
  isProjectShopifyStoreNotLinkedError(error.value) ||
    isShopifyUnavailableError(error.value),
);

function buildQuery(query: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined),
  );
}

function goNext() {
  if (!pageInfo.value?.hasNextPage || !pageInfo.value.endCursor) {
    return;
  }

  router.push({
    path: route.path,
    query: buildQuery({
      after: pageInfo.value.endCursor,
      before: undefined,
    }),
  });
}

function goPrevious() {
  if (!pageInfo.value?.hasPreviousPage || !pageInfo.value.startCursor) {
    return;
  }

  router.push({
    path: route.path,
    query: buildQuery({
      before: pageInfo.value.startCursor,
      after: undefined,
    }),
  });
}
</script>

<template>
  <section class="space-y-4">
    <UBreadcrumb :items="breadcrumbItems" />

    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-slate-900">
        Shopify Blog Articles
      </h1>
      <p class="text-sm text-slate-500">
        Liste paginée des articles de blogs récupérés depuis Shopify.
      </p>
    </header>

    <ShopifyStoreNotLinkedNotice :error="error" />
    <p v-if="status === 'pending'" class="text-sm text-slate-500">
      Chargement des articles Shopify...
    </p>

    <p
      v-else-if="error && !showShopifyStoreNotice"
      class="text-sm text-rose-600"
    >
      Impossible de charger les articles Shopify.
    </p>

    <template v-else-if="articles.length">
      <div class="flex items-center justify-between gap-3">
        <UButton
          color="neutral"
          variant="soft"
          :disabled="!pageInfo?.hasPreviousPage"
          @click="goPrevious"
        >
          Page précédente
        </UButton>

        <UButton
          color="neutral"
          variant="soft"
          :disabled="!pageInfo?.hasNextPage"
          @click="goNext"
        >
          Page suivante
        </UButton>
      </div>

      <ul
        class="list-disc space-y-3 rounded-2xl border border-slate-200 bg-white p-6 pl-10 shadow-sm"
      >
        <li
          v-for="article in articles"
          :key="article.id"
          class="space-y-1 text-sm text-slate-700"
        >
          <NuxtLink
            :to="`/shopify/articles/${encodeURIComponent(article.id)}`"
            class="font-medium text-slate-900 hover:text-sky-700"
          >
            {{ article.title }}
          </NuxtLink>
          <p class="text-xs text-slate-500">
            <!-- {{ article.blog.title }} ·  -->
            /blogs/{{ article.blog.handle }}/{{ article.handle }}
          </p>
        </li>
      </ul>
    </template>
  </section>
</template>
