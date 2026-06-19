<script setup lang="ts">
import type { MaintenanceCsvImportPayload } from "~/types/maintenance";
import type { MaintenanceSummaryItem } from "~/types/maintenance";

const {
  purgeMaintenanceTable,
  purgeMaintenanceTarget,
  unlinkKeywordGroupRelations,
  purgeTrash,
  useMaintenanceSummary,
} = useMaintenance();
const { showInfoToast } = useAppToast();
const { data: summary, error, status, refresh } = await useMaintenanceSummary();

const pendingAction = ref<string | null>(null);
const isCsvImportModalOpen = ref(false);
const isCsvExportModalOpen = ref(false);

const actionLabels: Record<MaintenanceSummaryItem["action"], string> = {
  "purge-trash": "Vider la corbeille",
  "clear-cache": "Vider le cache",
  "clear-keyword-templates": "Vider les templates",
  "unlink-group-relations": "Supprimer les relations",
  none: "Aucune action",
};

function getDescription(item: MaintenanceSummaryItem) {
  if (item.action === "purge-trash") {
    return `${item.trashedCount ?? 0} élément(s) actuellement dans la corbeille.`;
  }

  if (item.action === "clear-cache") {
    return `${item.totalCount} entrée(s) actuellement en cache.`;
  }

  if (item.action === "clear-keyword-templates") {
    return `${item.totalCount} mot-clé(s) ont actuellement un template défini.`;
  }

  if (item.action === "unlink-group-relations") {
    return `${item.totalCount} groupe(s) actuellement relié(s) à un parent.`;
  }

  return "Aucune action de nettoyage dédiée pour ce modèle.";
}

function handleCsvImport(payload: MaintenanceCsvImportPayload) {
  isCsvImportModalOpen.value = false;
  showInfoToast(
    "Import CSV préparé",
    `${payload.targets.length} table(s) sélectionnée(s) pour ${payload.file.name}.`,
  );
}

function confirmMaintenanceAction(item: MaintenanceSummaryItem) {
  if (item.action === "none") {
    return false;
  }

  return window.confirm(
    `Voulez-vous vraiment ${actionLabels[item.action].toLowerCase()} pour "${item.label}" ?`,
  );
}

async function runMaintenanceAction(item: MaintenanceSummaryItem) {
  if (item.action === "none" || pendingAction.value) {
    return;
  }

  if (!confirmMaintenanceAction(item)) {
    return;
  }

  pendingAction.value = `action:${item.key}`;

  try {
    await purgeMaintenanceTarget(item.key);
    await refresh();
  } catch (actionError) {
    console.error(actionError);
  } finally {
    pendingAction.value = null;
  }
}

async function runPurgeTrash() {
  if (pendingAction.value) {
    return;
  }

  if (!window.confirm("Voulez-vous vraiment vider toute la corbeille ?")) {
    return;
  }

  pendingAction.value = "purge-trash-all";

  try {
    await purgeTrash();
    await refresh();
  } catch (actionError) {
    console.error(actionError);
  } finally {
    pendingAction.value = null;
  }
}

async function runPurgeTable(item: MaintenanceSummaryItem) {
  if (!item.tablePurgeable || pendingAction.value) {
    return;
  }

  if (
    !window.confirm(`Voulez-vous vraiment purger la table "${item.label}" ?`)
  ) {
    return;
  }

  pendingAction.value = `table:${item.key}`;

  try {
    await purgeMaintenanceTable(item.key);
    await refresh();
  } catch (actionError) {
    console.error(actionError);
  } finally {
    pendingAction.value = null;
  }
}

async function runUnlinkGroupRelations(item: MaintenanceSummaryItem) {
  if (pendingAction.value || item.action !== "unlink-group-relations") {
    return;
  }

  if (
    !window.confirm(
      "Voulez-vous vraiment supprimer toutes les relations parent/enfant des groupes ? Les groupes et leurs mots-clés resteront inchangés.",
    )
  ) {
    return;
  }

  pendingAction.value = "unlink-group-relations";

  try {
    await unlinkKeywordGroupRelations();
    await refresh();
  } catch (actionError) {
    console.error(actionError);
  } finally {
    pendingAction.value = null;
  }
}

const hasTrashedItems = computed(
  () =>
    summary?.items?.some(
      (item) => item.action === "purge-trash" && (item.trashedCount ?? 0) > 0,
    ) ?? false,
);

const trashedItemsCount = computed(
  () =>
    summary?.items?.reduce((total, item) => {
      if (item.action !== "purge-trash") {
        return total;
      }

      return total + (item.trashedCount ?? 0);
    }, 0) ?? 0,
);

