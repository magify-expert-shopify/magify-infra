<script setup lang="ts">
import { PROSPECT_STATUS_CONFIG } from "~/utils/prospect-statuses";
import type {
  ProspectCountsResponse,
  ProspectListResponse,
} from "~/types/prospects";

const runtimeConfig = useRuntimeConfig();
const route = useRoute();
const search = ref("");
const searchQuery = ref("");
let searchQueryTimer: number | undefined;
const notifications = useNotificationsStore();
const purgingProspects = ref(false);
const isChildRoute = computed(() => route.path !== "/prospects");
const pageSize = 20;
const currentPage = ref(1);
const loadingProspects = ref(false);
const loadError = ref("");
let loadRequestId = 0;

const requestQuery = computed(() => ({
  page: currentPage.value,
  limit: pageSize,
  search: searchQuery.value || undefined,
}));

const {
  data: prospectCounts,
  pending: countsPending,
  refresh: refreshCounts,
} = await useFetch<ProspectCountsResponse>(
  () => `${runtimeConfig.public.apiUrl}/prospects/counts`,
  {
    default: () => ({ total: 0, counts: [] }),
  },
);

const { data: contactedProspects } = await useFetch<ProspectListResponse>(
  () => `${runtimeConfig.public.apiUrl}/prospects`,
  {
    default: () => ({
      items: [],
      meta: { page: 1, limit: pageSize, total: 0, totalPages: 1 },
    }),
    query: {
      status: "Prospect contacté",
      all: true,
      fields: "id,firstContactEmailSentAt,status",
    },
  },
);

const prospectList = ref<ProspectListResponse>({
  items: [],
  meta: {
    page: 1,
    limit: pageSize,
    total: 0,
    totalPages: 1,
  },
});

const prospectCards = computed(() => prospectList.value.items);
const prospectMeta = computed(() => prospectList.value.meta);

const prospectCountsMap = computed(
  () =>
    new Map(
      (prospectCounts.value?.counts || []).map((item) => [
        item.status,
        item.total,
      ]),
    ),
);

function wasContactedMoreThanAWeekAgo(rawDate: string | null | undefined) {
  if (!rawDate) {
    return false;
  }

  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  return date <= oneWeekAgo;
}

const contactedFollowUpCount = computed(
  () =>
    (contactedProspects.value?.items || []).filter((prospect) =>
      wasContactedMoreThanAWeekAgo(prospect.firstContactEmailSentAt),
    ).length,
);

const prospectFollowUps = computed(() =>
  PROSPECT_STATUS_CONFIG.map((config) => ({
    ...config,
    count:
      config.status === "Prospect contacté"
        ? contactedFollowUpCount.value
        : prospectCountsMap.value.get(config.status) || 0,
    to: `/prospects-status/${config.slug}`,
  })),
);

const visibleCards = computed(() => prospectCards.value);

async function loadProspects() {
  const requestId = ++loadRequestId;
  loadingProspects.value = true;
  loadError.value = "";

  try {
    const response = await $fetch<ProspectListResponse>(
      `${runtimeConfig.public.apiUrl}/prospects`,
      {
        query: requestQuery.value,
      },
    );

    if (requestId !== loadRequestId) {
      return;
    }

    prospectList.value = response;
  } catch (error) {
    if (requestId !== loadRequestId) {
      return;
    }

    loadError.value =
      error instanceof Error
        ? error.message
        : "Impossible de charger les prospects depuis l’API.";
  } finally {
    if (requestId !== loadRequestId) {
      return;
    }

    loadingProspects.value = false;
  }
}

await loadProspects();

watch(search, (value) => {
  if (searchQueryTimer) {
    window.clearTimeout(searchQueryTimer);
  }

  searchQueryTimer = window.setTimeout(() => {
    searchQuery.value = value.trim();
    currentPage.value = 1;
  }, 250);
});

watch(
  requestQuery,
  () => {
    void loadProspects();
  },
  { deep: true },
);

watch(prospectMeta, () => {
  if (currentPage.value > prospectMeta.value.totalPages) {
    currentPage.value = prospectMeta.value.totalPages;
  }
});

async function refreshProspectsPage() {
  await Promise.all([loadProspects(), refreshCounts()]);
}

async function moveProspect(payload: { id: number; status: string }) {
  const previous = {
    ...prospectList.value,
    items: [...prospectList.value.items],
  };

  prospectList.value = {
    ...prospectList.value,
    items: prospectList.value.items.map((item) =>
      item.id === payload.id ? { ...item, status: payload.status } : item,
    ),
  };

  try {
    await $fetch(
      `${runtimeConfig.public.apiUrl}/prospects/${payload.id}/status`,
      {
        method: "PATCH",
        body: { status: payload.status },
      },
    );
    await refreshCounts();
    notifications.add({
      kind: "success",
      title: "Statut prospect mis à jour",
      message: `Le prospect a été déplacé vers "${payload.status}".`,
    });
  } catch (error) {
    prospectList.value = previous;
    notifications.add({
      kind: "error",
      title: "Mise à jour prospect échouée",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de changer le statut du prospect.",
    });
    throw error;
  }
}

