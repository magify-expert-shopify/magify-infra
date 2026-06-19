<script setup lang="ts">
const route = useRoute();
const { getBlogArticles } = useShopify();

const blogId = computed(() => String(route.params.id ?? ""));

const {
  data: articles,
  error,
  status,
} = await useAsyncData(
  () => `shopify-blog-articles-${blogId.value}`,
  () => getBlogArticles(blogId.value),
  {
    watch: [blogId],
  },
);

const blogTitle = computed(() => articles.value?.[0]?.blog.title ?? "Blog");
const breadcrumbItems = computed(() => [
  {
    label: "Shopify",
  },
  {
    label: "Blogs",
    to: "/shopify/blogs",
  },
  {
    label: blogTitle.value,
  },
]);
</script>

<template>
  <section class="space-y-4">
    <UBreadcrumb :items="breadcrumbItems" />

    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-slate-900">
        Articles du blog {{ blogTitle }}
      </h1>
      <p class="text-sm text-slate-500">
        Liste des articles liés au blog Shopify sélectionné.
      </p>
    </header>

    <p v-if="status === 'pending'" class="text-sm text-slate-500">
      Chargement des articles du blog...
    </p>

    <p v-else-if="error" class="text-sm text-rose-600">
      Impossible de charger les articles de ce blog Shopify.
    </p>

    <ul
      v-else
      class="list-disc space-y-3 rounded-2xl border border-slate-200 bg-white p-6 pl-10 shadow-sm"
    >
      <li
        v-for="article in articles ?? []"
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
          {{ article.handle }}
        </p>
      </li>
    </ul>
  </section>
</template>
