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
  pillarArticleId?: string | null;
  unassigningArticleId?: string | null;
}>();

const emit = defineEmits<{
  "add-ideas": [];
  remove: [article: BlogArticle];
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
    const leftOrder =
      orderByStatus.get(left.status ?? "") ?? Number.MAX_SAFE_INTEGER;
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
    <div class="flex items-center justify-between gap-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Articles
      </p>

      <UButton
        color="neutral"
        variant="soft"
        size="sm"
        icon="i-lucide-plus"
        @click="emit('add-ideas')"
      >
        Ajouter
        <!-- depuis les idées -->
      </UButton>
    </div>

    <ul v-if="articles.length" class="mt-4 space-y-2">
      <li
        v-for="article in sortedArticles"
        :key="article.id"
        class="relative rounded-2xl border px-4 py-3"
        :class="
          pillarArticleId === article.id
            ? `ring-1 ring-violet-200 ${article.status ? blogArticleStatusCardClasses[article.status] : 'border-slate-200 bg-slate-50'} border-violet-300`
            : article.status
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

            <p class="min-w-0 text-sm font-medium text-slate-900">
              {{ article.title }}
            </p>
          </div>

          <div class="relative z-10 flex items-center gap-2">
            <UBadge
              v-if="pillarArticleId === article.id"
              variant="soft"
              color="primary"
              class="rounded-full border border-violet-300"
            >
              Pilier
            </UBadge>

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

            <button
              type="button"
              class="rounded-full p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
              :disabled="unassigningArticleId === article.id"
              @click="emit('remove', article)"
            >
              <UIcon
                :name="
                  unassigningArticleId === article.id
                    ? 'i-lucide-loader-circle'
                    : 'i-lucide-unlink-2'
                "
                class="h-4 w-4"
                :class="{
                  'animate-spin': unassigningArticleId === article.id,
                }"
              />
            </button>
          </div>
        </div>
      </li>
    </ul>

    <p v-else class="mt-4 text-sm text-slate-500">
      Aucun article associé à ce cluster pour le moment.
    </p>
  </div>
</template>
