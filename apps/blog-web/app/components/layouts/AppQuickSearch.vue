<script setup lang="ts">
import { searchIntentLabels } from "~/constants/enums";
import { searchResultKindColorClassMap } from "~/constants/search";
import type { SearchResultItem } from "~/types/search";
import type { KeywordRecord } from "~/types/keywords";
import { normalizeSearchText } from "~/utils/search-normalizer";

const { search: searchRequest } = useSearch();
const { listKeywords } = useKeywords();
const containerRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const query = ref("");
const open = ref(false);
const loading = ref(false);
const error = ref("");
const results = ref<SearchResultItem[]>([]);
const { data: quickSearchKeywords } = await useAsyncData(
  "keywords:quick-search",
  () => listKeywords(),
  {
    default: () => [],
  },
);
const hasSearch = computed(() => query.value.trim().length > 0);
const keywordMatches = computed(() => {
  const normalizedQuery = normalizeSearchText(query.value);

  if (!normalizedQuery) {
    return [] as KeywordRecord[];
  }

  return (quickSearchKeywords.value ?? [])
    .filter((keyword) =>
      normalizeSearchText(keyword.keyword).includes(normalizedQuery),
    )
    .sort((left, right) => {
      const leftRank = getKeywordMatchRank(left.keyword, normalizedQuery);
      const rightRank = getKeywordMatchRank(right.keyword, normalizedQuery);

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return (
        (right.lastScannedAt ? 1 : 0) - (left.lastScannedAt ? 1 : 0) ||
        (right.volume ?? 0) - (left.volume ?? 0) ||
        left.keyword.localeCompare(right.keyword)
      );
    })
    .slice(0, 6);
});
const displayedResults = computed(() => [
  ...results.value,
  ...mapKeywordResults(keywordMatches.value),
]);
const resultSummaryItems = computed(() => {
  const counts: Record<SearchResultItem["kind"], number> = {
    "agency-site": 0,
    blog: 0,
    author: 0,
    "blog-article": 0,
    "seo-cluster": 0,
    keyword: 0,
  };

  for (const result of displayedResults.value) {
    counts[result.kind] += 1;
  }

  return [
    { key: "blog-article", label: "Articles", count: counts["blog-article"] },
    { key: "seo-cluster", label: "Clusters", count: counts["seo-cluster"] },
    { key: "blog", label: "Blogs", count: counts.blog },
    { key: "author", label: "Auteurs", count: counts.author },
    { key: "agency-site", label: "Sites", count: counts["agency-site"] },
    { key: "keyword", label: "Mots-clés", count: counts.keyword },
  ].filter((item) => item.count > 0);
});

let searchTimer: ReturnType<typeof setTimeout> | null = null;
let cleanupPointerDown: (() => void) | null = null;
let cleanupKeyDown: (() => void) | null = null;

watch(query, (value) => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    results.value = [];
    error.value = "";
    loading.value = false;
    return;
  }

  open.value = true;

  searchTimer = setTimeout(() => {
    void search(trimmedValue);
  }, 250);
});

