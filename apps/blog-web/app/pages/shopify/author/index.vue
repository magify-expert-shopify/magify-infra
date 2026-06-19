<script setup lang="ts">
import { getShopifyAuthorDisplayName } from "~/utils/shopify-authors";
import {
  isProjectShopifyStoreNotLinkedError,
  isShopifyUnavailableError,
} from "~/utils/shopify-errors";

const { getAuthorMetaobjects } = useShopify();

const breadcrumbItems = [
  {
    label: "Shopify",
  },
  {
    label: "Authors",
  },
];

const {
  data: authors,
  error,
  status,
} = await useAsyncData("shopify-author-metaobjects", () =>
  getAuthorMetaobjects(),
);

const showShopifyStoreNotice = computed(() =>
  isProjectShopifyStoreNotLinkedError(error.value) ||
    isShopifyUnavailableError(error.value),
);
</script>

<template>
  <section class="space-y-4">
    <UBreadcrumb :items="breadcrumbItems" />

    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-slate-900">Shopify Authors</h1>
      <p class="text-sm text-slate-500">
        Liste des métaobjects Shopify de type <code>author</code>.
      </p>
    </header>

    <ShopifyStoreNotLinkedNotice :error="error" />
    <p v-if="status === 'pending'" class="text-sm text-slate-500">
      Chargement des auteurs Shopify...
    </p>

    <p
      v-else-if="error && !showShopifyStoreNotice"
      class="text-sm text-rose-600"
    >
      Impossible de charger les auteurs Shopify.
    </p>

    <ul
      v-else-if="authors?.length"
      class="list-disc space-y-3 rounded-2xl border border-slate-200 bg-white p-6 pl-10 shadow-sm"
    >
      <li
        v-for="author in authors ?? []"
        :key="author.id"
        class="space-y-1 text-sm text-slate-700"
      >
        <NuxtLink
          :to="`/shopify/author/${encodeURIComponent(author.id)}`"
          class="font-medium text-slate-900 transition hover:text-sky-700"
        >
          {{ getShopifyAuthorDisplayName(author) }}
        </NuxtLink>
        <p class="text-xs text-slate-500">@{{ author.handle }}</p>
      </li>
    </ul>
  </section>
</template>
