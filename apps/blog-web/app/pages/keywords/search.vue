<script setup lang="ts">
import AppViewModeSwitch from "~/components/common/AppViewModeSwitch.vue";
import KeywordSuggestionsList from "~/components/keyword-research/KeywordSuggestionsList.vue";
import KeywordSheeterResultCard from "~/components/keywords/KeywordSheeterResultCard.vue";
import KeywordSheeterResultsTable from "~/components/keywords/KeywordSheeterResultsTable.vue";
import { KeywordIntent, type KeywordSuggestion } from "~/types/keyword-analysis";
import type { KeywordRecord } from "~/types/keywords";
import type {
  KeywordSheeterAnalysis,
  KeywordSheeterSearchResultItem,
  KeywordSheeterSuggestion,
} from "~/types/keyword-sheeter";
import { normalizeSearchText } from "~/utils/search-normalizer";

const route = useRoute();
const router = useRouter();
const { suggestGoogleKeywords, createKeyword, setKeywordFavorite, listKeywords } =
  useKeywords();
const { analyzeKeyword: analyzeKeywordRequest, suggestKeywords } =
  useKeywordAnalysis();

const searchTerm = ref("");
const isSearching = ref(false);
const searchError = ref("");
const keywordSheeterViewMode = useCookie<"cards" | "table">(
  "keyword-sheeter-view-mode",
  {
    default: () => "cards",
  },
);
const suggestions = ref<KeywordSuggestion[]>([]);
const isLoadingSuggestions = ref(false);
const showSuggestions = ref(false);
const activeSuggestionIndex = ref(-1);
const analyzingKeywords = ref<string[]>([]);
const isAnalyzingAllKeywords = ref(false);
const addingToBaseKeywords = ref<string[]>([]);
const addingToBaseAndFavoriteKeywords = ref<string[]>([]);
const analysisByKeyword = ref<Record<string, KeywordSheeterAnalysis>>({});
const searchResult = ref<{
  query: string;
  total: number;
  suggestions: KeywordSheeterSuggestion[];
} | null>(null);
const { data: storedKeywords } = await useAsyncData(
  "keywords:search:stored-keywords",
  () => listKeywords(),
);
let suggestionFetchTimer: ReturnType<typeof setTimeout> | null = null;
const searchLanguage = computed(() =>
  typeof route.query.hl === "string" && route.query.hl.trim()
    ? route.query.hl.trim()
    : "fr",
);
const searchCountry = computed(() =>
  typeof route.query.gl === "string" && route.query.gl.trim()
    ? route.query.gl.trim()
    : "fr",
);
const breadcrumbItems = [
  {
    label: "Mots-clés",
    to: "/keywords/list",
  },
  {
    label: "Recherche",
  },
];

onBeforeUnmount(() => {
  if (suggestionFetchTimer) {
    clearTimeout(suggestionFetchTimer);
  }
});

async function syncSearchQuery(keyword: string) {
  const normalizedKeyword = keyword.trim();
  const currentQuery = typeof route.query.q === "string" ? route.query.q : "";
  const currentLanguage =
    typeof route.query.hl === "string" && route.query.hl.trim()
      ? route.query.hl.trim()
      : "fr";
  const currentCountry =
    typeof route.query.gl === "string" && route.query.gl.trim()
      ? route.query.gl.trim()
      : "fr";

  if (
    currentQuery === normalizedKeyword &&
    currentLanguage === searchLanguage.value &&
    currentCountry === searchCountry.value
  ) {
    return;
  }

  await router.replace({
    query: {
      ...route.query,
      q: normalizedKeyword || undefined,
      hl: searchLanguage.value,
      gl: searchCountry.value,
    },
  });
}

function resetSuggestions() {
  suggestions.value = [];
  showSuggestions.value = false;
  activeSuggestionIndex.value = -1;
}

function normalizeKeyword(keyword: string) {
  return normalizeSearchText(keyword);
}

function selectSuggestion(suggestion: KeywordSuggestion) {
  searchTerm.value = suggestion.keyword;
  resetSuggestions();
}

function isAddingToBase(keyword: string) {
  return addingToBaseKeywords.value.includes(normalizeKeyword(keyword));
}

function isAddingToBaseAndFavorite(keyword: string) {
  return addingToBaseAndFavoriteKeywords.value.includes(
    normalizeKeyword(keyword),
  );
}

