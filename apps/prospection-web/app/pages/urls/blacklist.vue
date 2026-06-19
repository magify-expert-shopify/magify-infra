<script setup lang="ts">
import type { UrlRow } from "~/composables/useUrlsStore";

const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();
const unblacklistingId = ref<number | null>(null);

const {
  data: blacklistedUrls,
  pending,
  error,
  refresh,
} = await useFetch<UrlRow[]>(
  () => `${runtimeConfig.public.apiUrl}/urls/blacklist`,
  {
    default: () => [],
  },
);

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function unblacklistUrl(item: UrlRow) {
  if (unblacklistingId.value === item.id) {
    return;
  }

  unblacklistingId.value = item.id;

  try {
    await $fetch(`${runtimeConfig.public.apiUrl}/urls/${item.id}/unblacklist`, {
      method: "PATCH",
    });

    blacklistedUrls.value = (blacklistedUrls.value || []).filter(
      (url) => url.id !== item.id,
    );
    notifications.add({
      kind: "success",
      title: "URL sortie de la black list",
      message: item.siteName || item.siteKey || item.url,
    });
  } catch (error) {
    notifications.add({
      kind: "error",
      title: "Sortie de black list échouée",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de sortir cette URL de la black list.",
    });
  } finally {
    unblacklistingId.value = null;
  }
}
</script>

<template>
  <LayoutPageShell
    title="URLs blacklistées"
    description="Les URLs black listées sont invisibles dans les listes et ignorées lors des imports futurs."
    max-width="none"
  >
    <template #actions>
      <UButton
        to="/urls"
        color="neutral"
        variant="outline"
        icon="i-lucide-table"
      >
        Sites
      </UButton>
      <UButton
        to="/trash"
        color="neutral"
        variant="outline"
        icon="i-lucide-trash-2"
      >
        Corbeille
      </UButton>
      <UButton
        color="neutral"
        variant="soft"
        icon="i-lucide-refresh-cw"
        :loading="pending"
        @click="refresh()"
      >
        Rafraîchir
      </UButton>
    </template>

    <div
      class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div class="border-b border-slate-200 px-5 py-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">
              URLs black listées
            </h2>
            <p class="text-muted-sm">
              {{ blacklistedUrls?.length || 0 }} URL(s) dans la black list
            </p>
          </div>
        </div>
      </div>

      <div v-if="pending" class="px-5 py-10 text-muted-sm">
        Chargement de la black list...
      </div>

      <div v-else-if="error" class="px-5 py-10 text-xs text-red-600">
        Impossible de charger la black list.
      </div>

      <div
        v-else-if="!blacklistedUrls?.length"
        class="px-5 py-10 text-muted-sm"
      >
        Aucune URL black listée.
      </div>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-xs">
          <thead class="bg-slate-50">
            <tr
              class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              <th class="px-5 py-3">URL</th>
              <th class="px-5 py-3">Site</th>
              <th class="px-5 py-3">Source</th>
              <th class="px-5 py-3">Black listée le</th>
              <th class="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="item in blacklistedUrls"
              :key="item.id"
              class="align-top hover:bg-slate-50/70"
            >
              <td class="px-5 py-4">
                <a
                  class="block min-w-0"
                  :href="item.url"
                  target="_blank"
                  rel="noreferrer"
                  @click.stop
                >
                  <div
                    class="truncate font-medium text-slate-900 hover:text-sky-700"
                  >
                    {{ item.siteName || item.siteKey || item.url }}
                  </div>
                  <div class="mt-1 truncate text-slate-500 hover:text-sky-700">
                    {{ item.url }}
                  </div>
                </a>
              </td>
              <td class="px-5 py-4 text-slate-600">
                {{ item.siteName || "—" }}
              </td>
              <td class="px-5 py-4 text-slate-600">
                {{ item.sourceFile }}
              </td>
              <td class="px-5 py-4 text-slate-600">
                {{ formatDate(item.blacklistedAt || null) }}
              </td>
              <td class="px-5 py-4 text-right">
                <UButton
                  color="warning"
                  variant="soft"
                  size="sm"
                  icon="i-lucide-circle-off"
                  :loading="unblacklistingId === item.id"
                  @click="unblacklistUrl(item)"
                >
                  Sortir de la black list
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </LayoutPageShell>
</template>
