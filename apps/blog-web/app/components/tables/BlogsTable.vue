<script setup lang="ts">
import { BlogPlatform } from "~/types/domain";
import type { Blog } from "~/types/domain";

defineProps<{
  blogs: Blog[];
  scanningBlogIds: Set<string>;
  deletingBlogId: string | null;
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
              Nom
            </th>
            <th
              class="w-0 whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Feed URL
            </th>
            <th
              class="w-0 whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Slug
            </th>
            <th
              class="w-0 whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Platform
            </th>
            <th
              class="w-0 whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Language
            </th>
            <th
              class="w-0 whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Articles
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
          <tr v-for="blog in blogs" :key="blog.id" class="align-top">
            <td class="px-4 py-3 font-medium text-slate-900">
              <div class="space-y-1">
                <div>{{ blog.title || blog.name || "Sans titre" }}</div>
                <a
                  :href="blog.baseUrl"
                  target="_blank"
                  rel="noreferrer"
                  class="block text-xs font-normal text-slate-500 underline underline-offset-2 transition hover:text-slate-700"
                >
                  {{ blog.baseUrl }}
                </a>
              </div>
            </td>
            <td class="px-4 py-3 text-slate-500">
              <a
                v-if="blog.feedUrl"
                :href="blog.feedUrl"
                target="_blank"
                rel="noreferrer"
                class="underline underline-offset-2 transition hover:text-slate-700"
              >
                {{ blog.feedUrl }}
              </a>
              <span v-else>-</span>
            </td>
            <td class="px-4 py-3 text-slate-500">
              {{ blog.slug || "-" }}
            </td>
            <td class="px-4 py-3 text-slate-500">
              {{ !blog.platform || blog.platform === BlogPlatform.UNKNOWN ? "-" : blog.platform }}
            </td>
            <td class="px-4 py-3 text-slate-500">
              {{ blog.languageCode || "-" }}
            </td>
            <td class="px-4 py-3 text-slate-500">
              {{ blog._count?.articles ?? 0 }}
            </td>
            <td class="px-4 py-3">
              <UBadge
                :color="blog.lastScannedAt ? 'success' : 'neutral'"
                variant="soft"
                class="whitespace-nowrap"
              >
                {{ blog.lastScannedAt ? "Scanné" : "Non scanné" }}
              </UBadge>
            </td>
            <td class="whitespace-nowrap px-4 py-3">
              <div class="flex items-center gap-3">
                <span
                  class="cursor-pointer text-xs font-medium text-sky-600 underline underline-offset-2 transition hover:text-sky-700"
                  :class="{
                    'pointer-events-none opacity-50': scanningBlogIds.has(blog.id),
                  }"
                  @click="$emit('rescan', blog.id)"
                >
                  {{ scanningBlogIds.has(blog.id) ? "Scan..." : "Relancer le scan" }}
                </span>

                <span
                  class="cursor-pointer text-xs font-medium text-red-600 underline underline-offset-2 transition hover:text-red-700"
                  :class="{
                    'pointer-events-none opacity-50': deletingBlogId === blog.id,
                  }"
                  @click="$emit('delete', blog.id)"
                >
                  {{ deletingBlogId === blog.id ? "Suppression..." : "Supprimer" }}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