async function purgeProspects() {
  if (purgingProspects.value) {
    return;
  }

  purgingProspects.value = true;

  try {
    const result = await $fetch<{ trashed: number }>(
      `${runtimeConfig.public.apiUrl}/prospects/reset`,
      {
        method: "DELETE",
      },
    );

    prospectList.value = {
      items: [],
      meta: {
        page: 1,
        limit: pageSize,
        total: 0,
        totalPages: 1,
      },
    };
    await refreshCounts();
    notifications.add({
      kind: "success",
      title: "Prospects purgés",
      message: `${result.trashed} prospect(s) ont été mis à la corbeille.`,
    });
  } catch (error) {
    notifications.add({
      kind: "error",
      title: "Purge des prospects échouée",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de purger les prospects.",
    });
  } finally {
    purgingProspects.value = false;
  }
}

onBeforeUnmount(() => {
  if (searchQueryTimer) {
    window.clearTimeout(searchQueryTimer);
  }
});
</script>

<template>
  <main class="min-h-screen bg-background text-slate-900">
    <NuxtPage v-if="isChildRoute" />

    <template v-else>
      <section class="w-full px-5 py-6 lg:px-8">
        <div class="w-full">
          <div class="space-y-2">
            <p
              class="text-[11px] font-medium uppercase tracking-[0.18em] text-sky-700"
            >
              Prospection Magify
            </p>
            <div class="space-y-2">
              <h1 class="page-title">Prospects</h1>
              <p class="max-w-2xl body-muted">
                Cette vue est alimentée par la table `prospects`. Les cartes se
                déplacent entre les colonnes pour faire avancer le cycle
                commercial.
              </p>
            </div>
          </div>

          <ProspectsStatusCardsGrid class="mt-6" :cards="prospectFollowUps" />

          <div class="mt-6 flex max-w-xl gap-3">
            <UButton
              to="/urls"
              color="neutral"
              variant="outline"
              icon="i-lucide-link"
            >
              Sites
            </UButton>
            <UInput
              v-model="search"
              trailing-icon="i-lucide-search"
              placeholder="Rechercher un prospect, une société, un statut..."
              class="flex-1 min-w-0 rounded-xl bg-white"
              :ui="{
                base: 'bg-white dark:bg-white',
                trailing: 'absolute inset-y-0 end-0 flex items-center pe-3',
                trailingIcon: 'shrink-0 text-slate-400',
              }"
            />
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-refresh-cw"
              :loading="loadingProspects || countsPending"
              @click="refreshProspectsPage()"
            >
              Rafraîchir
            </UButton>
            <UButton
              color="red"
              variant="soft"
              icon="i-lucide-trash-2"
              :loading="purgingProspects"
              :disabled="purgingProspects"
              @click="purgeProspects()"
            >
              Purger tout
            </UButton>
          </div>
        </div>
      </section>

      <section class="w-full px-5 pb-6 lg:px-8">
        <div
          v-if="loadingProspects"
          class="rounded-lg border border-slate-200 bg-white px-6 py-12 text-muted-sm"
        >
          Chargement des prospects depuis l’API...
        </div>

        <div
          v-else-if="loadError"
          class="rounded-lg border border-red-200 bg-white px-6 py-12 text-xs text-red-600"
        >
          {{ loadError }}
        </div>

        <template v-else>
          <div class="mb-4 flex items-center justify-between">
            <p class="text-xs text-slate-600">
              {{ prospectMeta.total }} prospect(s) affiché(s)
            </p>
            <p class="text-muted-sm">
              Page {{ currentPage }} / {{ prospectMeta.totalPages }}
            </p>
          </div>

          <div v-if="visibleCards.length">
            <ProspectsProspectBoard
              :prospects="visibleCards"
              @move-prospect="moveProspect"
            />
          </div>

          <div
            v-else
            class="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-muted-sm"
          >
            Aucun prospect ne correspond à la recherche.
          </div>

          <div
            v-if="prospectMeta.total > 0"
            class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <p class="text-xs text-slate-600">
              Affichage de
              {{
                Math.min(
                  (prospectMeta.page - 1) * prospectMeta.limit + 1,
                  prospectMeta.total,
                )
              }}
              à
              {{
                Math.min(
                  prospectMeta.page * prospectMeta.limit,
                  prospectMeta.total,
                )
              }}
              sur {{ prospectMeta.total }}
            </p>

            <div class="flex items-center gap-2">
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-chevron-left"
                :disabled="currentPage === 1 || loadingProspects"
                @click="currentPage = Math.max(1, currentPage - 1)"
              >
                Précédent
              </UButton>
              <UButton
                color="neutral"
                variant="outline"
                trailing-icon="i-lucide-chevron-right"
                :disabled="
                  currentPage === prospectMeta.totalPages || loadingProspects
                "
                @click="
                  currentPage = Math.min(
                    prospectMeta.totalPages,
                    currentPage + 1,
                  )
                "
              >
                Suivant
              </UButton>
            </div>
          </div>
        </template>
      </section>
    </template>
  </main>
</template>
