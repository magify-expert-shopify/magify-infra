<script setup lang="ts">
import type { UrlListResponse, UrlRow } from "~/composables/useUrlsStore";

const runtimeConfig = useRuntimeConfig();
const route = useRoute();
const urlsStore = useUrlsStore();
const notifications = useNotificationsStore();
const search = ref("");
const searchQuery = ref("");
let searchQueryTimer: number | undefined;
const page = ref(1);
const limit = ref(50);
const sortKey = ref<
  "source" | "shopifyStatus" | "createdAt" | "scanDate" | "siteName"
>("createdAt");
const sortDirection = ref<"asc" | "desc">("desc");
const cmsFilter = ref<
  | "all"
  | "Shopify"
  | "WooCommerce"
  | "WordPress"
  | "PrestaShop"
  | "Magento"
  | "Wix"
  | "Squarespace"
  | "Webflow"
  | "Framer"
  | "BigCommerce"
  | "Drupal"
  | "Joomla"
  | "OpenCart"
  | "custom_static"
  | "unknown"
>("all");
const contactFilter = ref<"all" | "found" | "not_found">("all");
const addOpen = ref(false);
const adding = ref(false);
const addError = ref("");
const bulkOpen = ref(false);
const bulkAdding = ref(false);
const bulkError = ref("");
const bulkFile = ref<File | null>(null);
const bulkStatus = ref("");
const bulkResult = ref<{
  sourceFile: string;
  found: number;
  inserted: number;
  ignored: number;
} | null>(null);
const bulkMode = ref<
  "idle" | "hover" | "uploading" | "success" | "error" | "resetting"
>("idle");
const pageDropActive = ref(false);
const pageDragDepth = ref(0);
const scanningAllMode = ref<null | "new" | "force">(null);
const purgingUnknownCms = ref(false);
const purgingAllUrls = ref(false);
const loadingUrls = ref(false);
const loadError = ref("");
let loadRequestId = 0;
const isUrlsIndexRoute = computed(() => route.path === "/urls");
const requestedFields = [
  "id",
  "url",
  "siteKey",
  "siteName",
  "shopifyStatus",
  "cmsName",
  "redesignStatus",
  "contactStatus",
] as const;

const MAX_BULK_FILE_SIZE = 5 * 1024 * 1024;

const form = reactive({
  url: "",
  sourceFile: "manual",
});

const requestQuery = computed(() => ({
  page: page.value,
  limit: limit.value,
  search: searchQuery.value || undefined,
  sortBy: sortKey.value,
  cmsName: cmsFilter.value === "all" ? undefined : cmsFilter.value,
  contactStatus:
    contactFilter.value === "all" ? undefined : contactFilter.value,
  fields: requestedFields.join(","),
}));

async function loadUrls() {
  const requestId = ++loadRequestId;
  loadingUrls.value = true;
  loadError.value = "";

  try {
    const response = await $fetch<UrlListResponse>(
      `${runtimeConfig.public.apiUrl}/urls`,
      {
        query: requestQuery.value,
      },
    );

    if (requestId !== loadRequestId) {
      return;
    }

    urlsStore.setList(response);
  } catch (err) {
    if (requestId !== loadRequestId) {
      return;
    }

    loadError.value = getApiErrorMessage(
      err,
      "Impossible de charger les sites depuis l’API.",
    );
  } finally {
    if (requestId !== loadRequestId) {
      return;
    }

    loadingUrls.value = false;
  }
}

await loadUrls();

function removeUrlLocally(id: number) {
  urlsStore.removeById(id);

  if (!urlsStore.items.value.length && page.value > 1) {
    page.value -= 1;
  }

  notifications.add({
    kind: "info",
    title: "URL envoyée à la corbeille",
    message: "La ligne a disparu de la liste sans suppression définitive.",
  });
}

function blacklistUrlLocally(id: number) {
  urlsStore.removeById(id);

  if (!urlsStore.items.value.length && page.value > 1) {
    page.value -= 1;
  }

  notifications.add({
    kind: "warning",
    title: "Site blacklisté",
    message:
      "Le site a été retiré de la liste et le prospect associé a été envoyé à la corbeille.",
  });
}

