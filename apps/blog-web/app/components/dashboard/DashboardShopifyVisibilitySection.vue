<script setup lang="ts">
import type { BlogArticle } from "~/types/domain";

const props = defineProps<{
  articles: BlogArticle[];
}>();

const pushedWaitingVisibilityArticles = computed(() => props.articles.slice(0, 6));
</script>

<template>
  <section v-if="articles.length" class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-slate-900">
          Shopify en attente de visibilité
        </h2>
        <p class="text-sm text-slate-500">
          Articles déjà pushés vers Shopify, mais encore masqués.
        </p>
      </div>
      <UBadge color="info" variant="soft">
        {{ articles.length }}
      </UBadge>
    </div>

    <div class="mt-5 space-y-3">
      <NuxtLink
        v-for="article in pushedWaitingVisibilityArticles"
        :key="article.id"
        :to="`/articles/${article.id}`"
        class="block rounded-2xl border border-cyan-200 bg-cyan-50/40 px-4 py-4 transition hover:bg-cyan-50"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 space-y-1">
            <p class="truncate font-medium text-slate-900">
              {{ article.title }}
            </p>
            <p class="text-sm text-slate-600">
              {{ article.cluster?.name || "Sans cluster" }}
            </p>
          </div>
          <span class="text-xs font-medium uppercase tracking-wide text-cyan-700">
            Masqué
          </span>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>
