<script setup lang="ts">
import { PROSPECT_STATUS_CONFIG } from "~/utils/prospect-statuses";
import type {
  ProspectCountsResponse,
  ProspectListResponse,
} from "~/types/prospects";

const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const search = ref(
  typeof route.query.search === "string" ? route.query.search : "",
);
const searchQuery = ref("");
const status = ref<"all" | string>("all");
const limit = ref(24);
const currentPage = ref(1);
const pageSize = 24;
const loadingProspects = ref(false);
const loadError = ref("");
let searchQueryTimer: number | undefined;
let loadRequestId = 0;

const defaultResponse: ProspectListResponse = {
  items: [],
  meta: {
    page: 1,
    limit: pageSize,
    total: 0,
    totalPages: 1,
  },
};

const prospectList = ref<ProspectListResponse>(defaultResponse);
const prospectResults = computed(() => prospectList.value.items);
const prospectMeta = computed(() => prospectList.value.meta);

const requestQuery = computed(() => ({
  search: searchQuery.value || undefined,
  status: status.value === "all" ? undefined : status.value,
  page: currentPage.value,
  limit: limit.value,
}));

const { data: prospectCounts, refresh: refreshCounts } =
  await useFetch<ProspectCountsResponse>(
    () => `${runtimeConfig.public.apiUrl}/prospects/counts`,
    {
      default: () => ({ total: 0, counts: [] }),
      query: computed(() => ({
        search: searchQuery.value || undefined,
      })),
    },
  );

const prospectCountsMap = computed(
  () =>
    new Map(
      (prospectCounts.value?.counts || []).map((item) => [
        item.status,
        item.total,
      ]),
    ),
);

const statusOptions = computed(() => [
  { label: "Tous", value: "all", count: prospectCounts.value?.total || 0 },
  ...PROSPECT_STATUS_CONFIG.map((config) => ({
    label: config.status,
    value: config.status,
    count: prospectCountsMap.value.get(config.status) || 0,
  })),
]);

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

async function refreshSearchPage() {
  await Promise.all([loadProspects(), refreshCounts()]);
}

watch(search, (value) => {
  if (searchQueryTimer) {
    window.clearTimeout(searchQueryTimer);
  }

  searchQueryTimer = window.setTimeout(() => {
    searchQuery.value = value.trim();
    currentPage.value = 1;
  }, 250);
});

