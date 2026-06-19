<script setup lang="ts">
import type { AgencySite } from "~/types/domain";

defineProps<{
  sites: AgencySite[];
  scanningSiteIds: Set<string>;
  deletingSiteId: string | null;
}>();

defineEmits<{
  rescan: [id: string];
  delete: [id: string];
}>();
</script>

<template>
  <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
            Blogs
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
        <tr v-for="site in sites" :key="site.id" class="align-top">
          <td class="px-4 py-3 font-medium text-slate-900">
            <div class="space-y-1">
              <div>{{ site.name }}</div>
              <a
                :href="site.baseUrl"
                target="_blank"
                rel="noreferrer"
                class="block text-xs font-normal text-slate-500 underline underline-offset-2 transition hover:text-slate-700"
              >
                {{ site.baseUrl }}
              </a>
            </div>
          </td>
          <td class="whitespace-nowrap px-4 py-3">
            {{ site._count?.blogs ?? 0 }}
          </td>
          <td class="whitespace-nowrap px-4 py-3">
            <UBadge
              :color="site.lastScannedAt ? 'success' : 'neutral'"
              variant="soft"
            >
              {{ site.lastScannedAt ? "Scanné" : "Non scanné" }}
            </UBadge>
          </td>
          <td class="whitespace-nowrap px-4 py-3">
            <div class="flex items-center gap-3">
              <span
                class="cursor-pointer text-xs font-medium text-sky-600 underline underline-offset-2 transition hover:text-sky-700"
                :class="{
                  'pointer-events-none opacity-50': scanningSiteIds.has(site.id),
                }"
                @click="$emit('rescan', site.id)"
              >
                {{ scanningSiteIds.has(site.id) ? "Scan..." : "Relancer le scan" }}
              </span>

              <span
                class="cursor-pointer text-xs font-medium text-red-600 underline underline-offset-2 transition hover:text-red-700"
                :class="{
                  'pointer-events-none opacity-50': deletingSiteId === site.id,
                }"
                @click="$emit('delete', site.id)"
              >
                {{ deletingSiteId === site.id ? "Suppression..." : "Supprimer" }}
              </span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
