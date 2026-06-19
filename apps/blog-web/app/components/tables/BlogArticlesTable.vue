<script setup lang="ts">
import type { BlogArticle } from "~/types/domain";

defineProps<{
  articles: BlogArticle[];
  refreshingArticleIds: Set<string>;
  deletingArticleId: string | null;
}>();

defineEmits<{
  rescan: [id: string];
  delete: [id: string];
}>();
</script>

<template>
  <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th
              class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Title
            </th>
            <th
              class="w-0 whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Slug
            </th>
            <th
              class="w-0 whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Author
            </th>
            <th
              class="w-0 whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Blog
            </th>
            <th
              class="w-0 whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Published At
            </th>
            <th
              class="w-0 whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Statut
            </th>
            <th
              class="w-0 whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Actions
            </th>
          </tr>
        </thead>

        <tbody class="divide-y divide-slate-200">
          <tr v-for="article in articles" :key="article.id" class="align-top">
            <td class="px-4 py-3 font-medium text-slate-900">
              <div class="space-y-1">
                <div>{{ article.title }}</div>
                <a
                  :href="article.url"
                  target="_blank"
                  rel="noreferrer"
                  class="block text-xs font-normal text-slate-500 underline underline-offset-2 transition hover:text-slate-700"
                >
                  {{ article.url }}
                </a>
              </div>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-slate-500">
              {{ article.slug || "-" }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-slate-500">
              {{ article.author?.name || "-" }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-slate-500">
              {{ article.blog.title || article.blog.name || "-" }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-slate-500">
              {{ article.publishedAt || "-" }}
            </td>
            <td class="whitespace-nowrap px-4 py-3">
              <UBadge
                :color="article.lastScannedAt ? 'success' : 'neutral'"
                variant="soft"
                class="whitespace-nowrap"
              >
                {{ article.lastScannedAt ? "Scanné" : "Non scanné" }}
              </UBadge>
            </td>
            <td class="whitespace-nowrap px-4 py-3">
              <div class="flex items-center gap-3">
                <span
                  class="cursor-pointer text-xs font-medium text-sky-600 underline underline-offset-2 transition hover:text-sky-700"
                  :class="{
                    'pointer-events-none opacity-50':
                      refreshingArticleIds.has(article.id),
                  }"
                  @click="$emit('rescan', article.id)"
                >
                  {{
                    refreshingArticleIds.has(article.id)
                      ? "Scan..."
                      : "Relancer le scan"
                  }}
                </span>

                <span
                  class="cursor-pointer text-xs font-medium text-red-600 underline underline-offset-2 transition hover:text-red-700"
                  :class="{
                    'pointer-events-none opacity-50': deletingArticleId === article.id,
                  }"
                  @click="$emit('delete', article.id)"
                >
                  {{
                    deletingArticleId === article.id
                      ? "Suppression..."
                      : "Supprimer"
                  }}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
