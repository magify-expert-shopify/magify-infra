<script setup lang="ts">
import type { ApiProspect, ProspectListResponse } from "~/types/prospects";
import type { UrlListResponse, UrlRow } from "~/composables/useUrlsStore";

type QuickSearchProspect = ApiProspect & {
  urlId?: number | null;
  firstContactEmailQueuedAt?: string | null;
  firstContactEmailSentAt?: string | null;
  firstContactEmailSubject?: string | null;
  quoteFileName?: string | null;
  quoteSentAt?: string | null;
  contractFileName?: string | null;
  contractSentAt?: string | null;
  contractSignedAt?: string | null;
};

type QuickSearchResultKind =
  | "prospect"
  | "url"
  | "email"
  | "quote"
  | "contract";

type QuickSearchResult = {
  key: string;
  kind: QuickSearchResultKind;
  href: string;
  title: string;
  subtitle: string;
  badge: string;
  icon: string;
};

const runtimeConfig = useRuntimeConfig();
const query = ref("");
const inputRef = ref<HTMLInputElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const loading = ref(false);
const open = ref(false);
const error = ref("");
const results = ref<QuickSearchResult[]>([]);
let debounceTimer: number | undefined;
let requestId = 0;

const searchQuery = computed(() => query.value.trim());
const hasSearch = computed(() => searchQuery.value.length > 0);

function isLikelyUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes(" ")) {
    return false;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return true;
  }

  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(trimmed)) {
    return true;
  }

  if (trimmed.startsWith("www.")) {
    return true;
  }

  // Bare domains must contain at least one dot and a likely TLD.
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(trimmed);
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();

  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return new URL(trimmed).toString();
    }

    return new URL(`https://${trimmed}`).toString();
  } catch {
    return trimmed;
  }
}