function isAnalyzingKeyword(keyword: string) {
  return analyzingKeywords.value.includes(normalizeKeyword(keyword));
}

const storedKeywordsByKey = computed(() => {
  const keywords = storedKeywords.value ?? [];
  const map = new Map<string, KeywordRecord>();

  for (const keyword of keywords) {
    map.set(normalizeKeyword(keyword.keyword), keyword);
  }

  return map;
});

const searchResultItems = computed<KeywordSheeterSearchResultItem[]>(() => {
  const suggestions = searchResult.value?.suggestions ?? [];

  return suggestions.map((item) => {
    const keywordKey = normalizeKeyword(item.keyword);
    const existingKeyword = storedKeywordsByKey.value.get(keywordKey) ?? null;
    const analysis =
      analysisByKeyword.value[keywordKey] ??
      (existingKeyword?.lastScannedAt
        ? {
            volume: existingKeyword.volume ?? null,
            difficulty: existingKeyword.difficulty ?? null,
            intent:
              existingKeyword.searchIntent ?? KeywordIntent.INFORMATIONAL,
          }
        : null);
    const canAddToBase = !existingKeyword;

    return {
      ...item,
      existingKeyword,
      analysis,
      canAnalyze: !analysis,
      canAddToBase,
      canAddToBaseAndFavorite: canAddToBase,
    };
  });
});

const pendingSearchResultAnalysisCount = computed(() => {
  return searchResultItems.value.filter((item) => item.canAnalyze).length;
});

async function addKeywordToBase(keyword: string) {
  const normalizedKeyword = keyword.trim();

  if (
    !normalizedKeyword ||
    isAddingToBase(normalizedKeyword) ||
    storedKeywordsByKey.value.has(normalizeKeyword(normalizedKeyword))
  ) {
    return;
  }

  addingToBaseKeywords.value = [
    ...addingToBaseKeywords.value,
    normalizedKeyword.toLowerCase(),
  ];

  try {
    const response = await createKeyword({
      keyword: normalizedKeyword,
    });

    storedKeywords.value = [
      ...(storedKeywords.value ?? []),
      response.keyword,
    ];
  } finally {
    addingToBaseKeywords.value = addingToBaseKeywords.value.filter(
      (item) => item !== normalizedKeyword.toLowerCase(),
    );
  }
}

async function addKeywordToBaseAndFavorite(keyword: string) {
  const normalizedKeyword = keyword.trim();

  if (
    !normalizedKeyword ||
    isAddingToBaseAndFavorite(normalizedKeyword) ||
    storedKeywordsByKey.value.has(normalizeKeyword(normalizedKeyword))
  ) {
    return;
  }

  addingToBaseAndFavoriteKeywords.value = [
    ...addingToBaseAndFavoriteKeywords.value,
    normalizedKeyword.toLowerCase(),
  ];

  try {
    const response = await createKeyword({
      keyword: normalizedKeyword,
      isFavorite: true,
    });

    if (!response.keyword.isFavorite) {
      await setKeywordFavorite(response.keyword.id, true);
    }

    storedKeywords.value = [
      ...(storedKeywords.value ?? []),
      response.keyword,
    ];
  } finally {
    addingToBaseAndFavoriteKeywords.value =
      addingToBaseAndFavoriteKeywords.value.filter(
        (item) => item !== normalizedKeyword.toLowerCase(),
      );
  }
}

async function analyzeSheeterKeyword(keyword: string) {
  const normalizedKeyword = keyword.trim();

  if (!normalizedKeyword || isAnalyzingKeyword(normalizedKeyword)) {
    return;
  }

  analyzingKeywords.value = [
    ...analyzingKeywords.value,
    normalizedKeyword.toLowerCase(),
  ];

  try {
    const response = await analyzeKeywordRequest(normalizedKeyword);
    analysisByKeyword.value = {
      ...analysisByKeyword.value,
      [normalizedKeyword.toLowerCase()]: {
        volume: response.volume,
        difficulty: response.difficulty,
        intent: response.intent,
      },
    };
  } catch (error) {
    console.error(error);
  } finally {
    analyzingKeywords.value = analyzingKeywords.value.filter(
      (item) => item !== normalizedKeyword.toLowerCase(),
    );
  }
}

