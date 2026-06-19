<script setup lang="ts">
import {
  isProjectShopifyStoreNotLinkedError,
  isShopifyUnavailableError,
} from "~/utils/shopify-errors";

const { getBlogs } = useShopify();
const breadcrumbItems = [
  {
    label: "Shopify",
  },
  {
    label: "Blogs",
  },
];

const {
  data: blogs,
  error,
  status,
} = await useAsyncData("shopify-blogs", () => getBlogs());

const showShopifyStoreNotice = computed(() =>
  isProjectShopifyStoreNotLinkedError(error.value) ||
    isShopifyUnavailableError(error.value),
);
</script>

<template>
  <section class="space-y-4">
    <UBreadcrumb :items="breadcrumbItems" />

    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-slate-900">Shopify Blogs</h1>
      <p class="text-sm text-slate-500">
        Liste des blogs récupérés depuis Shopify.
      </p>
    </header>

    <ShopifyStoreNotLinkedNotice :error="error" />
    <p v-if="status === 'pending'" class="text-sm text-slate-500">
      Chargement des blogs Shopify...
    </p>

    <p
      v-else-if="error && !showShopifyStoreNotice"
      class="text-sm text-rose-600"
    >
      Impossible de charger les blogs Shopify.
    </p>

    <ul
      v-else-if="blogs?.length"
      class="list-disc space-y-3 rounded-2xl border border-slate-200 bg-white p-6 pl-10 shadow-sm"
    >
      <li
        v-for="blog in blogs ?? []"
        :key="blog.id"
        class="space-y-1 text-sm text-slate-700"
      >
        <NuxtLink
          :to="`/shopify/blogs/${encodeURIComponent(blog.id)}/articles`"
          class="font-medium text-slate-900 hover:text-sky-700"
        >
          {{ blog.title }}
        </NuxtLink>
        <p class="text-xs text-slate-500">/blogs/{{ blog.handle }}</p>
      </li>
    </ul>
  </section>
</template>