watch([status, limit], () => {
  currentPage.value = 1;
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

onBeforeUnmount(() => {
  if (searchQueryTimer) {
    window.clearTimeout(searchQueryTimer);
  }
});

await loadProspects();
</script>

<template>
  <LayoutPageShell
    title="Rechercher un prospect"
    description="Trouve rapidement un prospect par nom, site, contact ou statut."
    max-width="5xl"
  >
    <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem_auto]">
      <UInput
        v-model="search"
        trailing-icon="i-lucide-search"
        size="md"
        placeholder="Rechercher un prospect..."
        class="rounded-xl bg-white"
        :ui="{
          base: 'bg-white dark:bg-white',
          trailing: 'absolute inset-y-0 end-0 flex items-center pe-3',
          trailingIcon: 'shrink-0 text-slate-400',
        }"
      />

      <USelect
        v-model="status"
        :items="statusOptions"
        value-attribute="value"
        option-attribute="label"
        color="neutral"
        size="md"
        class="min-w-0 rounded-xl bg-white"
        trailing-icon="i-lucide-chevron-down"
        :content="{
          class:
            'z-50 max-h-60 w-(--reka-select-trigger-width) overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl ring-1 ring-slate-200 dark:bg-white dark:text-slate-900 dark:ring-slate-200',
        }"
        :ui="{
          base: 'bg-white dark:bg-white',
          value: 'truncate min-w-0 pointer-events-none pr-8',
          placeholder:
            'truncate min-w-0 pointer-events-none pr-8 text-slate-400',
          trailing: 'absolute inset-y-0 end-0 flex items-center pe-3',
          trailingIcon: 'shrink-0 text-slate-400',
          item: 'p-2 text-xs text-slate-700',
          itemLabel: 'truncate text-slate-700',
          itemDescription: 'truncate text-slate-500',
          label:
            'p-2 text-xs font-semibold uppercase tracking-wide text-slate-500',
        }"
      />

      <UButton
        color="neutral"
        variant="soft"
        icon="i-lucide-refresh-cw"
        size="md"
        :loading="loadingProspects"
        @click="refreshSearchPage()"
      >
        Rafraîchir
      </UButton>
    </div>

    <div class="mb-4 flex items-center justify-between text-muted-sm">
      <p>{{ prospectMeta.total }} prospect(s) trouvé(s)</p>
      <label class="flex items-center gap-2">
        <span>Afficher</span>
        <USelect
          v-model="limit"
          :items="
            [12, 24, 48, 96].map((value) => ({ label: String(value), value }))
          "
          color="neutral"
          size="xs"
          class="w-20 min-w-0 rounded-xl bg-white"
          trailing-icon="i-lucide-chevron-down"
          :content="{
            class:
              'z-50 max-h-60 w-(--reka-select-trigger-width) overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl ring-1 ring-slate-200 dark:bg-white dark:text-slate-900 dark:ring-slate-200',
          }"
          :ui="{
            base: 'bg-white dark:bg-white',
            value: 'truncate min-w-0 pointer-events-none pr-8',
            placeholder:
              'truncate min-w-0 pointer-events-none pr-8 text-slate-400',
            trailing: 'absolute inset-y-0 end-0 flex items-center pe-3',
            trailingIcon: 'shrink-0 text-slate-400',
            item: 'p-2 text-xs text-slate-700',
            itemLabel: 'truncate text-slate-700',
            itemDescription: 'truncate text-slate-500',
            label:
              'p-2 text-xs font-semibold uppercase tracking-wide text-slate-500',
          }"
        />
      </label>
    </div>

    <div
      v-if="loadingProspects"
      class="rounded-xl border border-slate-200 bg-white px-6 py-10 text-muted-sm"
    >
      Chargement des prospects...
    </div>

    <div
      v-else-if="loadError"
      class="rounded-xl border border-red-200 bg-white px-6 py-10 text-xs text-red-600"
    >
      {{ loadError }}
    </div>

    <template v-else>
      <div class="mb-4 flex items-center justify-between gap-3 text-muted-sm">
        <p>
          Affichage de
          {{
            Math.min(
              (prospectMeta.page - 1) * prospectMeta.limit + 1,
              prospectMeta.total,
            )
          }}
          à
          {{
            Math.min(prospectMeta.page * prospectMeta.limit, prospectMeta.total)
          }}
          sur {{ prospectMeta.total }}
        </p>

        <p>Page {{ currentPage }} / {{ prospectMeta.totalPages }}</p>
      </div>

      <div
        v-if="prospectResults.length"
        class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        <NuxtLink
          v-for="item in prospectResults"
          :key="item.id"
          :to="`/prospects/${item.id}`"
          class="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 space-y-2">
              <div class="truncate text-xs font-semibold text-slate-900">
                {{ item.firstName }} {{ item.name }}
              </div>
              <div class="truncate text-xs text-slate-500">
                {{ item.siteName }}
              </div>
            </div>
            <span
              class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              {{ item.status }}
            </span>
          </div>

          <div
            class="mt-4 flex items-center justify-between text-xs text-slate-600"
          >
            <span>{{
              item.email ||
              item.phone ||
              item.linkedinUrl ||
              "Aucun contact direct"
            }}</span>
            <span class="font-semibold text-slate-900">
              {{ item.leadScore }}
            </span>
          </div>

          <div
            class="mt-4 flex items-center justify-between text-xs text-slate-500"
          >
            <span>{{ item.sourceFile }}</span>
            <UIcon
              name="i-lucide-arrow-right"
              class="h-4 w-4 text-slate-400 transition group-hover:translate-x-1"
            />
          </div>
        </NuxtLink>
      </div>

      <div
        v-else
        class="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-muted-sm"
      >
        Aucun prospect ne correspond à la recherche.
      </div>

      <div
        v-if="prospectMeta.total > 0"
        class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
      >
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
              currentPage = Math.min(prospectMeta.totalPages, currentPage + 1)
            "
          >
            Suivant
          </UButton>
        </div>
      </div>
    </template>
  </LayoutPageShell>
</template>