function updateUrlLocally(id: number) {
  $fetch<UrlRow>(`${runtimeConfig.public.apiUrl}/urls/${id}`)
    .then((freshItem) => {
      urlsStore.updateById(id, freshItem);
      notifications.add({
        kind: "success",
        title: "URL rescannée",
        message: freshItem.siteName || freshItem.siteKey || freshItem.url,
        href: `/urls/${freshItem.id}`,
      });
    })
    .catch(() => {});
}

async function scanAllUrls(force = false) {
  scanningAllMode.value = force ? "force" : "new";

  try {
    const result = await $fetch<{ scanned: number }>(
      `${runtimeConfig.public.apiUrl}/scanning/all`,
      {
        method: "POST",
        query: force ? { force: "true" } : undefined,
      },
    );
    await loadUrls();
    notifications.add({
      kind: "success",
      title: force ? "Rescan global terminé" : "Scan global terminé",
      message: force
        ? `${result.scanned} URL(s) rescannée(s) et données remplacées.`
        : `${result.scanned} URL(s) scannée(s) pour la première fois.`,
    });
  } finally {
    scanningAllMode.value = null;
  }
}

async function purgeUnknownCmsUrls() {
  purgingUnknownCms.value = true;

  try {
    const result = await $fetch<{ trashed: number }>(
      `${runtimeConfig.public.apiUrl}/urls/unknown-cms`,
      {
        method: "DELETE",
      },
    );
    await loadUrls();
    notifications.add({
      kind: "info",
      title: "CMS inconnus purgés",
      message: `${result.trashed} URL(s) envoyée(s) à la corbeille.`,
    });
  } finally {
    purgingUnknownCms.value = false;
  }
}

async function purgeAllUrls() {
  purgingAllUrls.value = true;

  try {
    const result = await $fetch<{ deleted: number }>(
      `${runtimeConfig.public.apiUrl}/urls/reset`,
      {
        method: "DELETE",
        query: { confirm: "true" },
      },
    );

    urlsStore.reset();
    page.value = 1;
    notifications.add({
      kind: "warning",
      title: "Tous les sites ont été purgés",
      message: `${result.deleted} site(s) supprimé(s) et la liste a été remise à zéro.`,
    });
  } catch (err) {
    const message = getApiErrorMessage(
      err,
      "Impossible de purger tous les sites.",
    );
    notifications.add({
      kind: "error",
      title: "Purge globale échouée",
      message,
    });
  } finally {
    purgingAllUrls.value = false;
  }
}

const displayedUrls = computed(() => {
  const items = [...urlsStore.items.value];
  return sortDirection.value === "asc" ? items.reverse() : items;
});

const totals = computed(() => urlsStore.meta.value);

const dashboardCounts = computed(() => ({
  total: totals.value.total,
  shopify: displayedUrls.value.filter(
    (item) => item.shopifyStatus === "shopify",
  ).length,
  contacts: displayedUrls.value.filter(
    (item) => item.contactStatus !== "unknown",
  ).length,
}));

watch(search, (value) => {
  if (searchQueryTimer) {
    window.clearTimeout(searchQueryTimer);
  }

  searchQueryTimer = window.setTimeout(() => {
    searchQuery.value = value.trim();
    page.value = 1;
  }, 250);
});

watch([sortKey, cmsFilter, contactFilter, limit], () => {
  page.value = 1;
});

watch(
  requestQuery,
  () => {
    loadUrls();
  },
  { deep: true },
);

onBeforeUnmount(() => {
  if (searchQueryTimer) {
    window.clearTimeout(searchQueryTimer);
  }
});

function toggleSortDirection() {
  sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
}

function resetFilters() {
  sortKey.value = "createdAt";
  sortDirection.value = "desc";
  cmsFilter.value = "all";
  contactFilter.value = "all";
  search.value = "";
  searchQuery.value = "";
  if (searchQueryTimer) {
    window.clearTimeout(searchQueryTimer);
    searchQueryTimer = undefined;
  }
  page.value = 1;
  limit.value = 50;
}