function isSiteScanned(site: UrlRow) {
  return Boolean(
    site.shopifyCheckedAt ||
    site.contactCheckedAt ||
    site.scanTotalMs != null ||
    site.scanShopifyMs != null ||
    site.scanContactMs != null ||
    site.scanLighthouseMs != null,
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function prospectLabel(prospect: QuickSearchProspect) {
  return prospect.name || prospect.siteName || prospect.firstName || "Prospect";
}

function prospectSubtitle(prospect: QuickSearchProspect) {
  return (
    prospect.siteName ||
    prospect.sourceUrl ||
    prospect.email ||
    "Fiche prospect"
  );
}

function addResult(list: QuickSearchResult[], result: QuickSearchResult) {
  if (!list.some((item) => item.key === result.key)) {
    list.push(result);
  }
}

function buildProspectResults(prospect: QuickSearchProspect) {
  const list: QuickSearchResult[] = [];
  const title = prospectLabel(prospect);
  const subtitle = prospectSubtitle(prospect);

  addResult(list, {
    key: `prospect:${prospect.id}`,
    kind: "prospect",
    href: `/prospects/${prospect.id}`,
    title,
    subtitle,
    badge: "Prospect",
    icon: "i-lucide-user",
  });

  if (prospect.firstContactEmailQueuedAt || prospect.firstContactEmailSentAt) {
    addResult(list, {
      key: `email:${prospect.id}`,
      kind: "email",
      href: `/prospects/${prospect.id}/email-planifie`,
      title: prospect.firstContactEmailSentAt
        ? "Email envoyé"
        : "Email en attente",
      subtitle: prospect.firstContactEmailSubject || prospect.email || subtitle,
      badge: prospect.firstContactEmailSentAt ? "Envoyé" : "File",
      icon: "i-lucide-mail",
    });
  }

  if (prospect.quoteFileName || prospect.quoteSentAt) {
    addResult(list, {
      key: `quote:${prospect.id}`,
      kind: "quote",
      href: `/prospects/${prospect.id}#quote`,
      title: "Devis",
      subtitle:
        prospect.quoteFileName ||
        (prospect.quoteSentAt
          ? `Envoyé le ${formatDate(prospect.quoteSentAt)}`
          : subtitle),
      badge: prospect.quoteSentAt ? "Envoyé" : "Enregistré",
      icon: "i-lucide-file-text",
    });
  }

  if (
    prospect.contractFileName ||
    prospect.contractSentAt ||
    prospect.contractSignedAt
  ) {
    addResult(list, {
      key: `contract:${prospect.id}`,
      kind: "contract",
      href: `/prospects/${prospect.id}#contract`,
      title: "Contrat",
      subtitle:
        prospect.contractFileName ||
        (prospect.contractSignedAt
          ? `Signé le ${formatDate(prospect.contractSignedAt)}`
          : prospect.contractSentAt
            ? `Envoyé le ${formatDate(prospect.contractSentAt)}`
            : subtitle),
      badge: prospect.contractSignedAt
        ? "Signé"
        : prospect.contractSentAt
          ? "Envoyé"
          : "Enregistré",
      icon: "i-lucide-file-signature",
    });
  }

  return list;
}

function buildUrlResult(site: UrlRow, prospect?: QuickSearchProspect | null) {
  if (prospect) {
    return buildProspectResults(prospect);
  }

  return [
    {
      key: `url:${site.id}`,
      kind: "url",
      href: `/urls/${site.id}`,
      title: site.siteName || site.url,
      subtitle: site.contactCompanyName || site.siteKey || site.url,
      badge: isSiteScanned(site) ? "Scanné" : "URL",
      icon: "i-lucide-globe",
    },
  ];
}

async function searchProspectsByText(value: string) {
  const response = await $fetch<ProspectListResponse>(
    `${runtimeConfig.public.apiUrl}/prospects`,
    {
      query: {
        search: value,
        all: "true",
        fields: [
          "id",
          "urlId",
          "name",
          "siteName",
          "sourceUrl",
          "email",
          "firstContactEmailQueuedAt",
          "firstContactEmailSentAt",
          "firstContactEmailSubject",
          "quoteFileName",
          "quoteSentAt",
          "contractFileName",
          "contractSentAt",
          "contractSignedAt",
          "firstName",
        ].join(","),
      },
    },
  );

  return (response.items as QuickSearchProspect[]).slice(0, 5);
}

async function searchUrlsByText(value: string) {
  const response = await $fetch<UrlListResponse>(
    `${runtimeConfig.public.apiUrl}/urls`,
    {
      query: {
        search: value,
        limit: 5,
        page: 1,
        fields:
          "id,url,siteName,siteKey,sourceFile,shopifyCheckedAt,contactCheckedAt,scanTotalMs,scanShopifyMs,scanContactMs,shopifyStatus,contactStatus,contactCompanyName",
      },
    },
  );

  return response.items;
}

async function searchUrl(value: string) {
  const normalizedUrl = normalizeUrl(value);
  const existing = await $fetch<{
    exists: boolean;
    site: UrlRow | null;
    normalizedUrl: string;
  }>(`${runtimeConfig.public.apiUrl}/urls/exists`, {
    query: { url: normalizedUrl },
  });

  if (existing.site && isSiteScanned(existing.site)) {
    const prospectResponse = await $fetch<ProspectListResponse>(
      `${runtimeConfig.public.apiUrl}/prospects`,
      {
        query: {
          search: normalizedUrl,
          all: "true",
          fields: [
            "id",
            "urlId",
            "name",
            "siteName",
            "sourceUrl",
            "email",
            "firstContactEmailQueuedAt",
            "firstContactEmailSentAt",
            "firstContactEmailSubject",
            "quoteFileName",
            "quoteSentAt",
            "contractFileName",
            "contractSentAt",
            "contractSignedAt",
            "firstName",
          ].join(","),
        },
      },
    );

    const prospect =
      (prospectResponse.items as QuickSearchProspect[]).find(
        (item) => item.urlId === existing.site?.id,
      ) || (prospectResponse.items as QuickSearchProspect[])[0];

    return buildUrlResult(existing.site, prospect || null);
  }

  const response = await $fetch<{
    site: UrlRow;
    scan: unknown;
    prospect: QuickSearchProspect | null;
    outcome: string;
    message: string;
    destination: { label: string; href: string } | null;
  }>(`${runtimeConfig.public.apiUrl}/urls`, {
    method: "POST",
    body: {
      url: normalizedUrl,
      scan: true,
      sourceFile: "search-bar",
    },
  });

  return buildUrlResult(response.site, response.prospect);
}

async function runSearch() {
  const value = searchQuery.value;
  const currentRequestId = ++requestId;

  if (!value) {
    results.value = [];
    error.value = "";
    open.value = false;
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = "";
  open.value = true;

  try {
    const nextResults = isLikelyUrl(value)
      ? await searchUrl(value)
      : await searchProspectsByText(value).then(async (items) => {
          if (items.length > 0) {
            return items.flatMap(buildProspectResults);
          }

          const sites = await searchUrlsByText(value);
          return sites.map((site) => buildUrlResult(site));
        });

    if (currentRequestId !== requestId) {
      return;
    }

    results.value = nextResults;
  } catch (err) {
    if (currentRequestId !== requestId) {
      return;
    }

    results.value = [];
    error.value = err instanceof Error ? err.message : "La recherche a échoué.";
  } finally {
    if (currentRequestId !== requestId) {
      return;
    }

    loading.value = false;
  }
}

function focusSearch() {
  inputRef.value?.focus();
  open.value = true;
}

function submitSearch() {
  void runSearch();
}

watch(query, (value) => {
  if (debounceTimer) {
    window.clearTimeout(debounceTimer);
  }

  if (!value.trim()) {
    results.value = [];
    error.value = "";
    open.value = false;
    return;
  }

  open.value = true;
  debounceTimer = window.setTimeout(() => {
    void runSearch();
  }, 250);
});

function handleDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node | null;
  if (!target || !containerRef.value) {
    return;
  }

  if (!containerRef.value.contains(target)) {
    open.value = false;
  }
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    focusSearch();
  }
}

onMounted(() => {
  window.addEventListener("pointerdown", handleDocumentPointerDown);
  window.addEventListener("keydown", handleDocumentKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", handleDocumentPointerDown);
  window.removeEventListener("keydown", handleDocumentKeydown);

  if (debounceTimer) {
    window.clearTimeout(debounceTimer);
  }
});

defineExpose({
  focusSearch,
});
</script>

<template>
  <div
    ref="containerRef"
    class="relative flex w-full justify-center overflow-visible px-6"
  >
    <form class="relative w-full max-w-md" @submit.prevent="submitSearch">
      <div
        class="relative flex h-8 w-full items-center rounded-lg border border-slate-200/60 bg-slate-100/60 pl-9 pr-10 text-left text-muted-sm transition-colors hover:bg-slate-100/90"
      >
        <UIcon
          name="i-lucide-search"
          class="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400"
        />
        <input
          ref="inputRef"
          v-model="query"
          type="search"
          placeholder="Rechercher…"
          class="h-full w-full bg-transparent pr-8 outline-none placeholder:text-slate-400"
          @focus="open = true"
        />
        <kbd
          class="absolute right-3 hidden font-mono text-[10px] text-slate-400 sm:inline"
        >
          ⌘K
        </kbd>
      </div>
    </form>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div
        v-if="open && hasSearch"
        class="absolute left-1/2 top-full z-50 mt-2 max-h-96 w-[min(100vw-1.5rem,42rem)] -translate-x-1/2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
      >
        <div v-if="loading" class="px-4 py-3 text-muted-sm">
          Recherche en cours...
        </div>

        <div v-else-if="error" class="px-4 py-3 text-xs text-red-600">
          {{ error }}
        </div>

        <div v-else-if="results.length" class="space-y-2">
          <NuxtLink
            v-for="result in results"
            :key="result.key"
            :to="result.href"
            class="group flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50"
            @click="open = false"
          >
            <div
              class="flex h-10 w-10 flex-none items-center justify-center rounded-xl"
              :class="
                result.kind === 'prospect'
                  ? 'bg-slate-100 text-slate-700'
                  : result.kind === 'email'
                    ? 'bg-sky-50 text-sky-600'
                    : result.kind === 'quote'
                      ? 'bg-amber-50 text-amber-600'
                      : result.kind === 'contract'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-slate-100 text-slate-700'
              "
            >
              <UIcon :name="result.icon" class="h-4 w-4" />
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <div class="truncate text-xs font-semibold text-slate-900">
                  {{ result.title }}
                </div>
                <UBadge color="neutral" variant="soft" class="shrink-0">
                  {{ result.badge }}
                </UBadge>
              </div>
              <div class="truncate text-muted-sm">
                {{ result.subtitle }}
              </div>
            </div>

            <UIcon
              name="i-lucide-arrow-right"
              class="h-4 w-4 flex-none text-slate-400 transition group-hover:translate-x-0.5"
            />
          </NuxtLink>
        </div>

        <div v-else class="px-4 py-3 text-muted-sm">Aucun résultat.</div>
      </div>
    </Transition>
  </div>
</template>
