<script setup lang="ts">
import type { UrlRow } from "~/types/urls";

defineProps<{
  items: UrlRow[];
}>();

const router = useRouter();
const emit = defineEmits<{
  (event: "deleted", id: number): void;
  (event: "scanned", id: number): void;
  (event: "blacklisted", id: number): void;
}>();
const runtimeConfig = useRuntimeConfig();
const deletingId = ref<number | null>(null);
const scanningId = ref<number | null>(null);
const blacklistingId = ref<number | null>(null);

function badgeTone(
  value: string | null,
  kind: "shopify" | "contact" | "redesign",
) {
  const normalized = String(value || "").toLowerCase();

  if (kind === "shopify") {
    if (normalized === "shopify")
      return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    if (normalized === "not_shopify")
      return "bg-amber-100 text-amber-700 ring-amber-200";
    if (normalized === "error") return "bg-red-100 text-red-700 ring-red-200";
    return "bg-slate-100 text-slate-700 ring-slate-200";
  }

  if (kind === "contact") {
    if (normalized === "found")
      return "bg-blue-100 text-blue-700 ring-blue-200";
    if (normalized === "error") return "bg-red-100 text-red-700 ring-red-200";
    if (normalized === "not_found")
      return "bg-slate-100 text-slate-700 ring-slate-200";
    return "bg-slate-100 text-slate-700 ring-slate-200";
  }

  if (normalized === "cible") return "bg-sky-100 text-sky-700 ring-sky-200";
  if (normalized === "candidat")
    return "bg-indigo-100 text-indigo-700 ring-indigo-200";
  if (normalized.includes("migration"))
    return "bg-amber-100 text-amber-700 ring-amber-200";
  if (normalized.includes("refonte"))
    return "bg-sky-100 text-sky-700 ring-sky-200";
  if (normalized === "ignore") return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function isShopify(item: UrlRow) {
  return String(item.shopifyStatus || "").toLowerCase() === "shopify";
}

function getShopifyLabel(item: UrlRow) {
  const normalized = String(item.shopifyStatus || "").toLowerCase();

  if (normalized === "shopify") return "Shopify";
  if (normalized === "not_shopify") return "Non Shopify";
  if (normalized === "error") return "Défectueux";

  return item.cmsName || "—";
}

function isRowBusy(id: number) {
  return (
    deletingId.value === id ||
    scanningId.value === id ||
    blacklistingId.value === id
  );
}

async function deleteUrl(item: UrlRow) {
  deletingId.value = item.id;

  try {
    await $fetch(`${runtimeConfig.public.apiUrl}/urls/${item.id}`, {
      method: "DELETE",
    });

    emit("deleted", item.id);
  } finally {
    deletingId.value = null;
  }
}

async function scanUrl(item: UrlRow) {
  scanningId.value = item.id;

  try {
    await $fetch(`${runtimeConfig.public.apiUrl}/scanning/sites/${item.id}`, {
      method: "POST",
    });

    emit("scanned", item.id);
  } finally {
    scanningId.value = null;
  }
}

async function blacklistUrl(item: UrlRow) {
  blacklistingId.value = item.id;

  try {
    await $fetch(`${runtimeConfig.public.apiUrl}/urls/${item.id}/blacklist`, {
      method: "PATCH",
    });

    emit("blacklisted", item.id);
  } finally {
    blacklistingId.value = null;
  }
}
</script>

<template>
  <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
    <table class="min-w-full divide-y divide-slate-200 text-xs">
      <thead class="bg-slate-50">
        <tr
          class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          <th class="px-4 py-3">URL</th>
          <th class="px-4 py-3">CMS</th>
          <th class="px-4 py-3">Contact</th>
          <th class="px-4 py-3">Refonte</th>
          <th class="px-4 py-3 text-right">Actions</th>
        </tr>
      </thead>
      <TransitionGroup
        tag="tbody"
        name="url-row"
        class="divide-y divide-slate-100 bg-white"
      >
        <tr
          v-for="item in items"
          :key="item.id"
          class="align-top hover:bg-slate-50/70"
        >
          <td class="px-4 py-3">
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
          <td class="px-4 py-3">
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset bg-slate-100 text-slate-700 ring-slate-200"
            >
              <UIcon
                v-if="isShopify(item)"
                name="i-simple-icons-shopify"
                class="h-3.5 w-3.5"
              />
              <span>{{ getShopifyLabel(item) }}</span>
            </span>
          </td>
          <td class="px-4 py-3">
            <span
              class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset"
              :class="badgeTone(item.contactStatus, 'contact')"
            >
              {{ item.contactStatus }}
            </span>
          </td>
          <td class="px-4 py-3">
            <span
              class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset"
              :class="badgeTone(item.redesignStatus, 'redesign')"
            >
              {{ item.redesignStatus || "none" }}
            </span>
          </td>
          <td class="px-4 py-3 text-right">
            <div class="flex flex-col items-end gap-2">
              <UButton
                color="primary"
                variant="soft"
                size="sm"
                icon="i-lucide-refresh-cw"
                :loading="scanningId === item.id"
                :disabled="isRowBusy(item.id)"
                @click.stop="scanUrl(item)"
              >
                Rescanner
              </UButton>
              <UButton
                color="error"
                variant="soft"
                size="sm"
                icon="i-lucide-ban"
                :loading="blacklistingId === item.id"
                :disabled="isRowBusy(item.id)"
                @click.stop="blacklistUrl(item)"
              >
                Blacklister
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                size="sm"
                icon="i-lucide-square-arrow-out-up-right"
                as="button"
                @click.stop="router.push(`/urls/${item.id}`)"
              >
                Détail
              </UButton>
              <UButton
                color="error"
                variant="soft"
                size="sm"
                icon="i-lucide-trash-2"
                :loading="deletingId === item.id"
                :disabled="isRowBusy(item.id)"
                @click.stop="deleteUrl(item)"
              >
                Supprimer
              </UButton>
            </div>
          </td>
        </tr>
      </TransitionGroup>
    </table>
  </div>
</template>

<style scoped>
.url-row-enter-active,
.url-row-leave-active {
  transition:
    opacity 200ms ease,
    transform 200ms ease;
}

.url-row-enter-from,
.url-row-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.url-row-move {
  transition: transform 200ms ease;
}
</style>