async function submitUrl() {
  addError.value = "";
  adding.value = true;

  try {
    await $fetch(`${runtimeConfig.public.apiUrl}/urls`, {
      method: "POST",
      body: {
        url: form.url.trim(),
        sourceFile: form.sourceFile.trim() || "manual",
        scan: true,
      },
    });

    form.url = "";
    form.sourceFile = "manual";
    addOpen.value = false;
    await loadUrls();
    notifications.add({
      kind: "success",
      title: "Site ajouté",
      message:
        "Le nouveau site a été enregistré et le scan a démarré automatiquement.",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Impossible d’ajouter le site.";
    addError.value = message;
    notifications.add({
      kind: "error",
      title: "Ajout site échoué",
      message,
    });
  } finally {
    adding.value = false;
  }
}

async function submitBulkUrls() {
  if (!bulkFile.value) {
    setBulkError("Choisis un fichier avant d’envoyer.");
    return;
  }

  await runBulkImport(bulkFile.value);
}

function handleBulkFileChange(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0] || null;
  setBulkFile(file);
}

function handlePageDragOver(event: DragEvent) {
  const hasFiles = Array.from(event.dataTransfer?.types || []).includes(
    "Files",
  );

  if (hasFiles) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    pageDropActive.value = true;
    if (bulkMode.value === "success" || bulkMode.value === "error") {
      startBulkReset();
    } else if (bulkMode.value === "idle") {
      bulkMode.value = "hover";
    }
  }
}

function handlePageDragEnter(event: DragEvent) {
  const hasFiles = Array.from(event.dataTransfer?.types || []).includes(
    "Files",
  );

  if (!hasFiles) {
    return;
  }

  pageDragDepth.value += 1;
  pageDropActive.value = true;
  if (bulkMode.value === "success" || bulkMode.value === "error") {
    startBulkReset();
  } else if (bulkMode.value === "idle") {
    bulkMode.value = "hover";
  }
}

function handlePageDragLeave(event: DragEvent) {
  const hasFiles = Array.from(event.dataTransfer?.types || []).includes(
    "Files",
  );

  if (!hasFiles) {
    return;
  }

  pageDragDepth.value = Math.max(0, pageDragDepth.value - 1);

  if (pageDragDepth.value === 0) {
    pageDropActive.value = false;
    if (bulkMode.value === "hover") {
      bulkMode.value = "idle";
    }
  }
}

async function handlePageDrop(event: DragEvent) {
  event.preventDefault();
  pageDropActive.value = false;
  pageDragDepth.value = 0;

  const file = event.dataTransfer?.files?.[0];
  if (!file) {
    return;
  }

  if (!setBulkFile(file)) {
    return;
  }

  await runBulkImport(file);
}

async function importBulkFile(file: File) {
  bulkStatus.value = "Envoi du fichier...";
  const text = await file.text();

  return await $fetch<{
    sourceFile: string;
    found: number;
    inserted: number;
    ignored: number;
  }>(`${runtimeConfig.public.apiUrl}/urls/import`, {
    method: "POST",
    body: {
      text,
      sourceFile: file.name,
    },
  });
}

async function runBulkImport(file: File) {
  const startedAt = Date.now();
  bulkResult.value = null;
  bulkAdding.value = true;
  bulkMode.value = "uploading";
  bulkStatus.value = "Lecture du fichier...";

  try {
    const result = await importBulkFile(file);
    bulkResult.value = result;
    bulkFile.value = null;
    bulkMode.value = "success";
    await loadUrls();
    notifications.add({
      kind: result.found === 0 ? "warning" : "success",
      title: result.found === 0 ? "Import sans site" : "Import groupé terminé",
      message:
        result.found === 0
          ? "Le fichier ne contenait aucun site exploitable."
          : `${result.found} site(s) trouvé(s), ${result.inserted} ajouté(s), ${result.ignored} déjà existant(s).`,
    });
  } catch (err) {
    const message = getApiErrorMessage(err, "Impossible d’importer les sites.");
    setBulkError(message);
    notifications.add({
      kind: "error",
      title: "Import groupé échoué",
      message,
    });
  } finally {
    const elapsed = Date.now() - startedAt;
    if (elapsed < 1000) {
      await new Promise((resolve) =>
        window.setTimeout(resolve, 1000 - elapsed),
      );
    }

    bulkAdding.value = false;
    bulkStatus.value = "";
    if (bulkMode.value === "success" || bulkMode.value === "error") {
      bulkOpen.value = false;
    }
  }
}