onMounted(() => {
  const handlePointerDown = (event: MouseEvent) => {
    if (!containerRef.value) {
      return;
    }

    if (!containerRef.value.contains(event.target as Node)) {
      open.value = false;
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const isShortcut =
      (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p";

    if (isShortcut) {
      event.preventDefault();
      open.value = true;
      inputRef.value?.focus();
    }

    if (event.key === "Escape") {
      open.value = false;
      inputRef.value?.blur();
    }
  };

  document.addEventListener("mousedown", handlePointerDown);
  document.addEventListener("keydown", handleKeyDown);

  cleanupPointerDown = () => {
    document.removeEventListener("mousedown", handlePointerDown);
  };

  cleanupKeyDown = () => {
    document.removeEventListener("keydown", handleKeyDown);
  };
});

onBeforeUnmount(() => {
  cleanupPointerDown?.();
  cleanupKeyDown?.();

  if (searchTimer) {
    clearTimeout(searchTimer);
  }
});

async function submitSearch() {
  if (!hasSearch.value) {
    return;
  }

  await search(query.value.trim());
}

async function search(rawQuery: string) {
  loading.value = true;
  error.value = "";

  try {
    const response: SearchResponse = await searchRequest(rawQuery);

    if (response.createdAgencySite) {
      await refreshNuxtData("agency-sites");
    }

    results.value = mapResults(response);
  } catch (searchError) {
    results.value = [];
    error.value =
      searchError instanceof Error
        ? searchError.message
        : "Une erreur est survenue pendant la recherche.";
  } finally {
    loading.value = false;
  }
}

function getKeywordMatchRank(keyword: string, normalizedQuery: string) {
  const normalizedKeyword = normalizeSearchText(keyword);

  if (normalizedKeyword === normalizedQuery) {
    return 0;
  }

  if (normalizedKeyword.startsWith(normalizedQuery)) {
    return 1;
  }

  return 2;
}

function getKeywordResultTo(keyword: KeywordRecord) {
  if (keyword.lastScannedAt) {
    return `/keywords/research?q=${encodeURIComponent(keyword.keyword)}&autorun=0`;
  }

  return `/keywords/search?q=${encodeURIComponent(keyword.keyword)}`;
}

function getKeywordResultSubtitle(keyword: KeywordRecord) {
  const parts = [
    keyword.volume ? `${keyword.volume.toLocaleString("fr-FR")} volume` : null,
    keyword.searchIntent
      ? searchIntentLabels[
          keyword.searchIntent as keyof typeof searchIntentLabels
        ]
      : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : "Mot-clé enregistré";
}

function mapKeywordResults(keywords: KeywordRecord[]): SearchResultItem[] {
  return keywords.map((keyword) => ({
    key: `keyword-${keyword.id}`,
    kind: "keyword" as const,
    icon: keyword.lastScannedAt
      ? "i-lucide-scan-search"
      : "i-lucide-search",
    badge: keyword.lastScannedAt ? "Analysé" : "Mot-clé",
    title: keyword.keyword,
    subtitle: getKeywordResultSubtitle(keyword),
    to: getKeywordResultTo(keyword),
  }));
}

function isNonNullableResult<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function mapResults(response: SearchResponse): SearchResultItem[] {
  return [
    ...response.competitorAgencySites
      .filter(isNonNullableResult)
      .map((site) => ({
        key: `agency-site-${site.id}`,
        kind: "agency-site" as const,
        icon: "i-lucide-building-2",
        badge: "Agency Site",
        title: site.name || "Site sans nom",
        subtitle: site.baseUrl || "",
        to: `/competitor-agency-sites/${site.id}`,
      })),
    ...response.blogs
      .filter(isNonNullableResult)
      .map((blog) => ({
        key: `blog-${blog.id}`,
        kind: "blog" as const,
        icon: "i-lucide-rss",
        badge: "Blog",
        title: blog.title || blog.name || blog.baseUrl || "Blog sans titre",
        subtitle: `${blog.competitorAgencySite?.name || "Site"} - ${blog.baseUrl || ""}`,
        to: `/competitor-agency-blogs/${blog.id}`,
      })),
    ...response.authors
      .filter(isNonNullableResult)
      .map((author) => ({
        key: `author-${author.id}`,
        kind: "author" as const,
        icon: "i-lucide-user-round",
        badge: "Author",
        title: author.name || "Auteur sans nom",
        subtitle:
          author.profileUrl ||
          author.blogs[0]?.title ||
          author.blogs[0]?.name ||
          author.blogs[0]?.baseUrl ||
          "Auteur sans profil externe",
        to: `/competitor-agency-authors/${author.id}`,
      })),
    ...response.blogArticles
      .filter(isNonNullableResult)
      .map((article) => ({
        key: `blog-article-${article.id}`,
        kind: "blog-article" as const,
        icon: "i-lucide-file-text",
        badge: "Article",
        title: article.title || "Article sans titre",
        subtitle: `${article.blog?.title || article.blog?.name || "Blog"}${article.author ? ` - ${article.author.name}` : ""}`,
        to: `/competitor-agency-blog-articles/${article.id}`,
      })),
    ...response.seoClusters
      .filter(isNonNullableResult)
      .map((cluster) => ({
        key: `seo-cluster-${cluster.id}`,
        kind: "seo-cluster" as const,
        icon: cluster.icon
          ? `i-lucide-${cluster.icon.replace(/^i-lucide-/, "")}`
          : "i-lucide-folder-kanban",
        badge: "Cluster",
        title: cluster.name || "Cluster sans nom",
        subtitle: `${cluster.primaryKeyword || "Mot-clé"}${cluster.slug ? ` - /${cluster.slug}` : ""}`,
        to: `/clusters/${cluster.id}`,
      })),
  ].filter(isNonNullableResult);
}
</script>

<template>
  <div
    ref="containerRef"
    class="md:relative flex w-full justify-center overflow-visible px-6"
  >
    <form class="relative w-full max-w-lg" @submit.prevent="submitSearch">
      <div
        class="relative overflow-hidden flex h-8 w-full items-center rounded-lg border border-slate-200/60 bg-slate-100/60 pl-9 md:pr-20 text-left text-muted-sm transition-colors hover:bg-slate-100/90"
      >
        <UIcon
          name="i-lucide-search"
          class="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400"
        />
        <input
          ref="inputRef"
          v-model="query"
          type="search"
          placeholder="Rechercher un site, blog, auteur, article ou cluster…"
          class="h-full w-full bg-white text-xs md:text-sm pl-4 pr-8 outline-none placeholder:text-slate-400"
          @focus="open = true"
        />
        <div
          class="absolute right-3 hidden font-mono text-[10px] text-slate-400 sm:inline"
        >
          <!-- <UIcon name="i-lucide-command" class="h-3 w-3" /> -->
          <kbd class="rounded border border-slate-950/10 bg-slate-100/50 p-1">⌘</kbd>
          +
          <kbd class="rounded border border-slate-950/10 bg-slate-100/50 p-1">P</kbd>
        </div>
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
        class="absolute left-1/2 top-full z-50 mt-2 flex w-[min(100vw-1.5rem,42rem)] -translate-x-1/2 flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div v-if="loading" class="px-4 py-4 text-muted-sm">
          Recherche en cours...
        </div>

        <div v-else-if="error" class="px-4 py-4 text-xs text-red-600">
          {{ error }}
        </div>

        <template v-else-if="results.length">
          <div class="border-b border-slate-200 px-3 py-3">
            <div class="flex flex-wrap gap-2">
              <UBadge
                v-for="item in resultSummaryItems"
                :key="item.key"
                color="neutral"
                variant="soft"
                class="rounded-full px-3 py-1"
              >
                {{ item.label }} : {{ item.count }}
              </UBadge>
            </div>
          </div>

          <div
            class="h-109.5 scroll-py-2 overflow-y-auto snap-y snap-mandatory snap-padding-top-2"
          >
            <div class="flex flex-col gap-2 p-2">
              <NuxtLink
                v-for="result in displayedResults"
                :key="result.key"
                :to="result.to"
                class="group flex min-h-[4.8rem] snap-start items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50"
                @click="open = false"
              >
                <div
                  class="flex h-10 w-10 flex-none items-center justify-center rounded-xl"
                  :class="searchResultKindColorClassMap[result.kind]"
                >
                  <UIcon :name="result.icon" class="h-4 w-4" />
                </div>

                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex items-end justify-between gap-2">
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

                <!-- <UIcon
                  name="i-lucide-arrow-up-right"
                  class="h-4 w-4 flex-none text-slate-400 transition group-hover:translate-x-0.5"
                /> -->
              </NuxtLink>
            </div>
          </div>
        </template>

        <div v-else class="px-4 py-4 text-muted-sm">Aucun résultat.</div>
      </div>
    </Transition>
  </div>
</template>
