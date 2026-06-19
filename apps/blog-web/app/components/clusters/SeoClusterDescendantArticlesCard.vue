<script setup lang="ts">
import {
  blogArticleStatusActionIconClasses,
  blogArticleStatusCardClasses,
  blogArticleStatusIcons,
  blogArticleStatusIconBadgeClasses,
  blogArticleStatusLabels,
} from "~/constants/blog-articles";
import type { BlogArticle } from "~/types/domain";

const props = defineProps<{
  articles: BlogArticle[];
}>();

const blogArticleStatusSortOrder = [
  "READY_TO_PUBLISH",
  "DRAFT",
  "IDEA",
  "PLANNED",
  "PUSHED",
  "PUBLISHED",
  "ARCHIVED",
] as const;

const sortedArticles = computed(() => {
  const orderByStatus = new Map(
    blogArticleStatusSortOrder.map((status, index) => [status, index]),
  );

  return [...props.articles].sort((left, right) => {
    const leftOrder = orderByStatus.get(left.status ?? "") ?? Number.MAX_SAFE_INTEGER;
    const rightOrder =
      orderByStatus.get(right.status ?? "") ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.title.localeCompare(right.title, "fr");
  });
});
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
      Articles des sous-clusters
    </p>

    <ul
      v-if="articles.length"
      class="mt-4 space-y-2"
    >
      <li
        v-for="article in sortedArticles"
        :key="article.id"
        class="relative rounded-2xl border px-4 py-3"
        :class="
          article.status
            ? blogArticleStatusCardClasses[article.status]
            : 'border-slate-200 bg-slate-50'
        "
      >
        <NuxtLink
          :to="`/articles/${article.id}`"
          class="absolute inset-0 rounded-2xl"
          :aria-label="`Ouvrir l’article ${article.title}`"
        />

        <div class="flex items-center justify-between gap-3">
          <div class="relative z-10 flex min-w-0 items-center gap-3">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset"
              :class="
                article.status
                  ? blogArticleStatusIconBadgeClasses[article.status]
                  : 'bg-slate-50 text-slate-700 ring-slate-100'
              "
            >
              <UIcon name="i-lucide-file-text" class="h-5 w-5" />
            </span>

            <div class="min-w-0">
              <p class="text-sm font-medium text-slate-900">
                {{ article.title }}
              </p>
              <p
                v-if="article.cluster?.name"
                class="mt-1 text-xs text-slate-500"
              >
                {{ article.cluster.name }}
              </p>
            </div>
          </div>

          <div class="relative z-10">
            <UTooltip
              v-if="article.status"
              :text="blogArticleStatusLabels[article.status]"
            >
              <span
                class="inline-flex h-9 w-9 items-center justify-center rounded-full border"
                :class="blogArticleStatusActionIconClasses[article.status]"
              >
                <UIcon
                  :name="blogArticleStatusIcons[article.status]"
                  class="h-4 w-4"
                />
              </span>
            </UTooltip>
          </div>
        </div>
      </li>
    </ul>

    <p v-else class="mt-4 text-sm text-slate-500">
      Aucun article trouvé dans les sous-clusters.
    </p>
  </div>
</template>
