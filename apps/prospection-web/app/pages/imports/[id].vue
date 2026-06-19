<script setup lang="ts">
import ImportAnalysisSummary from "~/components/imports/ImportAnalysisSummary.vue";
import ImportContactsSummary from "~/components/imports/ImportContactsSummary.vue";
import ImportUrlsList from "~/components/imports/ImportUrlsList.vue";
import type {
  ImportContactsSummaryResponse,
  ImportDetail,
  ImportPageDetail,
  UrlAnalysisDetail,
  UrlAnalysisState,
} from "~/types/imports";

const route = useRoute();
const router = useRouter();
const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();

const importId = computed(() => Number(route.params.id));

const { data, pending, error, refresh } = await useFetch<ImportPageDetail>(
  () => `${runtimeConfig.public.apiUrl}/imports/${importId.value}?view=page`,
  {
    default: () => null,
  },
);
const {
  data: importContacts,
  error: importContactsFetchError,
  refresh: refreshImportContacts,
} = await useFetch<ImportContactsSummaryResponse>(
  () => `${runtimeConfig.public.apiUrl}/imports/${importId.value}/prospects`,
  {
    default: () => ({ total: 0, prospects: [] }),
  },
);
const isInitialLoading = computed(() => pending.value && !data.value);
const isRefreshing = computed(() => pending.value && Boolean(data.value));
const isLiveRefreshing = ref(false);
const isRefreshAnimated = computed(
  () => isRefreshing.value || isLiveRefreshing.value,
);
const importContactsError = computed(
  () => importContactsFetchError.value?.message || "",
);
let liveRefreshTimer: ReturnType<typeof setTimeout> | null = null;

async function refreshImportPage() {
  await refresh();

  const current = data.value;
  if (current) {
    await Promise.all([
      refreshImportContacts(),
      loadUrlAnalysisDetails(current),
    ]);
  }
}

const urlAnalysisDetails = ref<UrlAnalysisDetail[]>([]);
const urlAnalysisError = ref("");
let urlAnalysisRequestId = 0;
const isClientReady = ref(false);
let importEventsSource: EventSource | null = null;
const trashingImport = ref(false);
const rescanOpen = ref(false);
const rescanLoading = ref(false);
const rescanError = ref("");
const rescanSelectedIds = ref<number[]>([]);
const pendingRescanTriggered = ref(false);
const shouldAutoOpenPendingRescan = computed(
  () => route.query.rescan === "pending",
);

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusLabel(status: string) {
  if (status === "queued") return "En file";
  if (status === "processing") return "En cours";
  if (status === "completed") return "Terminé";
  if (status === "completed_with_errors") return "Terminé avec erreurs";
  if (status === "error") return "Erreur";

  return status;
}

function getProgressLabel(current: ImportPageDetail | null) {
  if (!current) {
    return "—";
  }

  return `${current.processedUrls}/${current.queuedUrls} URL(s) traitée(s)`;
}

function getShopifyStatusLabel(value: string | null | undefined) {
  const normalized = String(value || "").toLowerCase();

  if (normalized === "shopify") return "Shopify";
  if (normalized === "not_shopify") return "Non Shopify";
  if (normalized === "error") return "Défectueux";

  return value || "—";
}

const canTrashImport = computed(() => {
  const current = data.value;
  if (!current) {
    return false;
  }

  return !["queued", "processing"].includes(current.status);
});

const canRescanImport = computed(() => {
  const current = data.value;
  if (!current) {
    return false;
  }

  return !["queued", "processing"].includes(current.status);
});

const rescanSelectableRows = computed(() =>
  urlAnalysisRows.value.filter(
    (row) => Boolean(row.id) && row.state !== "missing",
  ),
);
const rescanNeverScannedRows = computed(() =>
  rescanSelectableRows.value.filter((row) => row.state === "pending"),
);
const hasNeverScannedRows = computed(
  () => rescanNeverScannedRows.value.length > 0,
);
const interruptedImportMessage =
  "Import interrompu: aucune tâche restante dans la queue.";
const isInterruptedImport = computed(() => {
  const current = data.value;
  if (!current) {
    return false;
  }

  return (
    current.status === "error" &&
    Boolean(current.lastError?.includes(interruptedImportMessage))
  );
});
const hasPendingRescanRows = computed(
  () => rescanNeverScannedRows.value.length > 0,
);

