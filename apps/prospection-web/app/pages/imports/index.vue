<script setup lang="ts">
import type { ImportListItem } from "~/types/imports";

const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();
const trashingImportId = ref<number | null>(null);
const trashingAllImports = ref(false);
const interruptedImportMessage =
  "Import interrompu: aucune tâche restante dans la queue.";
const isClientReady = ref(false);
let importsEventsSource: EventSource | null = null;

const { data, pending, error, refresh } = await useFetch<ImportListItem[]>(
  () => `${runtimeConfig.public.apiUrl}/imports`,
  {
    default: () => [],
  },
);

function openImportDetail(id: number) {
  void navigateTo(`/imports/${id}`);
}

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

function getProgressValue(item: ImportListItem) {
  const counts = item.urlAnalysisCounts;
  if (!counts || counts.total <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((counts.done / counts.total) * 100));
}

function getProgressCounts(item: ImportListItem) {
  const counts = item.urlAnalysisCounts;
  if (counts) {
    return counts;
  }

  const done = Math.max(0, Math.min(item.processedUrls, item.queuedUrls));
  const running =
    item.status === "processing" && done < item.queuedUrls ? 1 : 0;
  const pending = Math.max(0, item.queuedUrls - done - running);

  return {
    done,
    running,
    pending,
    total: item.queuedUrls,
  };
}

function getProgressSegmentStyle(value: number) {
  if (value <= 0) {
    return {
      flexGrow: 0,
      flexBasis: "0px",
      minWidth: "0px",
    };
  }

  return {
    flexGrow: value,
    flexBasis: "0px",
    minWidth: "2rem",
  };
}

const importsList = computed(() => data.value || []);
const deletableImports = computed(() =>
  importsList.value.filter(
    (item) => !["queued", "processing"].includes(item.status),
  ),
);

const isInitialLoading = computed(
  () => pending.value && importsList.value.length === 0,
);
const shouldListenToEvents = computed(
  () => isClientReady.value && typeof EventSource !== "undefined",
);

function canTrashImport(item: ImportListItem) {
  return !["queued", "processing"].includes(item.status);
}

function isInterruptedImport(item: ImportListItem) {
  return (
    item.status === "error" &&
    Boolean(item.lastError?.includes(interruptedImportMessage))
  );
}

function stopImportsEvents() {
  if (importsEventsSource) {
    importsEventsSource.close();
    importsEventsSource = null;
  }
}

function applyImportsEvent(event: MessageEvent) {
  try {
    const payload = JSON.parse(event.data) as
      | { imports?: ImportListItem[] }
      | { import?: ImportListItem }
      | null;

    if (payload && "imports" in payload && Array.isArray(payload.imports)) {
      data.value = payload.imports;
      return;
    }

    if (payload && "import" in payload && payload.import) {
      const nextImport = payload.import;
      const currentImports = data.value || [];
      const nextImports = currentImports.some(
        (item) => item.id === nextImport.id,
      )
        ? currentImports.map((item) =>
            item.id === nextImport.id ? nextImport : item,
          )
        : [nextImport, ...currentImports];

      data.value = nextImports;
      return;
    }
  } catch {
    // Ignore malformed payloads and keep the current list unchanged.
  }
}

function startImportsEvents() {
  stopImportsEvents();

  if (!shouldListenToEvents.value) {
    return;
  }

  importsEventsSource = new EventSource(
    `${runtimeConfig.public.apiUrl}/imports/events`,
  );
  importsEventsSource.onmessage = applyImportsEvent;
  for (const eventName of [
    "imports.snapshot",
    "import.snapshot",
    "import.url.started",
    "import.url.completed",
    "import.url.failed",
    "import.completed",
  ]) {
    importsEventsSource.addEventListener(eventName, applyImportsEvent);
  }
}

async function trashImport(item: ImportListItem, event?: MouseEvent) {
  if (!canTrashImport(item) || trashingImportId.value === item.id) {
    return;
  }

  if (!event?.shiftKey) {
    const confirmed = window.confirm(
      `Mettre l’import #${item.id} à la corbeille ?`,
    );
    if (!confirmed) {
      return;
    }
  }

  trashingImportId.value = item.id;

  try {
    await $fetch(`${runtimeConfig.public.apiUrl}/imports/${item.id}/trash`, {
      method: "DELETE",
    });

    data.value = (data.value || []).filter((current) => current.id !== item.id);
    notifications.add({
      kind: "success",
      title: "Import mis à la corbeille",
      message: `Import #${item.id}`,
    });
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
    trashingImportId.value = null;
  }
}