const destructiveTableTargets = new Set([
  "keyword-groups",
  "subject",
  "keyword",
  "internal-link",
  "page",
  "app-setting",
  "dataforseo-cache",
  "openai-cache",
]);

const keywordGroupRelationsItem = computed(() =>
  summary?.items?.find((item) => item.key === "keyword-group-relations") ?? null,
);
</script>

<template>
  <section class="space-y-6">
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold text-slate-900">
          Corbeille et caches
        </h1>
        <p class="text-sm text-slate-500">
          Actions de nettoyage pour les modèles Prisma et les caches techniques.
        </p>
      </div>

      <div class="flex gap-3">
        <UButton
          color="error"
          variant="solid"
          icon="i-lucide-trash-2"
          :loading="pendingAction === 'purge-trash-all'"
          :disabled="!hasTrashedItems || !!pendingAction"
          @click="runPurgeTrash"
        >
          Vider la corbeille
          <UBadge
            variant="soft"
            color="neutral"
            class="ml-2 bg-white/20 text-white"
          >
            {{ trashedItemsCount }}
          </UBadge>
        </UButton>

        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-file-up"
          :disabled="!!pendingAction"
          @click="isCsvImportModalOpen = true"
        >
          Importer un CSV
        </UButton>

        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-file-down"
          :disabled="!!pendingAction"
          @click="isCsvExportModalOpen = true"
        >
          Exporter un CSV
        </UButton>
      </div>
    </div>

    <article
      v-if="keywordGroupRelationsItem"
      class="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
    >
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="space-y-1">
          <p class="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Relations de groupes
          </p>
          <h2 class="text-lg font-semibold text-slate-900">
            Supprimer les liens parent / enfant
          </h2>
          <p class="text-sm text-slate-600">
            {{ getDescription(keywordGroupRelationsItem) }}
          </p>
        </div>

        <UButton
          color="error"
          variant="solid"
          icon="i-lucide-link-2-off"
          :loading="pendingAction === 'unlink-group-relations'"
          :disabled="!keywordGroupRelationsItem.totalCount || !!pendingAction"
          @click="runUnlinkGroupRelations(keywordGroupRelationsItem)"
        >
          Supprimer les relations
        </UButton>
      </div>
    </article>

    <FeedbackLoadingMessage v-if="status === 'pending'">
      Chargement des données de maintenance...
    </FeedbackLoadingMessage>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :details="error.toString()"
      title="Impossible de charger la maintenance"
      description="Les données de maintenance n'ont pas pu être récupérées."
    />

    <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="item in summary?.items ?? []"
        :key="item.key"
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div class="space-y-1">
          <p
            class="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            {{ item.label }}
          </p>
          <p class="text-2xl font-semibold text-slate-900">
            {{ item.totalCount }}
          </p>
          <p class="text-sm text-slate-500">
            {{ getDescription(item) }}
          </p>
        </div>

        <div class="mt-4">
          <div class="flex flex-wrap gap-2">
            <UButton
              :color="item.action === 'none' ? 'neutral' : 'error'"
              :variant="item.action === 'none' ? 'soft' : 'solid'"
              :disabled="
                item.action === 'none' ||
                pendingAction === `action:${item.key}` ||
                (item.action === 'purge-trash' && !(item.trashedCount ?? 0)) ||
                (item.action === 'clear-cache' && !item.totalCount) ||
                (item.action === 'clear-keyword-templates' && !item.totalCount)
              "
              :loading="pendingAction === `action:${item.key}`"
              @click="runMaintenanceAction(item)"
            >
              {{ actionLabels[item.action] }}
            </UButton>

            <UButton
              color="error"
              variant="soft"
              icon="i-lucide-trash-2"
              :disabled="
                !item.tablePurgeable || !item.totalCount || !!pendingAction
              "
              :loading="pendingAction === `table:${item.key}`"
              @click="runPurgeTable(item)"
            >
              Purger la table
            </UButton>
          </div>

          <p
            v-if="destructiveTableTargets.has(item.key)"
            class="mt-2 text-xs leading-5 text-amber-600"
          >
            Cette table peut contenir des données utilisées par d’autres écrans.
          </p>
        </div>
      </article>
    </div>

    <SettingsMaintenanceCsvImportModal
      v-model:open="isCsvImportModalOpen"
      :items="summary?.items ?? []"
      @import="handleCsvImport"
    />

    <SettingsMaintenanceCsvExportModal
      v-model:open="isCsvExportModalOpen"
      :items="summary?.items ?? []"
    />
  </section>
</template>