async function trashImport(event?: MouseEvent) {
  const current = data.value;
  if (!current || trashingImport.value || !canTrashImport.value) {
    return;
  }

  if (!event?.shiftKey) {
    const confirmed = window.confirm(
      `Mettre l’import #${current.id} à la corbeille ?`,
    );
    if (!confirmed) {
      return;
    }
  }

  trashingImport.value = true;

  try {
    await $fetch(`${runtimeConfig.public.apiUrl}/imports/${current.id}/trash`, {
      method: "DELETE",
    });

    await navigateTo("/imports");
  } catch (error) {
    notifications.add({
      kind: "error",
      title: "Mise à la corbeille échouée",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de mettre cet import à la corbeille.",
    });
  } finally {
    trashingImport.value = false;
  }
}

function openRescanModal() {
  if (!canRescanImport.value || !data.value) {
    return;
  }

  rescanSelectedIds.value = (
    hasNeverScannedRows.value
      ? rescanNeverScannedRows.value
      : rescanSelectableRows.value
  )
    .map((row) => row.id)
    .filter((value): value is number => Number.isInteger(value) && value > 0);
  rescanError.value = "";
  rescanOpen.value = true;
}

function triggerLiveRefreshAnimation() {
  isLiveRefreshing.value = true;

  if (liveRefreshTimer) {
    clearTimeout(liveRefreshTimer);
  }

  liveRefreshTimer = setTimeout(() => {
    isLiveRefreshing.value = false;
    liveRefreshTimer = null;
  }, 350);
}

function openPendingOnlyRescanModal() {
  if (!canRescanImport.value || !data.value || !hasPendingRescanRows.value) {
    return;
  }

  rescanSelectedIds.value = rescanNeverScannedRows.value
    .map((row) => row.id)
    .filter((value): value is number => Number.isInteger(value) && value > 0);
  rescanError.value = "";
  rescanOpen.value = true;
}

async function consumePendingRescanQuery() {
  if (route.query.rescan !== "pending") {
    return;
  }

  const { rescan, ...query } = route.query;
  await router.replace({
    path: route.path,
    query,
  });
}

function selectAllRescanUrls() {
  rescanSelectedIds.value = rescanSelectableRows.value
    .map((row) => row.id)
    .filter((value): value is number => Number.isInteger(value) && value > 0);
}

function selectNeverScannedRescanUrls() {
  rescanSelectedIds.value = rescanNeverScannedRows.value
    .map((row) => row.id)
    .filter((value): value is number => Number.isInteger(value) && value > 0);
}

function deselectAllRescanUrls() {
  rescanSelectedIds.value = [];
}

async function submitRescanImport() {
  const current = data.value;
  if (!current || rescanLoading.value || !canRescanImport.value) {
    return;
  }

  if (rescanSelectedIds.value.length === 0) {
    rescanError.value = "Sélectionne au moins une URL à rescanner.";
    return;
  }

  rescanLoading.value = true;
  rescanError.value = "";
  pendingRescanTriggered.value = true;

  try {
    await $fetch(
      `${runtimeConfig.public.apiUrl}/imports/${current.id}/rescan`,
      {
        method: "POST",
        body: {
          urlIds: rescanSelectedIds.value,
        },
      },
    );

    rescanOpen.value = false;
    notifications.add({
      kind: "success",
      title: "Rescan lancé",
      message: `${rescanSelectedIds.value.length} URL(s) rescannée(s).`,
    });
    await refreshImportPage();
  } catch (error) {
    pendingRescanTriggered.value = false;
    rescanError.value =
      error instanceof Error
        ? error.message
        : "Impossible de rescanner cet import.";
    notifications.add({
      kind: "error",
      title: "Rescan échoué",
      message: rescanError.value,
    });
  } finally {
    rescanLoading.value = false;
  }
}

const summaryRows = computed(() => {
  const current = data.value;
  if (!current) {
    return [];
  }

  return [
    ["Fichier source", current.sourceFile],
    ["Statut", getStatusLabel(current.status)],
    ["Étape courante", current.currentStep],
    ["URLs trouvées", String(current.totalUrls)],
    ["URLs déjà existantes", String(current.existingUrls)],
    [
      "Nouvelles URLs",
      String(Math.max(0, current.totalUrls - current.existingUrls)),
    ],
    ["En file", String(current.queuedUrls)],
    ["Traitées", String(current.processedUrls)],
    ["En erreur", String(current.failedUrls)],
    ["Progression", getProgressLabel(current)],
    ["Créé le", formatDate(current.createdAt)],
    ["Mise en file le", formatDate(current.queuedAt)],
    ["Début du traitement", formatDate(current.startedAt)],
    ["Mis à jour le", formatDate(current.updatedAt)],
    ["Shopify terminé le", formatDate(current.shopifyDoneAt)],
    ["Contact terminé le", formatDate(current.contactDoneAt)],
    ["LinkedIn terminé le", formatDate(current.linkedinDoneAt)],
    ["Technique terminé le", formatDate(current.technicalDoneAt)],
    ["Lighthouse terminé le", formatDate(current.lighthouseDoneAt)],
    ["Import terminé le", formatDate(current.completedAt)],
    ["Dernière erreur", current.lastError || "—"],
  ];
});