function setBulkFile(file: File | null) {
  clearBulkFeedback();

  if (!file) {
    bulkFile.value = null;
    return false;
  }

  if (file.size > MAX_BULK_FILE_SIZE) {
    bulkFile.value = null;
    setBulkError(
      `Le fichier est trop gros. Taille maximale: ${formatFileSize(MAX_BULK_FILE_SIZE)}.`,
    );
    return false;
  }

  bulkFile.value = file;
  return true;
}

function clearBulkFeedback() {
  bulkError.value = "";
  bulkResult.value = null;
  bulkMode.value = "idle";
}

function setBulkError(message: string) {
  bulkError.value = message;
  bulkResult.value = null;
  bulkMode.value = "error";
}

function startBulkReset() {
  bulkMode.value = "resetting";
  window.setTimeout(() => {
    bulkResult.value = null;
    bulkError.value = "";
    bulkStatus.value = "";
    bulkMode.value = "idle";
  }, 180);
}

function formatFileSize(bytes: number) {
  const units = ["o", "Ko", "Mo", "Go"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const typedError = error as {
      statusCode?: number;
      statusMessage?: string;
      message?: string;
      data?: { message?: string | string[] };
    };

    const apiMessage = typedError.data?.message;
    if (Array.isArray(apiMessage) && apiMessage.length > 0) {
      return apiMessage.join(" ");
    }

    if (typeof apiMessage === "string" && apiMessage.trim()) {
      return apiMessage;
    }

    if (typedError.statusCode) {
      if (typedError.statusCode === 413) {
        return "Le fichier est trop volumineux pour être envoyé à l’API.";
      }

      return typedError.statusMessage || `Erreur API ${typedError.statusCode}.`;
    }

    if (typedError.message) {
      return typedError.message;
    }
  }

  return fallback;
}

function getBulkZoneTitle() {
  if (bulkMode.value === "uploading") {
    return "Import en cours";
  }

  if (bulkMode.value === "success") {
    return "Import réussi";
  }

  if (bulkMode.value === "error") {
    return "Import en échec";
  }

  return "Dépose le fichier ici pour lancer l’import automatique.";
}

function getBulkZoneMessage() {
  if (bulkMode.value === "uploading") {
    return bulkStatus.value || "Traitement du fichier...";
  }

  if (bulkMode.value === "success") {
    if (!bulkResult.value) {
      return "Import terminé.";
    }

    if (bulkResult.value.found === 0) {
      return "Le texte ne contenait aucun site.";
    }

    return `${bulkResult.value.found} site(s) trouvé(s), ${bulkResult.value.inserted} ajouté(s), ${bulkResult.value.ignored} déjà existant(s).`;
  }

  if (bulkMode.value === "error") {
    return bulkError.value || "Une erreur est survenue pendant l’import.";
  }

  return "Dépose le fichier ici pour lancer l’import automatique.";
}

const bulkZoneClass = computed(() => {
  if (bulkMode.value === "uploading" || bulkMode.value === "hover") {
    return "border-slate-300 bg-slate-50 text-slate-700";
  }

  return "border-slate-200 bg-white text-slate-700";
});
</script>

