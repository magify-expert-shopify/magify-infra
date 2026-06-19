<script setup lang="ts">
import type { ProspectListResponse } from "~/types/prospects";
import { getProspectStatusConfigBySlug } from "~/utils/prospect-statuses";

const route = useRoute();
const router = useRouter();
const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();
const coldFiltersStore = useProspectColdFiltersStore();

onMounted(() => {
  coldFiltersStore.hydrate();
});
let searchQueryTimer: number | undefined;
const slug = computed(() => String(route.params.status || ""));
const statusConfig = computed(() => getProspectStatusConfigBySlug(slug.value));
const pageSize = 20;

function readQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

function parsePageValue(value: string | string[] | undefined) {
  const raw = readQueryValue(value);
  const page = Number(raw);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function parsePositioningValue(value: string | string[] | undefined) {
  const raw = readQueryValue(value);
  return raw === "support" || raw === "refonte" || raw === "migration"
    ? raw
    : "all";
}

function parseHideQueuedEmailsValue(value: string | string[] | undefined) {
  const raw = readQueryValue(value).toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off") {
    return false;
  }

  return true;
}

function buildRouteQuery() {
  const query: Record<string, string> = {};

  if (searchQuery.value) {
    query.search = searchQuery.value;
  }

  if (currentPage.value > 1) {
    query.page = String(currentPage.value);
  }

  if (slug.value === "prospect-froid" && positioningFilter.value !== "all") {
    query.positioning = positioningFilter.value;
  }

  if (slug.value === "prospect-froid") {
    query.hideQueuedEmails = hideQueuedEmails.value ? "true" : "false";
  }

  return query;
}

function isSameQuery(
  left: Record<string, string>,
  right: Record<string, unknown>,
) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right).filter(
    (key) => typeof right[key] === "string",
  );

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === String(right[key] || ""));
}

const search = ref(readQueryValue(route.query.search).trim());
const searchQuery = ref(readQueryValue(route.query.search).trim());
const positioningFilter = ref<"all" | "support" | "refonte" | "migration">(
  slug.value === "prospect-froid"
    ? route.query.positioning
      ? parsePositioningValue(route.query.positioning)
      : coldFiltersStore.state.value.positioning
    : "all",
);
const hideQueuedEmails = ref(
  slug.value === "prospect-froid"
    ? typeof route.query.hideQueuedEmails !== "undefined"
      ? parseHideQueuedEmailsValue(route.query.hideQueuedEmails)
      : coldFiltersStore.state.value.hideQueuedEmails
    : false,
);
const currentPage = ref(parsePageValue(route.query.page));
const syncingFromRoute = ref(false);

if (!statusConfig.value) {
  throw createError({
    statusCode: 404,
    statusMessage: "Statut prospect introuvable",
  });
}

const defaultResponse: ProspectListResponse = {
  items: [],
  meta: {
    page: 1,
    limit: pageSize,
    total: 0,
    totalPages: 1,
  },
};

const coldProspectFields =
  "id,leadScore,name,siteName,sourceUrl,email,phone,avatarUrl,linkedinImageUrl,socialLinksJson,firstContactEmailQueuedAt,url.redesignStatus";
const contactedProspectFields =
  "id,name,siteName,email,avatarUrl,linkedinImageUrl,firstName,firstContactEmailSentAt";
const requestQuery = computed(() => ({
  status: statusConfig.value!.status,
  page: currentPage.value,
  limit: pageSize,
  search: searchQuery.value || undefined,
  positioning:
    slug.value === "prospect-froid" ? positioningFilter.value : undefined,
  hideQueuedEmails:
    slug.value === "prospect-froid" && hideQueuedEmails.value
      ? "true"
      : undefined,
  fields:
    slug.value === "prospect-froid"
      ? coldProspectFields
      : slug.value === "prospect-contacte"
        ? contactedProspectFields
        : undefined,
}));

const { data, pending, error, refresh } = await useFetch<ProspectListResponse>(
  () => `${runtimeConfig.public.apiUrl}/prospects`,
  {
    default: () => defaultResponse,
    query: requestQuery,
    watch: [slug, requestQuery],
  },
);