async function loadUrlAnalysisDetails(current: ImportDetail) {
  const requestId = ++urlAnalysisRequestId;
  urlAnalysisError.value = "";

  try {
    const rows = await $fetch<UrlAnalysisDetail[]>(
      `${runtimeConfig.public.apiUrl}/imports/${current.id}/urls`,
    );

    if (requestId !== urlAnalysisRequestId) {
      return;
    }

    urlAnalysisDetails.value = rows;
  } catch (error) {
    if (requestId !== urlAnalysisRequestId) {
      return;
    }

    urlAnalysisError.value =
      error instanceof Error
        ? error.message
        : "Impossible de charger les détails d’analyse.";
    urlAnalysisDetails.value = [];
  }
}

const importUrls = computed(() => {
  const current = data.value;
  if (!current) {
    return [];
  }

  return current.urls.map((url, index) => ({
    url,
    id: current.urlIds[index] || null,
    state:
      current.currentUrlId && current.urlIds[index] === current.currentUrlId
        ? "running"
        : current.urlStates?.[index]?.state || "pending",
    detail: urlAnalysisDetails.value[index] || null,
  }));
});

const urlAnalysisRows = computed(() => {
  const current = data.value;
  if (!current) {
    return [];
  }

  return importUrls.value
    .map((item, index) => {
      const detail = item.detail;
      const isMissing = Boolean(detail?.missing);
      const state: UrlAnalysisState = isMissing
        ? "missing"
        : item.state || "pending";

      return {
        ...item,
        state,
        index,
        title: detail?.siteName || item.url,
        summary: detail
          ? [
              detail.missing ? "URL introuvable" : null,
              detail.shopifyStatus !== "unknown"
                ? `Shopify: ${getShopifyStatusLabel(detail.shopifyStatus)}`
                : null,
              detail.contactStatus !== "unknown"
                ? `Contact: ${detail.contactStatus}`
                : null,
              detail.lighthouseScore != null
                ? `Lighthouse: ${detail.lighthouseScore}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : null,
      };
    })
    .filter((row) => !row.detail?.blacklistedAt);
});

const urlAnalysisCounts = computed(() => {
  const current = data.value;
  if (!current) {
    return {
      done: 0,
      running: 0,
      missing: 0,
      pending: 0,
      total: 0,
      progress: 0,
    };
  }

  const rows = urlAnalysisRows.value;
  const done = rows.filter((row) => row.state === "done").length;
  const running = rows.filter((row) => row.state === "running").length;
  const missing = rows.filter((row) => row.state === "missing").length;
  const pending = rows.filter(
    (row) => row.state === "pending" || row.state === "missing",
  ).length;
  const total = rows.length;
  const progress =
    total > 0 ? Math.round(((done + running * 0.5) / total) * 100) : 0;

  return {
    done,
    running,
    missing,
    pending,
    total,
    progress,
  };
});
const showPendingRescanPrompt = computed(
  () =>
    isInterruptedImport.value &&
    hasPendingRescanRows.value &&
    urlAnalysisCounts.value.running === 0 &&
    !pendingRescanTriggered.value,
);

watch(
  () => data.value?.urlIds.join(",") ?? "",
  () => {
    const current = data.value;
    if (!current) {
      urlAnalysisDetails.value = [];
      urlAnalysisError.value = "";
      return;
    }

    void loadUrlAnalysisDetails(current);
  },
  { immediate: true },
);

watch(
  [shouldAutoOpenPendingRescan, hasPendingRescanRows, () => data.value?.id],
  ([shouldAutoOpen, hasPendingRows, importIdValue]) => {
    if (
      !shouldAutoOpen ||
      !hasPendingRows ||
      !importIdValue ||
      rescanOpen.value
    ) {
      return;
    }

    openPendingOnlyRescanModal();
    void consumePendingRescanQuery();
  },
  { immediate: true },
);

const shouldRefresh = computed(() => {
  const current = data.value;
  return Boolean(current && ["queued", "processing"].includes(current.status));
});

function closeImportEvents() {
  if (importEventsSource) {
    importEventsSource.close();
    importEventsSource = null;
  }
}

function applyImportEventPayload(payload: unknown) {
  const nextPayload = payload as {
    import?: ImportDetail;
    prospects?: ImportContactsSummaryResponse;
    urls?: UrlAnalysisDetail[];
  } | null;
  const nextImport = nextPayload?.import;
  if (!nextImport) {
    return;
  }

  if (!["error"].includes(nextImport.status)) {
    pendingRescanTriggered.value = false;
  }

  data.value = nextImport;
  if (nextPayload?.prospects) {
    importContacts.value = nextPayload.prospects;
  }
  if (Array.isArray(nextPayload?.urls)) {
    urlAnalysisDetails.value = nextPayload.urls;
    urlAnalysisError.value = "";
  }

  triggerLiveRefreshAnimation();

  if (!["queued", "processing"].includes(nextImport.status)) {
    closeImportEvents();
  }
}

function handleImportEventMessage(event: MessageEvent) {
  try {
    applyImportEventPayload(JSON.parse(event.data));
  } catch {
    // Ignore malformed stream payloads and keep the live connection open.
  }
}

function startImportEvents() {
  closeImportEvents();

  if (
    !isClientReady.value ||
    !shouldRefresh.value ||
    typeof EventSource === "undefined"
  ) {
    return;
  }

  importEventsSource = new EventSource(
    `${runtimeConfig.public.apiUrl}/imports/${importId.value}/events`,
  );
  importEventsSource.onmessage = handleImportEventMessage;

  for (const eventName of [
    "import.snapshot",
    "import.url.started",
    "import.url.completed",
    "import.url.failed",
    "import.completed",
  ]) {
    importEventsSource.addEventListener(eventName, handleImportEventMessage);
  }
}

onMounted(() => {
  isClientReady.value = true;
  startImportEvents();
});

watch(shouldRefresh, () => {
  if (!isClientReady.value) {
    return;
  }

  if (shouldRefresh.value) {
    startImportEvents();
  } else {
    closeImportEvents();
  }
});

onBeforeUnmount(() => {
  closeImportEvents();
  if (liveRefreshTimer) {
    clearTimeout(liveRefreshTimer);
    liveRefreshTimer = null;
  }
});
</script>

<template>
  <main class="min-h-screen bg-background text-slate-900">
    <section class="w-full px-5 py-6 lg:px-8">
      <div class="mx-auto max-w-5xl space-y-4">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-2">
            <p
              class="text-[11px] font-medium uppercase tracking-[0.18em] text-sky-700"
            >
              Import
            </p>
            <h1 class="page-title">Détail de l’import #{{ importId }}</h1>
            <p class="max-w-2xl body-muted">
              Résumé du lot importé, du traitement en file et des étapes déjà
              passées.
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            <UButton
              color="neutral"
              variant="soft"
              :disabled="pending && !data"
              class="inline-flex items-center gap-2"
              @click="refreshImportPage"
            >
              <UIcon
                name="i-lucide-refresh-cw"
                class="h-4 w-4"
                :class="isRefreshAnimated ? 'animate-spin' : ''"
              />
              <span>{{
                isRefreshing ? "Actualisation..." : "Rafraîchir"
              }}</span>
            </UButton>
            <UButton
              to="/add-prospects"
              color="neutral"
              variant="soft"
              icon="i-lucide-plus-circle"
            >
              Nouvel import
            </UButton>
            <UButton
              v-if="canTrashImport"
              color="error"
              variant="outline"
              icon="i-lucide-trash-2"
              :loading="trashingImport"
              @click="trashImport($event)"
            >
              Mettre à la corbeille
            </UButton>
            <UButton
              v-if="canRescanImport"
              color="primary"
              variant="solid"
              icon="i-lucide-rotate-ccw"
              @click="openRescanModal"
            >
              Rescanner l’import
            </UButton>
          </div>
        </div>

        <section
          v-if="error"
          class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-sm"
        >
          <div
            class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p class="text-xs font-semibold">Import introuvable</p>
              <p class="mt-1 text-xs">
                {{ error.message || "Impossible de charger cet import." }}
              </p>
            </div>

            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-refresh-cw"
              @click="refreshImportPage"
            >
              Réessayer
            </UButton>
          </div>
        </section>

        <section
          v-else
          class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div v-if="isInitialLoading" class="text-muted-sm">
            Chargement de l’import...
          </div>

          <template v-else-if="data">
            <div
              v-if="showPendingRescanPrompt"
              class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"
            >
              <div class="space-y-1">
                <p class="font-medium">Import interrompu</p>
                <p class="text-amber-800">
                  Il reste {{ rescanNeverScannedRows.length }} URL(s) non
                  scannée(s). On peut relancer uniquement celles-ci.
                </p>
              </div>
              <UButton
                color="primary"
                variant="solid"
                icon="i-lucide-rotate-ccw"
                @click="openPendingOnlyRescanModal"
              >
                Relancer les URLs non scannées
              </UButton>
            </div>

            <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div class="space-y-5">
                <ImportUrlsList :rows="urlAnalysisRows" />
              </div>

              <div class="space-y-4">
                <ImportAnalysisSummary
                  :done="urlAnalysisCounts.done"
                  :running="urlAnalysisCounts.running"
                  :pending="urlAnalysisCounts.pending"
                  :total="urlAnalysisCounts.total"
                  :total-urls="data.totalUrls"
                  :existing-urls="data.existingUrls"
                  :error="urlAnalysisError"
                />

                <ImportContactsSummary
                  :total="importContacts?.total || 0"
                  :contacts="importContacts?.prospects || []"
                  :error="importContactsError"
                />
              </div>
            </div>

            <section
              class="mt-5 rounded-xl border border-slate-200 bg-white p-5 hidden"
            >
              <div
                class="text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                Détails de l’import
              </div>

              <div
                class="mt-4 overflow-hidden rounded-lg border border-slate-200"
              >
                <table class="w-full text-left text-xs">
                  <tbody class="divide-y divide-slate-200">
                    <tr v-for="[label, value] in summaryRows" :key="label">
                      <th
                        class="w-56 bg-slate-50 px-4 py-3 font-medium text-slate-500"
                      >
                        {{ label }}
                      </th>
                      <td class="px-4 py-3 text-slate-900">
                        {{ value }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </template>
        </section>
      </div>
    </section>

    <UModal
      v-model:open="rescanOpen"
      title="Rescanner l’import"
      description="Sélectionne les URLs à rescanner. Les URLs déjà scannées peuvent être relancées si besoin."
      portal="body"
      :ui="{
        content:
          'fixed left-1/2 top-1/2 z-50 w-[min(92vw,48rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white shadow-2xl',
      }"
    >
      <template #body>
        <div class="space-y-5 px-1 pb-1 pt-2">
          <UAlert
            v-if="rescanError"
            color="error"
            variant="soft"
            icon="i-lucide-alert-circle"
            :title="rescanError"
          />

          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="text-xs text-slate-600">
              {{ rescanSelectedIds.length }} URL(s) sélectionnée(s)
            </div>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-if="hasNeverScannedRows"
                color="neutral"
                variant="soft"
                size="sm"
                @click="selectNeverScannedRescanUrls"
              >
                Jamais scannées
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                size="sm"
                @click="selectAllRescanUrls"
              >
                Tout sélectionner
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                size="sm"
                @click="deselectAllRescanUrls"
              >
                Tout désélectionner
              </UButton>
            </div>
          </div>

          <div
            class="max-h-[24rem] space-y-2 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3"
          >
            <label
              v-for="item in rescanSelectableRows"
              :key="item.id || item.url"
              class="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent bg-white px-3 py-2 transition hover:border-slate-200"
              :class="item.state === 'running' ? 'ring-2 ring-sky-100' : ''"
            >
              <input
                v-model="rescanSelectedIds"
                type="checkbox"
                :value="item.id"
                class="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                :disabled="rescanLoading || !item.id"
              />
              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex items-center gap-2">
                  <span class="truncate text-xs font-medium text-slate-900">{{
                    item.url
                  }}</span>
                  <UBadge
                    :color="
                      item.state === 'done'
                        ? 'success'
                        : item.state === 'running'
                          ? 'primary'
                          : 'neutral'
                    "
                    variant="soft"
                  >
                    {{
                      item.state === "done"
                        ? "Scannée"
                        : item.state === "running"
                          ? "En cours"
                          : "À rescanner"
                    }}
                  </UBadge>
                </div>
                <p v-if="item.summary" class="truncate text-xs text-slate-500">
                  {{ item.summary }}
                </p>
              </div>
            </label>

            <div
              v-if="rescanSelectableRows.length === 0"
              class="px-3 py-8 text-center text-muted-sm"
            >
              Aucune URL disponible à rescanner.
            </div>
          </div>

          <div class="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <UButton
              type="button"
              color="neutral"
              variant="soft"
              :disabled="rescanLoading"
              @click="rescanOpen = false"
            >
              Annuler
            </UButton>
            <UButton
              type="button"
              color="primary"
              icon="i-lucide-rotate-ccw"
              :loading="rescanLoading"
              :disabled="rescanSelectedIds.length === 0"
              @click="submitRescanImport"
            >
              Rescanner
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </main>
</template>
