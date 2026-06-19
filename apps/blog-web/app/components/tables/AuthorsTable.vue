<script setup lang="ts">
import type { Author } from "~/types/domain";

defineProps<{
  authors: Author[];
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
              Auteur
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Bio
            </th>
          </tr>
        </thead>

        <tbody class="divide-y divide-slate-200">
          <tr v-for="author in authors" :key="author.id" class="align-top">
            <td class="px-4 py-3">
              <div class="flex items-start gap-3">
                <UAvatar
                  :src="author.avatarUrl || undefined"
                  :alt="author.name"
                  :text="author.name.charAt(0).toUpperCase()"
                  size="lg"
                />

                <div class="min-w-0 space-y-1">
                  <div class="font-medium text-slate-900">
                    {{ author.name }}
                  </div>

                  <a
                    v-if="author.profileUrl"
                    :href="author.profileUrl"
                    target="_blank"
                    rel="noreferrer"
                    class="block truncate text-xs text-slate-500 underline underline-offset-2 transition hover:text-slate-700"
                  >
                    {{ author.profileUrl }}
                  </a>
                  <div v-else class="text-xs text-slate-400">
                    Aucun profil
                  </div>
                </div>
              </div>
            </td>

            <td class="px-4 py-3 text-slate-500">
              <p class="max-w-2xl whitespace-pre-line">
                {{ author.bio || "-" }}
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