const prospectCards = computed(() => data.value?.items ?? []);
const prospectMeta = computed(() => data.value?.meta ?? defaultResponse.meta);
const useColdProspectCards = computed(() => slug.value === "prospect-froid");
const useContactedProspectList = computed(
  () => slug.value === "prospect-contacte",
);
const visibleCards = computed(() => {
  const items = [...prospectCards.value];

  if (useContactedProspectList.value) {
    return items.sort(
      (left, right) =>
        new Date(right.firstContactEmailSentAt || 0).getTime() -
        new Date(left.firstContactEmailSentAt || 0).getTime(),
    );
  }

  return items.sort(
    (left, right) => Number(right.leadScore || 0) - Number(left.leadScore || 0),
  );
});

const positioningOptions = [
  { label: "Tous", value: "all" },
  { label: "Support", value: "support" },
  { label: "Refonte", value: "refonte" },
  { label: "Migration", value: "migration" },
];

watch(search, (value) => {
  if (syncingFromRoute.value) {
    return;
  }

  if (searchQueryTimer) {
    window.clearTimeout(searchQueryTimer);
  }

  searchQueryTimer = window.setTimeout(() => {
    searchQuery.value = value.trim();
    currentPage.value = 1;
  }, 250);
});

watch(
  () => route.query,
  () => {
    syncingFromRoute.value = true;

    const nextSearch = readQueryValue(route.query.search).trim();
    const nextPage = parsePageValue(route.query.page);
    const hasPositioningQuery =
      slug.value === "prospect-froid" &&
      typeof route.query.positioning !== "undefined";
    const hasHideQueuedEmailsQuery =
      slug.value === "prospect-froid" &&
      typeof route.query.hideQueuedEmails !== "undefined";
    const nextPositioning = hasPositioningQuery
      ? parsePositioningValue(route.query.positioning)
      : coldFiltersStore.state.value.positioning;
    const nextHideQueuedEmails = hasHideQueuedEmailsQuery
      ? parseHideQueuedEmailsValue(route.query.hideQueuedEmails)
      : coldFiltersStore.state.value.hideQueuedEmails;

    if (search.value !== nextSearch) {
      search.value = nextSearch;
    }

    if (searchQuery.value !== nextSearch) {
      searchQuery.value = nextSearch;
    }

    if (currentPage.value !== nextPage) {
      currentPage.value = nextPage;
    }

    if (positioningFilter.value !== nextPositioning) {
      positioningFilter.value = nextPositioning;
    }

    if (slug.value === "prospect-froid" && hasPositioningQuery) {
      coldFiltersStore.setPositioning(nextPositioning);
    }

    if (hideQueuedEmails.value !== nextHideQueuedEmails) {
      hideQueuedEmails.value = nextHideQueuedEmails;
    }

    if (slug.value === "prospect-froid" && hasHideQueuedEmailsQuery) {
      coldFiltersStore.setHideQueuedEmails(nextHideQueuedEmails);
    }

    nextTick(() => {
      syncingFromRoute.value = false;
    });
  },
  { deep: true, immediate: true },
);

watch(
  [searchQuery, currentPage, positioningFilter, hideQueuedEmails, slug],
  () => {
    const nextQuery = buildRouteQuery();
    if (isSameQuery(nextQuery, route.query)) {
      return;
    }

    void router.replace({ query: nextQuery });
  },
);

watch(prospectMeta, () => {
  if (currentPage.value > prospectMeta.value.totalPages) {
    currentPage.value = prospectMeta.value.totalPages;
  }
});

watch(positioningFilter, () => {
  if (syncingFromRoute.value) {
    return;
  }

  if (slug.value === "prospect-froid") {
    coldFiltersStore.setPositioning(positioningFilter.value);
  }

  currentPage.value = 1;
});

watch(hideQueuedEmails, () => {
  if (syncingFromRoute.value) {
    return;
  }

  if (slug.value === "prospect-froid") {
    coldFiltersStore.setHideQueuedEmails(hideQueuedEmails.value);
  }

  currentPage.value = 1;
});

async function relaunchProspect(id: number) {
  try {
    await $fetch(`${runtimeConfig.public.apiUrl}/prospects/${id}/relaunch`, {
      method: "POST",
    });

    notifications.add({
      kind: "success",
      title: "Mail renvoyé",
      message: "Le prospect a été relancé.",
    });

    await refresh();
  } catch (error) {
    notifications.add({
      kind: "error",
      title: "Relance échouée",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de renvoyer le mail.",
    });
  }
}