async function analyzeSearchResultList() {
  if (!searchResultItems.value.length || isAnalyzingAllKeywords.value) {
    return;
  }

  isAnalyzingAllKeywords.value = true;

  try {
    const skippedKeywords: string[] = [];

    for (const item of searchResultItems.value) {
      if (!item.canAnalyze) {
        continue;
      }

      await analyzeSheeterKeyword(item.keyword);

      if (!analysisByKeyword.value[normalizeKeyword(item.keyword)]) {
        skippedKeywords.push(item.keyword);
      }
    }

    if (skippedKeywords.length > 0) {
      console.warn(
        "[keyword-search] Some keywords were skipped during bulk analysis:",
        skippedKeywords,
      );
    }
  } finally {
    isAnalyzingAllKeywords.value = false;
  }
}

async function loadSuggestions(query: string) {
  const trimmedQuery = query.trim();

  if (trimmedQuery !== "" && trimmedQuery.length < 2) {
    resetSuggestions();
    return;
  }

  isLoadingSuggestions.value = true;

  try {
    const response = await suggestKeywords(trimmedQuery);

    if (searchTerm.value.trim() !== trimmedQuery) {
      return;
    }

    suggestions.value = response;
    showSuggestions.value = response.length > 0;
    activeSuggestionIndex.value = -1;
  } catch (error) {
    suggestions.value = [];
    showSuggestions.value = false;
    activeSuggestionIndex.value = -1;
    console.error(error);
  } finally {
    isLoadingSuggestions.value = false;
  }
}

function scheduleSuggestions(query: string) {
  if (suggestionFetchTimer) {
    clearTimeout(suggestionFetchTimer);
  }

  suggestionFetchTimer = setTimeout(() => {
    void loadSuggestions(query);
  }, 180);
}

function onSearchInput(value: string) {
  searchTerm.value = value;
  scheduleSuggestions(value);
}

function onSearchFocus() {
  if (!searchTerm.value.trim()) {
    void loadSuggestions("");
    return;
  }

  if (suggestions.value.length > 0) {
    showSuggestions.value = true;
  }
}

function onSearchBlur() {
  setTimeout(() => {
    showSuggestions.value = false;
    activeSuggestionIndex.value = -1;
  }, 120);
}

function onSearchKeydown(event: KeyboardEvent) {
  if (!showSuggestions.value || suggestions.value.length === 0) {
    if (event.key === "Enter") {
      event.preventDefault();
      void searchKeywords();
    }

    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    activeSuggestionIndex.value =
      activeSuggestionIndex.value < suggestions.value.length - 1
        ? activeSuggestionIndex.value + 1
        : 0;
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    activeSuggestionIndex.value =
      activeSuggestionIndex.value > 0
        ? activeSuggestionIndex.value - 1
        : suggestions.value.length - 1;
    return;
  }

  if (event.key === "Escape") {
    resetSuggestions();
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();

    if (activeSuggestionIndex.value >= 0) {
      selectSuggestion(suggestions.value[activeSuggestionIndex.value]!);
    }

    void searchKeywords();
  }
}

async function searchKeywords(queryOverride?: string | Event) {
  const effectiveQuery =
    typeof queryOverride === "string" ? queryOverride : searchTerm.value;
  const trimmedQuery = effectiveQuery.trim();

  if (!trimmedQuery || isSearching.value) {
    return;
  }

  searchTerm.value = trimmedQuery;
  isSearching.value = true;
  searchError.value = "";
  resetSuggestions();

  try {
    const response = await suggestGoogleKeywords(trimmedQuery, {
      limit: 120,
      expand: true,
      language: searchLanguage.value,
      country: searchCountry.value,
    });

    searchResult.value = response;
    await syncSearchQuery(trimmedQuery);
  } catch (error) {
    searchResult.value = null;
    searchError.value =
      error instanceof Error
        ? error.message
        : "Impossible de récupérer les suggestions.";
  } finally {
    isSearching.value = false;
  }
}

onMounted(() => {
  const initialQuery =
    typeof route.query.q === "string" ? route.query.q.trim() : "";

  if (!initialQuery) {
    return;
  }

  searchTerm.value = initialQuery;
  void searchKeywords(initialQuery);
});
</script>

