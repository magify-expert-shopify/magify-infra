<script setup lang="ts">
import type {
  TrashedImportItem,
  TrashedProspectItem,
  TrashedUrlItem,
} from "~/types/trash";

const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();
const restoringUrlId = ref<number | null>(null);
const restoringProspectId = ref<number | null>(null);
const deletingUrlId = ref<number | null>(null);
const deletingProspectId = ref<number | null>(null);
const deletingImportId = ref<number | null>(null);
const emptyingTrash = ref(false);

function openImportDetail(id: number) {
  void navigateTo(`/imports/${id}`);
}

const {
  data: trashedUrls,
  pending: urlsPending,
  error: urlsError,
  refresh: refreshUrls,
} = await useFetch<TrashedUrlItem[]>(
  () => `${runtimeConfig.public.apiUrl}/urls/trash`,
  {
    default: () => [],
  },
);

const {
  data: trashedProspects,
  pending: prospectsPending,
  error: prospectsError,
  refresh: refreshProspects,
} = await useFetch<TrashedProspectItem[]>(
  () => `${runtimeConfig.public.apiUrl}/prospects/trash`,
  {
    default: () => [],
  },
);

const {
  data: trashedImports,
  pending: importsPending,
  error: importsError,
  refresh: refreshImports,
} = await useFetch<TrashedImportItem[]>(
  () => `${runtimeConfig.public.apiUrl}/imports/trash`,
  {
    default: () => [],
  },
);

const isLoading = computed(
  () => urlsPending.value || prospectsPending.value || importsPending.value,
);