async function markProspectAsResponded(id: number) {
  try {
    await $fetch(`${runtimeConfig.public.apiUrl}/prospects/${id}/status`, {
      method: "PATCH",
      body: { status: "Prospect en discussion" },
    });

    notifications.add({
      kind: "success",
      title: "Prospect mis à jour",
      message: "Le prospect a été déplacé en discussion.",
    });

    await refresh();
  } catch (error) {
    notifications.add({
      kind: "error",
      title: "Mise à jour échouée",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de changer le statut du prospect.",
    });
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
    <section class="w-full px-5 py-6 lg:px-8">
      <div class="w-full">
        <div
          class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
        >
          <div class="space-y-2">
            <p
              class="text-[11px] font-medium uppercase tracking-[0.18em] text-sky-700"
            >
              Prospects
            </p>

            <div class="space-y-2">
              <h1 class="page-title">
                {{ statusConfig?.status }}
              </h1>
              <p class="max-w-2xl body-muted">
                {{ statusConfig?.label }}
              </p>
            </div>
          </div>
        </div>

        <div
          class="mt-6 grid gap-3"
          :class="
            useColdProspectCards
              ? 'lg:grid-cols-[minmax(0,1fr)_14rem_16rem_auto]'
              : 'lg:grid-cols-[minmax(0,1fr)_auto]'
          "
        >
          <UInput
            v-model="search"
            trailing-icon="i-lucide-search"
            placeholder="Rechercher dans cette liste..."
            class="flex-1 min-w-0 rounded-xl bg-white"
            :ui="{
              base: 'bg-white dark:bg-white',
              trailing: 'absolute inset-y-0 end-0 flex items-center pe-3',
              trailingIcon: 'shrink-0 text-slate-400',
            }"
          />
          <USelect
            v-if="useColdProspectCards"
            v-model="positioningFilter"
            :items="positioningOptions"
            value-attribute="value"
            option-attribute="label"
            color="neutral"
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
            }"
          />
          <div
            v-if="useColdProspectCards"
            class="flex min-h-14 items-center rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <UCheckbox
              v-model="hideQueuedEmails"
              label="Masquer les emails planifiés"
              :ui="{
                label: 'text-xs font-medium text-slate-700',
                description: 'text-xs text-slate-500',
              }"
            />
          </div>
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-refresh-cw"
            :loading="pending"
            @click="refresh()"
          >
            Rafraîchir
          </UButton>
        </div>
      </div>
    </section>

    <section class="w-full px-5 pb-6 lg:px-8">
      <div
        v-if="pending"
        class="rounded-lg border border-slate-200 bg-white px-6 py-12 text-muted-sm"
      >
        Chargement des prospects...
      </div>

      <div
        v-else-if="error"
        class="rounded-lg border border-red-200 bg-white px-6 py-12 text-xs text-red-600"
      >
        Impossible de charger cette liste.
      </div>

      <template v-else>
        <div class="mb-4 flex items-center justify-between gap-3">
          <p class="text-xs text-slate-600">
            {{ visibleCards.length }} prospect(s) affiché(s)
          </p>
          <p class="text-muted-sm">
            Page {{ currentPage }} / {{ prospectMeta.totalPages }}
          </p>
        </div>

        <div
          v-if="visibleCards.length && useContactedProspectList"
          class="grid gap-3"
        >
          <ProspectsProspectContactedListCard
            v-for="prospect in visibleCards"
            :key="prospect.id"
            :prospect="prospect"
            @relaunch="relaunchProspect"
            @responded="markProspectAsResponded"
          />
        </div>

        <div v-else-if="visibleCards.length" class="grid gap-3 xl:grid-cols-2">
          <template v-if="useColdProspectCards">
            <ProspectsProspectColdCard
              v-for="prospect in visibleCards"
              :key="prospect.id"
              :prospect="prospect"
            />
          </template>
          <template v-else>
            <ProspectsProspectCard
              v-for="prospect in visibleCards"
              :key="prospect.id"
              :prospect="prospect"
            />
          </template>
        </div>

        <div
          v-else
          class="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-muted-sm"
        >
          Aucun prospect ne correspond à cette page.
        </div>

        <div
          v-show="prospectMeta.total > 0"
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
              :disabled="currentPage === 1 || pending"
              @click="currentPage = Math.max(1, currentPage - 1)"
            >
              Précédent
            </UButton>
            <UButton
              color="neutral"
              variant="outline"
              trailing-icon="i-lucide-chevron-right"
              :disabled="currentPage === prospectMeta.totalPages || pending"
              @click="
                currentPage = Math.min(prospectMeta.totalPages, currentPage + 1)
              "
            >
              Suivant
            </UButton>
          </div>
        </div>
      </template>
    </section>
  </main>
</template>
