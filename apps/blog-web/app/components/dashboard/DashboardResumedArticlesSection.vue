<script setup lang="ts">
import { blogArticleStatusLabels } from "~/constants/blog-articles";
import type { BlogArticle } from "~/types/domain";

const props = defineProps<{
  articles: BlogArticle[];
}>();

const resumedEditingArticles = computed(() => props.articles.slice(0, 6));
</script>

<template>
  <section v-if="articles.length" class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-slate-900">
          Reprendre des articles commencés
        </h2>
        <p class="text-sm text-slate-500">
          Articles déjà touchés, mais pas encore terminés ni envoyés en visibilité finale.
        </p>
      </div>
      <UBadge color="neutral" variant="soft">
        {{ articles.length }}
      </UBadge>
    </div>

    <div class="mt-5 space-y-3">
      <NuxtLink
        v-for="article in resumedEditingArticles"
        :key="article.id"
        :to="`/articles/${article.id}`"
        class="block rounded-2xl border border-slate-200 px-4 py-4 transition hover:border-slate-300 hover:bg-slate-50"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 space-y-1">
            <p class="truncate font-medium text-slate-900">
              {{ article.title }}
            </p>
            <p class="text-sm text-slate-500">
              {{ article.cluster?.name || "Sans cluster" }}
            </p>
          </div>
          <UBadge color="neutral" variant="soft" class="shrink-0">
            {{ blogArticleStatusLabels[article.status] ?? "Brouillon" }}
          </UBadge>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>