async function trashAllImports(event?: MouseEvent) {
  if (trashingAllImports.value || deletableImports.value.length === 0) {
    return;
  }

  const trashableCount = deletableImports.value.length;
  if (!event?.shiftKey) {
    const confirmed = window.confirm(
      `Mettre ${trashableCount} import(s) terminé(s) à la corbeille ?`,
    );
    if (!confirmed) {
      return;
    }
  }

  trashingAllImports.value = true;

  try {
    for (const item of deletableImports.value) {
      await $fetch(`${runtimeConfig.public.apiUrl}/imports/${item.id}/trash`, {
        method: "DELETE",
      });
    }

    data.value = (data.value || []).filter(
      (item) => canTrashImport(item) === false,
    );
    notifications.add({
      kind: "success",
      title: "Imports mis à la corbeille",
      message: `${trashableCount} import(s) ont été déplacé(s) vers la corbeille.`,
    });
    await refresh();
  } catch (error) {
    notifications.add({
      kind: "error",
      title: "Mise à la corbeille échouée",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de mettre tous les imports à la corbeille.",
    });
  } finally {
    trashingAllImports.value = false;
  }
}

onMounted(() => {
  isClientReady.value = true;
  startImportsEvents();
});

onBeforeUnmount(() => {
  stopImportsEvents();
});
</script>