<template>
  <NuxtPage v-if="!isUrlsIndexRoute" />

  <main
    v-else
    class="min-h-screen bg-background text-slate-900"
    @dragenter="handlePageDragEnter"
    @dragover="handlePageDragOver"
    @dragleave="handlePageDragLeave"
    @drop="handlePageDrop"
  >
    <section class="w-full px-5 py-6 lg:px-8">
      <div class="w-full">
        <div
          class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
        >
          <div class="space-y-2">
            <p
              class="text-[11px] font-medium uppercase tracking-[0.18em] text-sky-700"
            >
              Prospection Magify
            </p>
            <div class="space-y-2">
              <h1 class="page-title">Sites</h1>
              <p class="max-w-2xl body-muted">
                Liste des sites enregistrés dans l’API, avec les statuts Shopify
                et contact. Tu peux ajouter un nouveau site depuis ce panneau.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3 sm:gap-4">
            <div
              class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <div
                class="text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                Sites
              </div>
              <div class="mt-2 text-2xl font-semibold">
                {{ dashboardCounts.total }}
              </div>
            </div>
            <div
              class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <div
                class="text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                Shopify
              </div>
              <div class="mt-2 text-2xl font-semibold">
                {{ dashboardCounts.shopify }}
              </div>
            </div>
            <div
              class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <div
                class="text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                Contacts
              </div>
              <div class="mt-2 text-2xl font-semibold">
                {{ dashboardCounts.contacts }}
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6 flex flex-col gap-3 md:flex-row">
          <UButton
            to="/prospects"
            color="neutral"
            variant="outline"
            icon="i-lucide-arrow-left"
          >
            Prospects
          </UButton>
          <UInput
            v-model="search"
            trailing-icon="i-lucide-search"
            placeholder="Rechercher un site, un fichier source, un statut..."
            class="flex-1 min-w-0 rounded-xl bg-white"
            :ui="{
              base: 'bg-white dark:bg-white',
              trailing: 'absolute inset-y-0 end-0 flex items-center pe-3',
              trailingIcon: 'shrink-0 text-slate-400',
            }"
          />
          <UButton
            color="primary"
            variant="solid"
            icon="i-lucide-plus"
            @click="addOpen = true"
          >
            Nouveau site
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-file-up"
            @click="bulkOpen = true"
          >
            Ajouter en groupe
          </UButton>
          <UButton
            color="success"
            variant="soft"
            icon="i-lucide-refresh-cw"
            :loading="scanningAllMode === 'new'"
            :disabled="scanningAllMode !== null || loadingUrls"
            @click="scanAllUrls(false)"
          >
            Scanner les nouveaux sites
          </UButton>
          <UButton
            color="warning"
            variant="soft"
            icon="i-lucide-badge-alert"
            :loading="scanningAllMode === 'force'"
            :disabled="scanningAllMode !== null || loadingUrls"
            @click="scanAllUrls(true)"
          >
            Rescanner tout
          </UButton>
          <UButton
            color="error"
            variant="soft"
            icon="i-lucide-trash-2"
            :loading="purgingUnknownCms"
            :disabled="purgingUnknownCms || purgingAllUrls || loadingUrls"
            @click="purgeUnknownCmsUrls"
          >
            Purger CMS inconnus
          </UButton>
          <UButton
            color="error"
            variant="solid"
            icon="i-lucide-trash-2"
            :loading="purgingAllUrls"
            :disabled="
              purgingAllUrls ||
              purgingUnknownCms ||
              loadingUrls ||
              scanningAllMode !== null
            "
            @click="purgeAllUrls"
          >
            Purger tous les sites
          </UButton>
        </div>
      </div>
    </section>

    <section class="w-full px-5 pb-6 lg:px-8">
      <div
        class="mb-4 overflow-hidden rounded-xl border px-4 py-3 shadow-sm transition-colors duration-500 ease-in-out"
        :class="bulkZoneClass"
      >
        <Transition name="bulk-zone" mode="out-in">
          <div :key="bulkMode" class="flex items-center gap-3">
            <UIcon
              :name="
                bulkMode === 'success'
                  ? 'i-lucide-circle-check-big'
                  : bulkMode === 'error'
                    ? 'i-lucide-circle-x'
                    : bulkMode === 'uploading'
                      ? 'i-lucide-loader-2'
                      : 'i-lucide-file-up'
              "
              class="h-4 w-4"
              :class="bulkMode === 'uploading' ? 'animate-spin' : ''"
            />
            <div class="min-w-0 flex-1">
              <div class="text-xs font-medium">
                {{ getBulkZoneTitle() }}
              </div>
              <div class="text-xs opacity-80">
                {{ getBulkZoneMessage() }}
              </div>
            </div>
          </div>
        </Transition>
        <div
          v-if="bulkMode === 'uploading'"
          class="mt-3 h-1.5 overflow-hidden rounded-full bg-white/70"
        >
          <div
            class="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-sky-400 via-sky-500 to-sky-400"
          ></div>
        </div>
      </div>

      <div
        v-if="loadError && !displayedUrls.length"
        class="rounded-lg border border-red-200 bg-white px-6 py-12 text-xs text-red-600"
      >
        {{ loadError }}
      </div>

      <template v-else>
        <div
          v-if="loadingUrls"
          class="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-700"
        >
          Chargement des sites depuis l’API...
        </div>

        <div
          v-else-if="loadError"
          class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700"
        >
          {{ loadError }}
        </div>

        <div class="mb-4 flex items-center justify-between">
          <p class="text-xs text-slate-600">
            {{ displayedUrls.length }} site(s) affiché(s)
          </p>
        </div>

        <div class="mb-4 grid gap-3 lg:grid-cols-6">
          <label
            class="space-y-1 text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            Tri
            <select
              v-model="sortKey"
              class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm outline-none focus:border-sky-500"
            >
              <option value="createdAt">Date de création</option>
              <option value="scanDate">Date de scan</option>
              <option value="source">Source</option>
              <option value="shopifyStatus">Status Shopify</option>
              <option value="siteName">Nom du site</option>
            </select>
          </label>

          <label
            class="space-y-1 text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            Ordre
            <button
              type="button"
              class="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm"
              @click="toggleSortDirection"
            >
              <span>{{
                sortDirection === "asc" ? "Croissant" : "Décroissant"
              }}</span>
              <UIcon
                :name="
                  sortDirection === 'asc'
                    ? 'i-lucide-arrow-up-narrow-wide'
                    : 'i-lucide-arrow-down-narrow-wide'
                "
                class="h-4 w-4 text-slate-500"
              />
            </button>
          </label>

          <label
            class="space-y-1 text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            CMS
            <select
              v-model="cmsFilter"
              class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm outline-none focus:border-sky-500"
            >
              <option value="all">Tous</option>
              <option value="Shopify">Shopify</option>
              <option value="WooCommerce">WooCommerce</option>
              <option value="WordPress">WordPress</option>
              <option value="PrestaShop">PrestaShop</option>
              <option value="Magento">Magento</option>
              <option value="Wix">Wix</option>
              <option value="Squarespace">Squarespace</option>
              <option value="Webflow">Webflow</option>
              <option value="Framer">Framer</option>
              <option value="BigCommerce">BigCommerce</option>
              <option value="Drupal">Drupal</option>
              <option value="Joomla">Joomla</option>
              <option value="OpenCart">OpenCart</option>
              <option value="custom_static">Custom / Static</option>
              <option value="unknown">Inconnu</option>
            </select>
          </label>

          <label
            class="space-y-1 text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            Contact
            <select
              v-model="contactFilter"
              class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm outline-none focus:border-sky-500"
            >
              <option value="all">Tous</option>
              <option value="found">Trouvé</option>
              <option value="not_found">Non trouvé</option>
            </select>
          </label>

          <label
            class="space-y-1 text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            Par page
            <select
              v-model="limit"
              class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm outline-none focus:border-sky-500"
            >
              <option :value="25">25</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
              <option :value="200">200</option>
            </select>
          </label>

          <div
            class="space-y-1 text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            Actions
            <UButton
              color="neutral"
              variant="soft"
              class="w-full justify-center"
              @click="resetFilters"
            >
              Réinitialiser
            </UButton>
          </div>
        </div>

        <template v-if="displayedUrls.length">
          <UrlsUrlTable
            :items="displayedUrls"
            @deleted="removeUrlLocally"
            @scanned="updateUrlLocally"
            @blacklisted="blacklistUrlLocally"
          />

          <div
            v-if="totals.total > 25"
            class="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="text-xs text-slate-600">
              {{ totals.total }} site(s) au total, page {{ totals.page }} sur
              {{ totals.totalPages }}.
            </div>

            <div class="flex items-center gap-2">
              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-chevron-left"
                :disabled="totals.page <= 1 || loadingUrls"
                @click="page = Math.max(1, page - 1)"
              >
                Précédent
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-chevron-right"
                :disabled="totals.page >= totals.totalPages || loadingUrls"
                @click="page = Math.min(totals.totalPages, page + 1)"
              >
                Suivant
              </UButton>
            </div>
          </div>
        </template>

        <div
          v-else
          class="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-muted-sm"
        >
          Aucun site ne correspond à la recherche.
        </div>
      </template>
    </section>

    <UModal
      v-model:open="addOpen"
      :title="'Ajouter un site'"
      description="Enregistre un nouveau site dans la base. Le scan démarre automatiquement."
      portal="body"
      :ui="{
        content:
          'fixed left-1/2 top-1/2 z-50 w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white shadow-2xl',
      }"
    >
      <template #body>
        <form class="space-y-5 px-1 pb-1 pt-2" @submit.prevent="submitUrl">
          <UAlert
            v-if="addError"
            color="error"
            variant="soft"
            icon="i-lucide-alert-circle"
            :title="addError"
          />

          <UFormField label="Site" required class="space-y-1">
            <UInput
              v-model="form.url"
              placeholder="https://example.com"
              autofocus
              required
              class="w-full"
            />
          </UFormField>

          <UFormField label="Source file" class="space-y-1">
            <UInput
              v-model="form.sourceFile"
              placeholder="manual"
              class="w-full"
            />
          </UFormField>
          <p class="text-xs leading-6 text-slate-500">
            L’ajout lance automatiquement un scan du site.
          </p>

          <div class="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <UButton
              type="button"
              color="neutral"
              variant="soft"
              @click="addOpen = false"
            >
              Annuler
            </UButton>
            <UButton
              type="submit"
              color="primary"
              icon="i-lucide-plus"
              :loading="adding"
              :disabled="!form.url.trim()"
            >
              Ajouter
            </UButton>
          </div>
        </form>
      </template>
    </UModal>

    <UModal
      v-model:open="bulkOpen"
      :title="'Ajouter en groupe'"
      description="Sélectionne un fichier texte contenant une ou plusieurs URLs, une par ligne ou séparées par des espaces."
      portal="body"
      :ui="{
        content:
          'fixed left-1/2 top-1/2 z-50 w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white shadow-2xl',
      }"
    >
      <template #body>
        <form class="space-y-5 px-1 pb-1 pt-2" @submit.prevent="submitBulkUrls">
          <UAlert
            v-if="bulkError"
            color="error"
            variant="soft"
            icon="i-lucide-alert-circle"
            :title="bulkError"
          />

          <UFormField label="Fichier" required class="space-y-1">
            <input
              type="file"
              accept=".txt,.md,.csv,text/plain,text/csv"
              class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              @change="handleBulkFileChange"
            />
          </UFormField>

          <p class="text-xs leading-6 text-slate-500">
            Le nom du fichier sera utilisé comme source dans la base.
          </p>

          <p class="text-xs text-slate-500">
            Taille maximale: {{ formatFileSize(MAX_BULK_FILE_SIZE) }}
          </p>

          <div
            v-if="bulkFile"
            class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
          >
            Fichier sélectionné:
            <span class="font-medium">{{ bulkFile.name }}</span>
            <span class="text-slate-500"
              >({{ formatFileSize(bulkFile.size) }})</span
            >
          </div>

          <div
            v-if="bulkAdding"
            class="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700"
          >
            {{ bulkStatus || "Import en cours..." }}
          </div>

          <div class="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <UButton
              type="button"
              color="neutral"
              variant="soft"
              @click="bulkOpen = false"
            >
              Annuler
            </UButton>
            <UButton
              type="submit"
              color="primary"
              icon="i-lucide-upload"
              :loading="bulkAdding"
              :disabled="!bulkFile"
            >
              Importer
            </UButton>
          </div>
        </form>
      </template>
    </UModal>
  </main>
</template>

<style scoped>
.bulk-zone-enter-active,
.bulk-zone-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.bulk-zone-enter-from,
.bulk-zone-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
