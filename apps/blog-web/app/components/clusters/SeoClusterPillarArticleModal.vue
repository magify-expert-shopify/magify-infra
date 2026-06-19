<script setup lang="ts">
import type { BlogArticle } from "~/types/domain";

defineProps<{
  open: boolean;
  articles: BlogArticle[];
  selectingArticleId: string | null;
}>();

const emit = defineEmits<{
  close: [];
  select: [article: BlogArticle];
}>();
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
    @pointerdown.self="emit('close')"
  >
    <div
      class="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl"
      @pointerdown.stop
    >
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-xl font-semibold text-slate-900">
            Choisir l’article pilier
          </h2>
          <p class="text-sm text-slate-500">
            Sélectionnez un article déjà lié à ce cluster pour en faire la page pilier.
          </p>
        </div>

        <button
          type="button"
          class="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          @click="emit('close')"
        >
          <UIcon name="i-lucide-x" class="h-5 w-5" />
        </button>
      </div>

      <div class="mt-6">
        <ul
          v-if="articles.length"
          class="max-h-[24rem] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3"
        >
          <li
            v-for="article in articles"
            :key="article.id"
            class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium text-slate-900">
                {{ article.title }}
              </p>
              <p v-if="article.slug" class="mt-1 text-xs text-slate-500">
                /{{ article.slug }}
              </p>
            </div>

            <UButton
              size="sm"
              icon="i-lucide-check"
              :loading="selectingArticleId === article.id"
              :disabled="!!selectingArticleId"
              @click="emit('select', article)"
            >
              Choisir
            </UButton>
          </li>
        </ul>

        <p v-else class="text-sm text-slate-500">
          Aucun article n’est encore associé à ce cluster.
        </p>
      </div>
    </div>
  </div>
</template>