<template>
  <LayoutPageShell
    eyebrow="Imports"
    title="Tous les imports"
    description="Les lots présents ici affichent leur progression et peuvent être envoyés à la corbeille depuis cette page."
    max-width="6xl"
  >
    <template #actions>
      <UButton
        to="/add-prospects"
        color="neutral"
        variant="soft"
        icon="i-lucide-plus-circle"
      >
        Nouvel import
      </UButton>
      <UButton
        color="error"
        variant="outline"
        icon="i-lucide-trash-2"
        :disabled="deletableImports.length === 0"
        :loading="trashingAllImports"
        @click="trashAllImports($event)"
      >
        Tout mettre à la corbeille
      </UButton>
    </template>

    <section
      v-if="error"
      class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-sm"
    >
      <div
        class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p class="text-xs font-semibold">Impossible de charger les imports</p>
          <p class="mt-1 text-xs">
            {{
              error.message || "Une erreur est survenue pendant le chargement."
            }}
          </p>
        </div>

        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-refresh-cw"
          @click="refresh"
        >
          Réessayer
        </UButton>
      </div>
    </section>

    <section v-else>
      <div
        v-if="isInitialLoading"
        class="rounded-xl border border-slate-200 bg-white p-5 text-muted-sm shadow-sm"
      >
        Chargement des imports...
      </div>

      <div
        v-else-if="importsList.length === 0"
        class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm"
      >
        <div class="mx-auto flex max-w-md flex-col items-center gap-3">
          <div
            class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200"
          >
            <UIcon name="i-lucide-inbox" class="h-5 w-5" />
          </div>
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-slate-900">Aucun import</h2>
            <p class="body-muted">
              Dès qu’un import est lancé, il apparaîtra ici avec sa progression.
            </p>
          </div>
          <UButton
            to="/add-prospects"
            color="primary"
            variant="solid"
            icon="i-lucide-plus-circle"
          >
            Lancer un import
          </UButton>
        </div>
      </div>

      <div v-else class="grid gap-4">
        <div
          v-for="item in importsList"
          :key="item.id"
          role="link"
          tabindex="0"
          class="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          @click="openImportDetail(item.id)"
          @keydown.enter.prevent="openImportDetail(item.id)"
          @keydown.space.prevent="openImportDetail(item.id)"
        >
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="inline-flex h-8 w-8 items-center justify-center rounded-full ring-1"
                  :class="
                    item.status === 'queued' || item.status === 'processing'
                      ? 'bg-sky-50 text-sky-700 ring-sky-200'
                      : 'bg-slate-100 text-slate-700 ring-slate-200'
                  "
                >
                  <UIcon
                    :name="
                      item.status === 'queued' || item.status === 'processing'
                        ? 'i-lucide-loader-circle'
                        : 'i-lucide-archive'
                    "
                    class="h-4 w-4"
                    :class="
                      item.status === 'queued' || item.status === 'processing'
                        ? 'animate-spin'
                        : ''
                    "
                  />
                </span>
                <div>
                  <p
                    class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500"
                  >
                    Import #{{ item.id }}
                  </p>
                  <h2 class="text-lg font-semibold text-slate-900">
                    {{ item.sourceFile }}
                  </h2>
                </div>
              </div>

              <p class="max-w-3xl body-muted">
                {{ getStatusLabel(item.status) }} · {{ item.currentStep }}
              </p>
            </div>

            <div class="flex items-center gap-2">
              <div
                class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600"
              >
                {{ getProgressCounts(item).done }}/{{
                  getProgressCounts(item).total
                }}
                URL(s) traitée(s)
              </div>
              <UButton
                :to="`/imports/${item.id}`"
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-arrow-right"
                @click.stop
              >
                Ouvrir
              </UButton>
              <UButton
                color="error"
                variant="outline"
                size="xs"
                icon="i-lucide-trash-2"
                :disabled="!canTrashImport(item)"
                :loading="trashingImportId === item.id"
                @click.stop="trashImport(item, $event)"
              >
                Supprimer
              </UButton>
            </div>
          </div>

          <div class="mt-4 space-y-2">
            <div
              class="flex items-center justify-between text-xs font-medium text-slate-500"
            >
              <span>Progression</span>
              <span>{{ getProgressValue(item) }}%</span>
            </div>
            <div
              class="flex h-6 overflow-hidden rounded-full bg-slate-100 text-[11px] font-semibold text-white"
            >
              <div
                class="flex h-full items-center justify-center overflow-hidden bg-emerald-500 transition-[width] duration-500"
                :style="getProgressSegmentStyle(getProgressCounts(item).done)"
                title="Scannées"
              >
                <span class="truncate px-1">{{
                  getProgressCounts(item).done
                }}</span>
              </div>
              <div
                class="flex h-full items-center justify-center overflow-hidden bg-sky-500 transition-[width] duration-500"
                :style="
                  getProgressSegmentStyle(getProgressCounts(item).running)
                "
                title="En cours"
              >
                <span class="truncate px-1">{{
                  getProgressCounts(item).running
                }}</span>
              </div>
              <div
                class="flex h-full items-center justify-center overflow-hidden bg-slate-300 text-slate-700 transition-[width] duration-500"
                :style="
                  getProgressSegmentStyle(getProgressCounts(item).pending)
                "
                title="En attente"
              >
                <span class="truncate px-1">{{
                  getProgressCounts(item).pending
                }}</span>
              </div>
            </div>
          </div>

          <div
            class="mt-4 grid gap-3 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div>
              <div class="uppercase tracking-wide">Fichier</div>
              <div class="mt-1 text-xs font-medium text-slate-900">
                {{ item.sourceFile }}
              </div>
            </div>
            <div>
              <div class="uppercase tracking-wide">Créé le</div>
              <div class="mt-1 text-xs font-medium text-slate-900">
                {{ formatDate(item.createdAt) }}
              </div>
            </div>
            <div>
              <div class="uppercase tracking-wide">Mise en file</div>
              <div class="mt-1 text-xs font-medium text-slate-900">
                {{ formatDate(item.queuedAt) }}
              </div>
            </div>
            <div>
              <div class="uppercase tracking-wide">Dernière mise à jour</div>
              <div class="mt-1 text-xs font-medium text-slate-900">
                {{ formatDate(item.updatedAt) }}
              </div>
            </div>
          </div>

          <div
            v-if="item.lastError"
            class="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="min-w-0 flex-1">
                {{ item.lastError }}
              </p>
              <UButton
                v-if="isInterruptedImport(item)"
                :to="`/imports/${item.id}?rescan=pending`"
                color="warning"
                variant="soft"
                size="xs"
                icon="i-lucide-rotate-ccw"
                @click.stop
              >
                Relancer les URL non scannées
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  </LayoutPageShell>
</template>