async function refreshTrash() {
  await Promise.all([refreshUrls(), refreshProspects(), refreshImports()]);
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function restoreUrl(item: TrashedUrlItem) {
  if (restoringUrlId.value === item.id) {
    return;
  }

  restoringUrlId.value = item.id;

  try {
    await $fetch(`${runtimeConfig.public.apiUrl}/urls/${item.id}/restore`, {
      method: "PATCH",
    });

    trashedUrls.value = (trashedUrls.value || []).filter(
      (url) => url.id !== item.id,
    );
    notifications.add({
      kind: "success",
      title: "URL restaurée",
      message: item.url,
    });
  } catch (error) {
    notifications.add({
      kind: "error",
      title: "Restauration URL échouée",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de restaurer cette URL.",
    });
  } finally {
    restoringUrlId.value = null;
  }
}

async function restoreProspect(item: TrashedProspectItem) {
  if (restoringProspectId.value === item.id) {
    return;
  }

  restoringProspectId.value = item.id;

  try {
    await $fetch(
      `${runtimeConfig.public.apiUrl}/prospects/${item.id}/restore`,
      {
        method: "PATCH",
      },
    );

    trashedProspects.value = (trashedProspects.value || []).filter(
      (prospect) => prospect.id !== item.id,
    );
    notifications.add({
      kind: "success",
      title: "Prospect restauré",
      message: item.siteName || item.name,
    });
  } catch (error) {
    notifications.add({
      kind: "error",
      title: "Restauration prospect échouée",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de restaurer ce prospect.",
    });
  } finally {
    restoringProspectId.value = null;
  }
}

async function deleteUrlPermanently(item: TrashedUrlItem, event?: MouseEvent) {
  if (deletingUrlId.value === item.id) {
    return;
  }

  const shiftPressed = Boolean(event?.shiftKey);
  if (!shiftPressed) {
    const confirmed = window.confirm(
      `Supprimer définitivement l’URL "${item.url}" ? Cette action est irréversible.`,
    );
    if (!confirmed) {
      return;
    }
  }

  deletingUrlId.value = item.id;

  try {
    await $fetch(`${runtimeConfig.public.apiUrl}/urls/${item.id}/permanent`, {
      method: "DELETE",
    });

    trashedUrls.value = (trashedUrls.value || []).filter(
      (url) => url.id !== item.id,
    );
    notifications.add({
      kind: "success",
      title: "URL supprimée définitivement",
      message: item.url,
    });
  } catch (error) {
    notifications.add({
      kind: "error",
      title: "Suppression URL échouée",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de supprimer définitivement cette URL.",
    });
  } finally {
    deletingUrlId.value = null;
  }
}

async function deleteProspectPermanently(
  item: TrashedProspectItem,
  event?: MouseEvent,
) {
  if (deletingProspectId.value === item.id) {
    return;
  }

  const shiftPressed = Boolean(event?.shiftKey);
  if (!shiftPressed) {
    const confirmed = window.confirm(
      `Supprimer définitivement le prospect "${item.siteName}" ? Cette action est irréversible.`,
    );
    if (!confirmed) {
      return;
    }
  }

  deletingProspectId.value = item.id;

  try {
    await $fetch(
      `${runtimeConfig.public.apiUrl}/prospects/${item.id}/permanent`,
      {
        method: "DELETE",
      },
    );

    trashedProspects.value = (trashedProspects.value || []).filter(
      (prospect) => prospect.id !== item.id,
    );
    notifications.add({
      kind: "success",
      title: "Prospect supprimé définitivement",
      message: item.siteName || item.name,
    });
  } catch (error) {
    notifications.add({
      kind: "error",
      title: "Suppression prospect échouée",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de supprimer définitivement ce prospect.",
    });
  } finally {
    deletingProspectId.value = null;
  }
}

function getImportProgress(item: TrashedImportItem) {
  if (item.queuedUrls <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.round((item.processedUrls / item.queuedUrls) * 100),
  );
}

function getImportStatusLabel(status: string) {
  if (status === "queued") return "En file";
  if (status === "processing") return "En cours";
  if (status === "completed") return "Terminé";
  if (status === "completed_with_errors") return "Terminé avec erreurs";
  if (status === "error") return "Erreur";

  return status;
}

function getShopifyStatusLabel(value: string | null | undefined) {
  const normalized = String(value || "").toLowerCase();

  if (normalized === "shopify") return "Shopify";
  if (normalized === "not_shopify") return "Non Shopify";
  if (normalized === "error") return "Défectueux";

  return value || "—";
}

async function deleteImportPermanently(
  item: TrashedImportItem,
  event?: MouseEvent,
) {
  if (deletingImportId.value === item.id) {
    return;
  }

  const shiftPressed = Boolean(event?.shiftKey);
  if (!shiftPressed) {
    const confirmed = window.confirm(
      `Supprimer définitivement l’import #${item.id} ? Cette action est irréversible.`,
    );
    if (!confirmed) {
      return;
    }
  }

  deletingImportId.value = item.id;

  try {
    await $fetch(
      `${runtimeConfig.public.apiUrl}/imports/${item.id}/permanent`,
      {
        method: "DELETE",
      },
    );

    trashedImports.value = (trashedImports.value || []).filter(
      (importItem) => importItem.id !== item.id,
    );
    notifications.add({
      kind: "success",
      title: "Import supprimé définitivement",
      message: `Import #${item.id}`,
    });
  } catch (error) {
    notifications.add({
      kind: "error",
      title: "Suppression import échouée",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de supprimer définitivement cet import.",
    });
  } finally {
    deletingImportId.value = null;
  }
}

async function emptyTrash(event?: MouseEvent) {
  const shiftPressed = Boolean(event?.shiftKey);
  if (!shiftPressed) {
    const confirmed = window.confirm(
      "Vider toute la corbeille ? Cette action supprimera définitivement les URLs, les prospects et les imports mis à la corbeille.",
    );
    if (!confirmed) {
      return;
    }
  }

  emptyingTrash.value = true;

  try {
    const [urlsDeleted, prospectsDeleted, importsDeleted] = await Promise.all([
      $fetch<{ deleted: number }>(
        `${runtimeConfig.public.apiUrl}/urls/trash/reset`,
        {
          method: "DELETE",
          query: { confirm: "true" },
        },
      ),
      $fetch<{ deleted: number }>(
        `${runtimeConfig.public.apiUrl}/prospects/trash/reset`,
        {
          method: "DELETE",
          query: { confirm: "true" },
        },
      ),
      $fetch<{ deleted: number }>(
        `${runtimeConfig.public.apiUrl}/imports/trash/reset`,
        {
          method: "DELETE",
          query: { confirm: "true" },
        },
      ),
    ]);

    trashedUrls.value = [];
    trashedProspects.value = [];
    trashedImports.value = [];
    notifications.add({
      kind: "warning",
      title: "Corbeille vidée",
      message: `${urlsDeleted.deleted} URL(s), ${prospectsDeleted.deleted} prospect(s) et ${importsDeleted.deleted} import(s) supprimé(s) définitivement.`,
    });
  } catch (error) {
    notifications.add({
      kind: "error",
      title: "Vidage de corbeille échoué",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de vider la corbeille.",
    });
  } finally {
    emptyingTrash.value = false;
  }
}
</script>

<template>
  <LayoutPageShell
    title="Corbeille"
    description="Les éléments mis à la corbeille restent récupérables ici. La restauration remet l’entrée en circulation sans suppression définitive."
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
        to="/urls/blacklist"
        color="neutral"
        variant="outline"
        icon="i-lucide-ban"
      >
        Black list
      </UButton>
      <UButton
        to="/prospects"
        color="neutral"
        variant="outline"
        icon="i-lucide-users"
      >
        Prospects
      </UButton>
      <UButton
        to="/imports"
        color="neutral"
        variant="outline"
        icon="i-lucide-folder-clock"
      >
        Imports
      </UButton>
      <UButton
        color="neutral"
        variant="soft"
        icon="i-lucide-refresh-cw"
        :loading="isLoading"
        @click="refreshTrash()"
      >
        Rafraîchir
      </UButton>
      <UButton
        color="error"
        variant="solid"
        icon="i-lucide-trash-2"
        :loading="emptyingTrash"
        @click="emptyTrash($event)"
      >
        Vider la corbeille
      </UButton>
    </template>

    <div class="grid gap-6 xl:grid-cols-3">
      <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 px-5 py-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold text-slate-900">URLs</h2>
              <p class="text-muted-sm">
                {{ trashedUrls?.length || 0 }} site(s) dans la corbeille
              </p>
            </div>
          </div>
        </div>

        <div v-if="urlsPending" class="px-5 py-10 text-muted-sm">
          Chargement de la corbeille URLs...
        </div>

        <div v-else-if="urlsError" class="px-5 py-10 text-xs text-red-600">
          Impossible de charger la corbeille URLs.
        </div>

        <div v-else class="divide-y divide-slate-200">
          <div
            v-for="item in trashedUrls"
            :key="item.id"
            class="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div class="min-w-0 space-y-2">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-link" class="h-4 w-4 text-slate-400" />
                <span class="truncate font-medium text-slate-900">{{
                  item.url
                }}</span>
              </div>
              <div class="flex flex-wrap gap-2 text-xs">
                <UBadge color="neutral" variant="soft">
                  {{ getShopifyStatusLabel(item.shopifyStatus) }}
                </UBadge>
                <UBadge v-if="item.cmsName" color="primary" variant="soft">
                  {{ item.cmsName }}
                </UBadge>
                <UBadge
                  v-if="item.redesignStatus"
                  color="warning"
                  variant="soft"
                >
                  {{ item.redesignStatus }}
                </UBadge>
                <UBadge color="neutral" variant="outline">
                  {{ item.contactStatus }}
                </UBadge>
              </div>
              <div class="text-muted-sm">
                {{ item.siteName || item.sourceFile || "—" }} · supprimé le
                {{ formatDate(item.trashedAt) }}
              </div>
            </div>

            <UButton
              color="primary"
              variant="solid"
              icon="i-lucide-rotate-ccw"
              :loading="restoringUrlId === item.id"
              :disabled="restoringUrlId !== null || deletingUrlId !== null"
              @click="restoreUrl(item)"
            >
              Restaurer
            </UButton>
            <UButton
              color="error"
              variant="outline"
              icon="i-lucide-trash-2"
              :loading="deletingUrlId === item.id"
              :disabled="restoringUrlId !== null || deletingUrlId !== null"
              @click="deleteUrlPermanently(item, $event)"
            >
              Supprimer
            </UButton>
          </div>

          <div v-if="!trashedUrls?.length" class="px-5 py-10 text-muted-sm">
            Aucune URL dans la corbeille.
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 px-5 py-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold text-slate-900">Prospects</h2>
              <p class="text-muted-sm">
                {{ trashedProspects?.length || 0 }} prospect(s) dans la
                corbeille
              </p>
            </div>
          </div>
        </div>

        <div v-if="prospectsPending" class="px-5 py-10 text-muted-sm">
          Chargement de la corbeille prospects...
        </div>

        <div v-else-if="prospectsError" class="px-5 py-10 text-xs text-red-600">
          Impossible de charger la corbeille prospects.
        </div>

        <div v-else class="divide-y divide-slate-200">
          <div
            v-for="item in trashedProspects"
            :key="item.id"
            class="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div class="min-w-0 space-y-2">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-user" class="h-4 w-4 text-slate-400" />
                <span class="truncate font-medium text-slate-900">{{
                  item.name
                }}</span>
              </div>
              <div class="flex flex-wrap gap-2 text-xs">
                <UBadge color="neutral" variant="soft">
                  {{ item.status }}
                </UBadge>
                <UBadge color="success" variant="soft">
                  Score {{ item.leadScore }}
                </UBadge>
                <UBadge
                  v-if="item.url?.shopifyStatus"
                  color="primary"
                  variant="soft"
                >
                  {{ getShopifyStatusLabel(item.url.shopifyStatus) }}
                </UBadge>
                <UBadge v-if="item.url?.cmsName" color="info" variant="soft">
                  {{ item.url.cmsName }}
                </UBadge>
              </div>
              <div class="text-muted-sm">
                {{ item.siteName }} · supprimé le
                {{ formatDate(item.trashedAt) }}
              </div>
            </div>

            <UButton
              color="primary"
              variant="solid"
              icon="i-lucide-rotate-ccw"
              :loading="restoringProspectId === item.id"
              :disabled="
                restoringProspectId !== null || deletingProspectId !== null
              "
              @click="restoreProspect(item)"
            >
              Restaurer
            </UButton>
            <UButton
              color="error"
              variant="outline"
              icon="i-lucide-trash-2"
              :loading="deletingProspectId === item.id"
              :disabled="
                restoringProspectId !== null || deletingProspectId !== null
              "
              @click="deleteProspectPermanently(item, $event)"
            >
              Supprimer
            </UButton>
          </div>

          <div
            v-if="!trashedProspects?.length"
            class="px-5 py-10 text-muted-sm"
          >
            Aucun prospect dans la corbeille.
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 px-5 py-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold text-slate-900">Imports</h2>
              <p class="text-muted-sm">
                {{ trashedImports?.length || 0 }} import(s) dans la corbeille
              </p>
            </div>
          </div>
        </div>

        <div v-if="importsPending" class="px-5 py-10 text-muted-sm">
          Chargement de la corbeille imports...
        </div>

        <div v-else-if="importsError" class="px-5 py-10 text-xs text-red-600">
          Impossible de charger la corbeille imports.
        </div>

        <div v-else class="divide-y divide-slate-200">
          <div
            v-for="item in trashedImports"
            :key="item.id"
            role="link"
            tabindex="0"
            class="flex cursor-pointer flex-col gap-4 px-5 py-4 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 sm:flex-row sm:items-start sm:justify-between"
            @click="openImportDetail(item.id)"
            @keydown.enter.prevent="openImportDetail(item.id)"
            @keydown.space.prevent="openImportDetail(item.id)"
          >
            <div class="min-w-0 space-y-2">
              <div class="flex items-center gap-2">
                <UIcon
                  name="i-lucide-archive-restore"
                  class="h-4 w-4 text-slate-400"
                />
                <span class="truncate font-medium text-slate-900">
                  Import #{{ item.id }} · {{ item.sourceFile }}
                </span>
              </div>
              <div class="flex flex-wrap gap-2 text-xs">
                <UBadge color="neutral" variant="soft">
                  {{ getImportStatusLabel(item.status) }}
                </UBadge>
                <UBadge color="primary" variant="soft">
                  {{ item.queuedUrls }} URL(s)
                </UBadge>
                <UBadge color="success" variant="soft">
                  {{ item.processedUrls }} traitée(s)
                </UBadge>
              </div>
              <div class="space-y-2">
                <div
                  class="flex items-center justify-between text-xs font-medium text-slate-500"
                >
                  <span>Progression</span>
                  <span>{{ getImportProgress(item) }}%</span>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-500"
                    :style="{ width: `${getImportProgress(item)}%` }"
                  />
                </div>
              </div>
              <div class="text-muted-sm">
                {{ item.currentStep }} · supprimé le
                {{ formatDate(item.trashedAt) }}
              </div>
            </div>

            <UButton
              color="error"
              variant="outline"
              icon="i-lucide-trash-2"
              :loading="deletingImportId === item.id"
              :disabled="deletingImportId !== null"
              @click.stop="deleteImportPermanently(item, $event)"
            >
              Supprimer
            </UButton>
          </div>

          <div v-if="!trashedImports?.length" class="px-5 py-10 text-muted-sm">
            Aucun import dans la corbeille.
          </div>
        </div>
      </section>
    </div>
  </LayoutPageShell>
</template>