<template>
  <section class="space-y-6">
    <UBreadcrumb :items="breadcrumbItems" class="text-slate-500" />

    <!-- <div class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900">
        Recherche de mots-clés
      </h1>
      <p class="text-sm text-slate-500">
        Lance une recherche sur Google Suggest pour générer une liste d'idées de
        mots-clés.
      </p>
    </div> -->

    <div class=" rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end">
        <label
          for="keyword-discovery-search"
          class="relative block flex-1 text-sm font-medium text-slate-700"
        >
          <span class="mb-2 block">Mot-clé de départ</span>

          <UInput
            id="keyword-discovery-search"
            v-model="searchTerm"
            size="xl"
            icon="i-lucide-search"
            placeholder="Ex. audit seo, shopify, crm..."
            class="w-full"
            autocomplete="off"
            @update:model-value="onSearchInput"
            @focus="onSearchFocus"
            @blur="onSearchBlur"
            @keydown="onSearchKeydown"
          />

          <KeywordSuggestionsList
            :show="showSuggestions"
            :is-loading="isLoadingSuggestions"
            :suggestions="suggestions"
            :active-suggestion-index="activeSuggestionIndex"
            @select="selectSuggestion"
          />
        </label>

        <UButton
          size="xl"
          icon="i-lucide-scan-search"
          :loading="isSearching"
          :disabled="!searchTerm.trim()"
          @click="searchKeywords"
        >
          {{ isSearching ? "Recherche..." : "Lancer la recherche" }}
        </UButton>
      </div>
    </div>

    <FeedbackRichMessage
      v-if="!searchResult && !isSearching && !searchError"
      tone="info"
      title="Prêt à générer des suggestions"
      description="Entre un mot-clé de départ puis lance la recherche pour obtenir une liste de variantes issues de Google Suggest."
      class="mt-2"
    />

    <FeedbackInlineMessage
      v-else-if="searchError"
      tone="error"
      class="animate-pulse"
    >
      {{ searchError }}
    </FeedbackInlineMessage>

    <div v-else class="flex justify-end">
      <AppViewModeSwitch
        v-model="keywordSheeterViewMode"
        :items="[
          { value: 'cards', label: 'Cards', icon: 'i-lucide-layout-grid' },
          { value: 'table', label: 'Tableau', icon: 'i-lucide-table-properties' },
        ]"
      />
    </div>

    <div
      v-if="searchResult"
      class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div
        class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
      >
        <div>
          <h2 class="text-lg font-semibold text-slate-900">
            Résultats pour "{{ searchResult.query }}"
          </h2>
          <p class="text-sm text-slate-500">
            {{ searchResult.total }} suggestion(s) trouvée(s)
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-chart-column-big"
            :loading="isAnalyzingAllKeywords"
            :disabled="
              !searchResultItems.length ||
              isAnalyzingAllKeywords ||
              pendingSearchResultAnalysisCount === 0
            "
            @click="analyzeSearchResultList"
          >
            {{
              isAnalyzingAllKeywords
                ? "Analyse en cours..."
                : `Analyser la liste${pendingSearchResultAnalysisCount > 0 ? ` (${pendingSearchResultAnalysisCount})` : ""}`
            }}
          </UButton>
        </div>
      </div>

      <template v-if="searchResultItems.length">
        <div
          v-if="keywordSheeterViewMode === 'cards'"
          class="mt-5 grid gap-4 lg:grid-cols-2"
        >
          <KeywordSheeterResultCard
            v-for="item in searchResultItems"
            :key="`${item.keyword}-${item.sourceQuery}`"
            :item="item"
            :is-analyzing="isAnalyzingKeyword(item.keyword)"
            @analyze="analyzeSheeterKeyword"
            @add-to-base="addKeywordToBase"
            @add-to-base-and-favorite="addKeywordToBaseAndFavorite"
          />
        </div>

        <KeywordSheeterResultsTable
          v-else
          :items="searchResultItems"
          :analyzing-keywords="analyzingKeywords"
          :adding-to-base-keywords="addingToBaseKeywords"
          :adding-to-base-and-favorite-keywords="
            addingToBaseAndFavoriteKeywords
          "
          @analyze="analyzeSheeterKeyword"
          @add-to-base="addKeywordToBase"
          @add-to-base-and-favorite="addKeywordToBaseAndFavorite"
        />
      </template>

      <FeedbackRichMessage
        v-else
        tone="warning"
        title="Aucune suggestion trouvée"
        description="Essaie avec un mot-clé plus large ou plus proche d'un besoin réel."
        class="mt-5"
      />
    </div>
  </section>
</template>
