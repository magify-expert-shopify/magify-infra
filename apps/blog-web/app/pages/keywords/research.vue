<script setup lang="ts">
import { marked } from "marked";
import { defaultKeywordDifficultyLevels } from "~/constants/keyword-difficulty";
import type {
  KeywordSheeterResponse,
  KeywordSheeterSuggestion,
} from "~/types/keyword-sheeter";
import {
  type KeywordAnalysisAiReview,
  KeywordIntent,
  type KeywordAnalysisResponse,
  type KeywordAnalysisSerpResult,
  type KeywordSuggestion,
} from "~/types/keyword-analysis";
import type { KeywordResearchRow } from "~/types/keyword-research";
import { getKeywordDifficultyLabel } from "~/utils/keyword-difficulty";
import { buildKeywordResearchUrl } from "~/utils/keyword-research-url";
import { formatKeywordIntent } from "~/utils/keyword-intent";
import { normalizeSearchText } from "~/utils/search-normalizer";

const {
  analyzeKeyword: analyzeKeywordRequest,
  analyzeKeywordWithAi,
  getStoredKeywordAnalysis,
  suggestKeywords,
} = useKeywordAnalysis();
const {
  createKeyword,
  deleteKeyword: deleteKeywordRequest,
  listKeywords,
  suggestGoogleKeywords,
} = useKeywords();
const { getKeywordAnalysisPrompt, getKeywordDifficultyLevels } = useSettings();
const { showErrorToast, showSuccessToast } = useAppToast();
const route = useRoute();
const router = useRouter();
const searchTerm = ref("");
const isAnalyzing = ref(false);
const isAnalyzingWithAi = ref(false);
const isDeletingKeyword = ref(false);
const analysis = ref<KeywordAnalysisResponse | null>(null);
const aiReview = ref<KeywordAnalysisAiReview | null>(null);
const isAiReviewModalOpen = ref(false);
const keywordRows = ref<KeywordResearchRow[]>([]);
const suggestions = ref<KeywordSuggestion[]>([]);
const relatedGoogleSuggestions = ref<KeywordSheeterSuggestion[]>([]);
const isLoadingSuggestions = ref(false);
const isLoadingRelatedGoogleSuggestions = ref(false);
const showSuggestions = ref(false);
const activeSuggestionIndex = ref(-1);
let suggestionFetchTimer: ReturnType<typeof setTimeout> | null = null;
let relatedSuggestionRequestId = 0;
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

const keywordAnalysisPromptSettings = await getKeywordAnalysisPrompt();
const { data: keywordDifficultyLevelsSettings } = await useAsyncData(
  "settings:keyword-difficulty-levels",
  () => getKeywordDifficultyLevels(),
);
const keywordDifficultyLevels = computed(
  () =>
    keywordDifficultyLevelsSettings.value?.levels ??
    defaultKeywordDifficultyLevels,
);
const breadcrumbItems = [
  {
    label: "Mots-clés",
    to: "/keywords/list",
  },
  {
    label: "Étude de mots-clés",
  },
];

const analysisMonthlySearches = computed(
  () => analysis.value?.monthlySearches ?? [],
);
const chatGptAnalysisUrl = computed(() => {
  if (!analysis.value) {
    return "";
  }

  const prompt = buildChatGptAnalysisPrompt(
    keywordAnalysisPromptSettings.input,
    analysis.value,
  );

  return `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
});
const aiReviewHtml = computed(() => {
  if (!aiReview.value?.review?.trim()) {
    return "";
  }

  return marked.parse(aiReview.value.review, {
    breaks: true,
  });
});

async function copyMiniScanToClipboard() {
  const miniScan = analysis.value?.miniScan?.trim();

  if (!miniScan) {
    showErrorToast(
      "Impossible de copier le mini scan",
      "Aucun résultat IA n'est disponible pour ce mot-clé.",
    );
    return;
  }

  try {
    await navigator.clipboard.writeText(miniScan);
    showSuccessToast(
      "Mini scan copié",
      "Le résultat du mini scan IA a été copié dans le presse-papiers.",
    );
  } catch (error) {
    console.error("[Research] mini scan copy failed", error);
    showErrorToast(
      "Copie impossible",
      "Le navigateur n'a pas autorisé l'accès au presse-papiers.",
    );
  }
}

function getIntentDescription(intent: KeywordAnalysisResponse["intent"]) {
  if (intent === KeywordIntent.TRANSACTIONAL) {
    return "L'utilisateur veut passer à l'action rapidement : acheter, demander un devis, réserver ou démarrer une solution.";
  }

  if (intent === KeywordIntent.COMMERCIAL) {
    return "L'utilisateur compare des options avant de choisir une solution, un outil, une agence ou une offre.";
  }

  if (intent === KeywordIntent.NAVIGATIONAL) {
    return "L'utilisateur cherche une marque, un site, un outil ou une page précise qu'il a déjà en tête.";
  }

  return "L'utilisateur cherche avant tout à comprendre un sujet, apprendre, ou trouver une réponse à sa question.";
}

function formatSerpType(type: string) {
  if (type === "organic") {
    return "Résultat naturel";
  }

  if (type === "paid") {
    return "Annonce";
  }

  if (type === "featured_snippet") {
    return "Extrait optimisé";
  }

  if (type === "people_also_ask") {
    return "Autres questions";
  }

  if (type === "video") {
    return "Vidéo";
  }

  if (type === "images") {
    return "Images";
  }

  if (type === "local_pack") {
    return "Pack local";
  }

  return type.replaceAll("_", " ");
}

function getSerpTypeIcon(type: string) {
  if (type === "organic") {
    return "i-lucide-globe";
  }

  if (type === "paid") {
    return "i-lucide-badge-dollar-sign";
  }

  if (type === "featured_snippet") {
    return "i-lucide-sparkles";
  }

  if (type === "people_also_ask") {
    return "i-lucide-message-circle-question";
  }

  if (type === "video") {
    return "i-lucide-play-square";
  }

  if (type === "images") {
    return "i-lucide-image";
  }

  if (type === "local_pack") {
    return "i-lucide-map-pinned";
  }

  return "i-lucide-file-search";
}

function getSerpTypeColor(type: string) {
  if (type === "organic") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200";
  }

  if (type === "paid") {
    return "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200";
  }

  if (type === "featured_snippet") {
    return "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200";
  }

  if (type === "people_also_ask") {
    return "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200";
  }

  if (type === "video") {
    return "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200";
  }

  if (type === "images") {
    return "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-inset ring-fuchsia-200";
  }

  if (type === "local_pack") {
    return "bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200";
  }

  return "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200";
}

function getSerpTypeDescription(result: KeywordAnalysisSerpResult) {
  if (result.type === "paid") {
    return "Résultat sponsorisé affiché dans la SERP.";
  }

  if (result.type === "featured_snippet") {
    return "Bloc mis en avant par Google pour répondre directement à la requête.";
  }

  if (result.type === "people_also_ask") {
    return "Question complémentaire proposée par Google autour de ce sujet.";
  }

  if (result.type === "video") {
    return "Résultat vidéo affiché dans la page de résultats.";
  }

  if (result.type === "images") {
    return "Résultat issu d’un bloc visuel ou image dans la SERP.";
  }

  if (result.type === "local_pack") {
    return "Résultat local affiché dans le pack map / établissements.";
  }

  return "Résultat naturel classique de la page de recherche.";
}

function getKnownAgencySiteLabel(result: KeywordAnalysisSerpResult) {
  if (!result.knownAgencySite) {
    return "";
  }

  return `Site agence connu : ${result.knownAgencySite.name}`;
}

function isShopifyResult(url: string) {
  return url.startsWith("https://www.shopify.com/");
}

function isMagifyResult(url: string) {
  return url.startsWith("https://magify.fr/");
}

function getSerpResultCardClass(result: KeywordAnalysisSerpResult) {
  if (isMagifyResult(result.url)) {
    return "border border-emerald-300 bg-emerald-50";
  }

  if (isShopifyResult(result.url) || result.type !== "organic") {
    return "opacity-50";
  }

  return "";
}

function inferUserProblem(keyword: string, intention: string) {
  if (intention === "Transactionnelle") {
    return `Trouver rapidement la meilleure solution pour "${keyword}" et passer à l'action.`;
  }

  if (intention === "Commerciale") {
    return `Comparer les options disponibles autour de "${keyword}" avant de choisir.`;
  }

  if (intention === "Navigationnelle") {
    return `Atteindre directement la bonne ressource ou la bonne marque liée à "${keyword}".`;
  }

  return `Comprendre "${keyword}" et identifier les prochaines actions utiles.`;
}

function buildChatGptAnalysisPrompt(
  promptTemplate: string,
  payload: KeywordAnalysisResponse,
) {
  const compactPromptTemplate = promptTemplate.trim();
  const serpSummary = payload.serpResults
    .filter(
      (result) => result.type === "organic" && !isShopifyResult(result.url),
    )
    .slice(0, 6)
    .map((result) => {
      const parts = [
        `Position: ${result.position}`,
        `Titre: ${truncateText(result.title, 100)}`,
      ];
      if (result.url) {
        parts.push(`URL: ${truncateText(result.url, 120)}`);
      }
      return parts.join("\n");
    })
    .join("\n\n");

  return compactPromptTemplate
    .replaceAll("{{keyword}}", payload.keyword)
    .replaceAll("{{volume}}", String(payload.volume))
    .replaceAll("{{difficulty}}", String(payload.difficulty))
    .replaceAll("{{intent}}", formatKeywordIntent(payload.intent))
    .replaceAll(
      "{{serp_results}}",
      serpSummary || "Aucun résultat SERP disponible.",
    )
    .slice(0, 3500);
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function resetSuggestions() {
  suggestions.value = [];
  showSuggestions.value = false;
  activeSuggestionIndex.value = -1;
}

function resetRelatedGoogleSuggestions() {
  relatedGoogleSuggestions.value = [];
}

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

function selectSuggestion(suggestion: KeywordSuggestion) {
  searchTerm.value = suggestion.keyword;
  resetSuggestions();
}

async function loadRelatedGoogleSuggestions(keyword: string) {
  const trimmedKeyword = keyword.trim();

  if (!trimmedKeyword) {
    resetRelatedGoogleSuggestions();
    return;
  }

  const requestId = ++relatedSuggestionRequestId;
  isLoadingRelatedGoogleSuggestions.value = true;

  try {
    const response = await suggestGoogleKeywords(trimmedKeyword, {
      limit: 3,
      expand: false,
      language: searchLanguage.value,
      country: searchCountry.value,
    });

    if (requestId !== relatedSuggestionRequestId) {
      return;
    }

    relatedGoogleSuggestions.value = response.suggestions.slice(0, 3);
  } catch (error) {
    if (requestId === relatedSuggestionRequestId) {
      resetRelatedGoogleSuggestions();
    }

    console.error(error);
  } finally {
    if (requestId === relatedSuggestionRequestId) {
      isLoadingRelatedGoogleSuggestions.value = false;
    }
  }
}

async function selectAndAnalyzeSuggestion(suggestion: KeywordSuggestion) {
  searchTerm.value = suggestion.keyword;
  resetSuggestions();
  await analyzeKeyword(suggestion.keyword);
}

async function loadSuggestions(query: string) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    resetSuggestions();
    return;
  }

  if (trimmedQuery.length < 2) {
    resetSuggestions();
    return;
  }

  isLoadingSuggestions.value = true;

  try {
    const [keywordSuggestionsResult, googleSuggestionsResult] =
      await Promise.allSettled([
        suggestKeywords(trimmedQuery),
        suggestGoogleKeywords(trimmedQuery, {
          limit: 30,
          expand: false,
          language: searchLanguage.value,
          country: searchCountry.value,
        }),
      ]);

    if (searchTerm.value.trim() !== trimmedQuery) {
      return;
    }

    const keywordSuggestions =
      keywordSuggestionsResult.status === "fulfilled"
        ? keywordSuggestionsResult.value
        : [];
    const googleSuggestions =
      googleSuggestionsResult.status === "fulfilled"
        ? googleSuggestionsResult.value
        : { query: trimmedQuery, suggestions: [], total: 0 };

    suggestions.value = buildSuggestions(keywordSuggestions, googleSuggestions);
    showSuggestions.value = suggestions.value.length > 0;
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

function buildSuggestions(
  keywordSuggestions: KeywordSuggestion[],
  googleSuggestions: KeywordSheeterResponse,
) {
  const orderedKeywordSuggestions = [...keywordSuggestions].sort(
    (left, right) => {
      const getSourceRank = (source?: KeywordSuggestion["source"]) => {
        if (source === "history") {
          return 0;
        }

        if (source === "database") {
          return 1;
        }

        return 2;
      };

      const sourceDifference =
        getSourceRank(left.source) - getSourceRank(right.source);

      if (sourceDifference !== 0) {
        return sourceDifference;
      }

      const leftVolume = left.volume ?? -1;
      const rightVolume = right.volume ?? -1;

      if (leftVolume !== rightVolume) {
        return rightVolume - leftVolume;
      }

      return left.keyword.localeCompare(right.keyword);
    },
  );

  const seenKeywords = new Set(
    orderedKeywordSuggestions.map((item) => normalizeSearchText(item.keyword)),
  );

  const googleSuggestionItems: KeywordSuggestion[] =
    googleSuggestions.suggestions
      .map((item) => ({
        id: `google:${item.sourceQuery}:${item.keyword}`,
        keyword: item.keyword,
        isFavorite: false,
        volume: null,
        difficulty: null,
        intent: null,
        source: "suggest" as const,
      }))
      .filter((item) => {
        const normalizedKeyword = normalizeSearchText(item.keyword);

        if (!normalizedKeyword || seenKeywords.has(normalizedKeyword)) {
          return false;
        }

        seenKeywords.add(normalizedKeyword);
        return true;
      });

  return [...orderedKeywordSuggestions, ...googleSuggestionItems];
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
      void analyzeKeyword();
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

    void analyzeKeyword();
  }
}

async function analyzeKeyword(keywordOverride?: string | Event) {
  const effectiveKeyword =
    typeof keywordOverride === "string" ? keywordOverride : searchTerm.value;
  const trimmedKeyword = effectiveKeyword.trim();

  if (!trimmedKeyword || isAnalyzing.value) {
    return;
  }

  searchTerm.value = trimmedKeyword;
  isAnalyzing.value = true;
  aiReview.value = null;
  isAiReviewModalOpen.value = false;
  resetSuggestions();
  resetRelatedGoogleSuggestions();

  try {
    const response = await analyzeKeywordRequest(trimmedKeyword);
    const formattedIntent = formatKeywordIntent(response.intent);

    await createKeyword({
      keyword: response.keyword,
      volume: response.volume,
      difficulty: response.difficulty,
      searchIntent: response.intent,
    });

    analysis.value = response;

    keywordRows.value = [
      {
        keyword: trimmedKeyword,
        intention: formattedIntent,
        userProblem: inferUserProblem(trimmedKeyword, formattedIntent),
      },
    ];

    await loadRelatedGoogleSuggestions(trimmedKeyword);
    await syncSearchQuery(trimmedKeyword);
  } catch (error) {
    analysis.value = null;
    keywordRows.value = [];
    resetRelatedGoogleSuggestions();
    console.error(error);
  } finally {
    isAnalyzing.value = false;
  }
}

async function loadStoredKeywordAnalysis(keywordOverride?: string) {
  const effectiveKeyword = keywordOverride ?? searchTerm.value;
  const trimmedKeyword = effectiveKeyword.trim();

  if (!trimmedKeyword || isAnalyzing.value) {
    return;
  }

  searchTerm.value = trimmedKeyword;
  isAnalyzing.value = true;
  aiReview.value = null;
  isAiReviewModalOpen.value = false;
  resetSuggestions();
  resetRelatedGoogleSuggestions();

  try {
    const response = await getStoredKeywordAnalysis(trimmedKeyword);

    if (!response) {
      analysis.value = null;
      keywordRows.value = [];
      resetRelatedGoogleSuggestions();
      await syncSearchQuery(trimmedKeyword);
      return;
    }

    const formattedIntent = formatKeywordIntent(response.intent);

    await createKeyword({
      keyword: response.keyword,
      volume: response.volume,
      difficulty: response.difficulty,
      searchIntent: response.intent,
    });

    analysis.value = response;
    keywordRows.value = [
      {
        keyword: trimmedKeyword,
        intention: formattedIntent,
        userProblem: inferUserProblem(trimmedKeyword, formattedIntent),
      },
    ];

    await loadRelatedGoogleSuggestions(trimmedKeyword);
    await syncSearchQuery(trimmedKeyword);
  } catch (error) {
    analysis.value = null;
    keywordRows.value = [];
    resetRelatedGoogleSuggestions();
    console.error(error);
  } finally {
    isAnalyzing.value = false;
  }
}

async function requestAiReview() {
  if (!analysis.value || isAnalyzingWithAi.value) {
    return;
  }

  isAnalyzingWithAi.value = true;

  try {
    aiReview.value = await analyzeKeywordWithAi(analysis.value);
    isAiReviewModalOpen.value = true;
  } catch (error) {
    aiReview.value = null;
    isAiReviewModalOpen.value = false;
    console.error(error);
  } finally {
    isAnalyzingWithAi.value = false;
  }
}

async function handleDeleteAnalyzedKeyword() {
  const currentKeyword = analysis.value?.keyword?.trim();

  if (!currentKeyword || isDeletingKeyword.value) {
    return;
  }

  const confirmed = window.confirm(
    `Mettre "${currentKeyword}" à la poubelle ?`,
  );

  if (!confirmed) {
    return;
  }

  isDeletingKeyword.value = true;

  try {
    const keywords = await listKeywords();
    const keywordToDelete = keywords.find(
      (keyword) =>
        normalizeSearchText(keyword.keyword) === normalizeSearchText(currentKeyword),
    );

    if (!keywordToDelete) {
      showErrorToast(
        "Mot-clé introuvable",
        "Ce mot-clé n'existe pas en base ou a déjà été supprimé.",
      );
      return;
    }

    await deleteKeywordRequest(keywordToDelete.id);

    analysis.value = null;
    aiReview.value = null;
    keywordRows.value = [];
    relatedGoogleSuggestions.value = [];
    isAiReviewModalOpen.value = false;
    searchTerm.value = "";
    resetSuggestions();

    await router.replace({
      query: {
        ...route.query,
        q: undefined,
        autorun: undefined,
      },
    });

    showSuccessToast(
      "Mot-clé déplacé à la poubelle",
      `« ${currentKeyword} » a été supprimé de la liste active.`,
    );
  } catch (error) {
    console.error("[Research] delete keyword failed", error);
    showErrorToast(
      "Suppression impossible",
      "Le mot-clé n'a pas pu être déplacé à la poubelle.",
    );
  } finally {
    isDeletingKeyword.value = false;
  }
}

onBeforeUnmount(() => {
  if (suggestionFetchTimer) {
    clearTimeout(suggestionFetchTimer);
  }
});

onMounted(() => {
  const initialQuery =
    typeof route.query.q === "string" ? route.query.q.trim() : "";
  const shouldAutorun = route.query.autorun !== "0";

  if (!initialQuery) {
    return;
  }

  searchTerm.value = initialQuery;
  if (shouldAutorun) {
    void analyzeKeyword(initialQuery);
    return;
  }

  void loadStoredKeywordAnalysis(initialQuery);
});
</script>

<template>
  <section class="space-y-6">
    <UBreadcrumb :items="breadcrumbItems" class="text-slate-500" />

    <!-- <div class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900">
        Étude de mots-clés
      </h1>
      <p class="text-sm text-slate-500">
        Analysez un mot-clé puis consultez les KPI et les premiers résultats
        SERP.
      </p>
    </div> -->

    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end">
        <label
          for="keyword-search"
          class="block flex-1 text-sm font-medium text-slate-700"
        >
          <span class="mb-2 block">Recherche de mot-clé</span>

          <div class="relative">
            <UInput
              id="keyword-search"
              :model-value="searchTerm"
              size="xl"
              icon="i-lucide-search"
              placeholder="Ex. audit seo local, logiciel crm, stratégie contenu..."
              class="w-full"
              autocomplete="off"
              @update:model-value="onSearchInput"
              @focus="onSearchFocus"
              @blur="onSearchBlur"
              @keydown="onSearchKeydown"
            />

            <KeywordResearchKeywordSuggestionsList
              :show="showSuggestions"
              :is-loading="isLoadingSuggestions"
              :suggestions="suggestions"
              :active-suggestion-index="activeSuggestionIndex"
              @select="selectAndAnalyzeSuggestion"
            />
          </div>
        </label>

        <UButton
          size="xl"
          icon="i-lucide-chart-column-big"
          :loading="isAnalyzing"
          :disabled="!searchTerm.trim()"
          @click="analyzeKeyword"
        >
          {{ isAnalyzing ? "Analyse..." : "Analyser" }}
        </UButton>
      </div>
    </div>

    <div v-if="analysis" class="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      <StatsPanelCard title="Volume">
        <p class="mt-3 text-3xl font-semibold text-slate-900">
          {{ analysis.volume }}
          <span class="keyword-research-fr-flag" aria-hidden="true" />
        </p>
      </StatsPanelCard>

      <StatsPanelCard title="Difficulté">
        <p class="mt-3 text-3xl font-semibold text-slate-900">
          {{ analysis.difficulty }}%
        </p>
        <p class="mt-2 text-sm font-medium text-slate-500">
          {{
            getKeywordDifficultyLabel(
              analysis.difficulty,
              keywordDifficultyLevels,
            )
          }}
        </p>
      </StatsPanelCard>

      <StatsPanelCard title="Intention">
        <UTooltip :text="getIntentDescription(analysis.intent)">
          <p
            class="mt-3 inline-flex cursor-help items-center text-2xl font-semibold text-slate-900"
          >
            {{ formatKeywordIntent(analysis.intent) }}
          </p>
        </UTooltip>
      </StatsPanelCard>

      <StatsPanelCard title="Mini scan IA">
        <div class="mt-3 space-y-1">
          <p class="text-sm text-slate-500">
            Page qui répond à/aux l'intention/s de recherche :
          </p>
          <ul>
            <li
              v-if="analysis.miniScan"
              class="text-lg font-semibold text-slate-900 transition group-hover:text-sky-700"
            >
              <button
                type="button"
                class="inline-flex items-start gap-2 text-left transition hover:text-sky-700"
                title="Copier le mini scan IA"
                @click="copyMiniScanToClipboard"
              >
                <UIcon name="i-lucide-copy" class="mt-1 h-4 w-4 shrink-0" />
                <span>{{ analysis.miniScan }}</span>
              </button>
            </li>
            <li v-else class="text-slate-400">
              Aucun mini scan IA disponible pour ce mot-clé.
            </li>
          </ul>
        </div>
      </StatsPanelCard>

      <NuxtLink
        :to="`/keywords/search?q=${encodeURIComponent(analysis.keyword)}`"
        class="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50/40"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <p
              class="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Suggestions Google
            </p>
            <h2
              class="mt-3 text-lg font-semibold text-slate-900 transition group-hover:text-sky-700"
            >
              Explorer autour de "{{ analysis.keyword }}"
            </h2>
            <p class="text-sm text-slate-500">
              Ouvre la page de recherche associée au mot-clé analysé pour
              explorer d'autres idées.
            </p>
          </div>

          <UIcon
            name="i-lucide-search"
            class="mt-0.5 size-5 text-slate-300 transition group-hover:text-sky-500"
          />
        </div>

        <div class="mt-4 space-y-2">
          <div v-if="isLoadingRelatedGoogleSuggestions" class="space-y-2">
            <div class="h-10 rounded-xl bg-slate-100 animate-pulse" />
            <div class="h-10 rounded-xl bg-slate-100 animate-pulse" />
            <div class="h-10 rounded-xl bg-slate-100 animate-pulse" />
          </div>

          <div v-else-if="relatedGoogleSuggestions.length" class="grid gap-2">
            <div
              v-for="suggestion in relatedGoogleSuggestions"
              :key="suggestion.keyword"
              class="inline-flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition group-hover:border-sky-200 group-hover:bg-white"
            >
              <span class="truncate font-medium">
                {{ suggestion.keyword }}
              </span>
              <UIcon
                name="i-lucide-arrow-up-right"
                class="size-4 shrink-0 text-slate-300 transition group-hover:text-sky-400"
              />
            </div>
          </div>

          <p v-else class="text-sm text-slate-500">
            Aucune suggestion Google n’a été trouvée.
          </p>
        </div>
      </NuxtLink>

      <StatsPanelCard title="Évolution du volume">
        <StatsKeywordMonthlySearchChart
          :monthly-searches="analysisMonthlySearches"
        />
      </StatsPanelCard>
    </div>

    <div v-if="analysis" class="flex flex-wrap justify-end gap-3">
      <UButton
        icon="i-lucide-trash-2"
        color="error"
        variant="soft"
        :loading="isDeletingKeyword"
        @click="handleDeleteAnalyzedKeyword"
      >
        Mettre à la poubelle
      </UButton>

      <a
        v-if="chatGptAnalysisUrl"
        :href="chatGptAnalysisUrl"
        target="_blank"
        rel="noreferrer"
        class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        <UIcon name="i-lucide-message-square-plus" class="size-4" />
        Ouvrir dans ChatGPT
      </a>

      <UButton
        icon="i-lucide-sparkles"
        color="neutral"
        variant="soft"
        :loading="isAnalyzingWithAi"
        @click="requestAiReview"
      >
        {{
          isAnalyzingWithAi
            ? "Analyse IA..."
            : "Demander à l’IA d’analyser le résultat"
        }}
      </UButton>
    </div>

    <div
      v-if="analysis"
      class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div class="border-b border-slate-200 px-5 py-4">
        <h2 class="text-lg font-semibold text-slate-900">Top 6 SERP</h2>
        <p class="mt-1 text-sm text-slate-500">
          Premiers résultats renvoyés par l’analyse du mot-clé.
        </p>
      </div>

      <div class="divide-y divide-slate-200">
        <article
          v-for="result in analysis.serpResults"
          :key="result.position"
          class="space-y-2 px-5 py-4 transition"
          :class="getSerpResultCardClass(result)"
        >
          <div class="flex items-center gap-3">
            <span
              class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700"
            >
              {{ result.position }}
            </span>
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <UTooltip :text="getSerpTypeDescription(result)">
                  <UBadge variant="soft" :class="getSerpTypeColor(result.type)">
                    <span class="inline-flex items-center gap-1.5">
                      <UIcon
                        :name="getSerpTypeIcon(result.type)"
                        class="size-3.5"
                      />
                      {{ formatSerpType(result.type) }}
                    </span>
                  </UBadge>
                </UTooltip>

                <UBadge
                  v-if="result.knownAgencySite"
                  variant="soft"
                  class="bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200"
                >
                  <span class="inline-flex items-center gap-1.5">
                    <UIcon name="i-lucide-building-2" class="size-3.5" />
                    {{ getKnownAgencySiteLabel(result) }}
                  </span>
                </UBadge>
              </div>

              <h3 class="mt-2 font-medium text-slate-900">
                {{ result.title }}
              </h3>
              <a
                v-if="result.url"
                :href="result.url"
                target="_blank"
                rel="noreferrer"
                class="text-sm text-sky-700 underline underline-offset-2"
              >
                {{ result.url }}
              </a>
              <p v-else class="text-sm text-slate-400">
                Pas d’URL directe pour ce bloc SERP.
              </p>

              <a
                v-if="result.checkUrl"
                :href="result.checkUrl"
                target="_blank"
                rel="noreferrer"
                class="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
              >
                <UIcon name="i-lucide-external-link" class="size-3.5" />
                Ouvrir le check_url
              </a>
            </div>
          </div>

          <p class="text-sm leading-6 text-slate-600">
            {{ result.snippet }}
          </p>
        </article>
      </div>
    </div>

    <UModal
      v-model:open="isAiReviewModalOpen"
      :ui="{ content: 'sm:max-w-7xl' }"
    >
      <template #content>
        <div
          v-if="aiReview"
          class="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div class="border-b border-slate-200 px-5 py-4">
            <div class="flex flex-wrap items-center gap-3">
              <h2 class="text-lg font-semibold text-slate-900">Analyse IA</h2>

              <UBadge
                variant="soft"
                class="bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200"
              >
                <span class="inline-flex items-center gap-1.5">
                  <UIcon name="i-lucide-bot" class="size-3.5" />
                  OpenAI
                </span>
              </UBadge>
            </div>

            <p class="mt-1 text-sm text-slate-500">
              Lecture assistée de la SERP pour
              <span class="font-medium text-slate-700">{{
                aiReview.keyword
              }}</span
              >.
            </p>
          </div>

          <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
            <div
              class="keyword-research-ai-review prose prose-slate max-w-none text-sm leading-7"
              v-html="aiReviewHtml"
            />
          </div>
        </div>
      </template>
    </UModal>

    <div
      class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Mot-clé
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Intention
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Problème utilisateur
              </th>
            </tr>
          </thead>

          <tbody v-if="keywordRows.length" class="divide-y divide-slate-200">
            <tr v-for="row in keywordRows" :key="row.keyword" class="align-top">
              <td class="px-4 py-3 font-medium text-slate-900">
                {{ row.keyword }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ row.intention }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ row.userProblem }}
              </td>
            </tr>
          </tbody>

          <tbody v-else>
            <tr>
              <td
                colspan="3"
                class="px-4 py-8 text-center text-sm text-slate-500"
              >
                Lancez une analyse pour afficher les informations du mot-clé.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.keyword-research-fr-flag {
  display: inline-block;
  height: 0.875rem;
  width: 1.125rem;
  background: linear-gradient(
    90deg,
    #1d4ed8 0%,
    #1d4ed8 33.33%,
    #ffffff 33.33%,
    #ffffff 66.66%,
    #dc2626 66.66%,
    #dc2626 100%
  );
}

.keyword-research-ai-review:deep(h1),
.keyword-research-ai-review:deep(h2),
.keyword-research-ai-review:deep(h3) {
  color: #0f172a;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.keyword-research-ai-review:deep(h1) {
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.5rem;
  line-height: 1.2;
}

.keyword-research-ai-review:deep(h2) {
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  font-size: 1.125rem;
  line-height: 1.35;
}

.keyword-research-ai-review:deep(h3) {
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
  font-size: 1rem;
  line-height: 1.4;
}

.keyword-research-ai-review:deep(p) {
  margin: 0.75rem 0;
  color: #334155;
  line-height: 1.75;
}

.keyword-research-ai-review:deep(ul),
.keyword-research-ai-review:deep(ol) {
  margin: 0.75rem 0;
  padding-left: 1.25rem;
  color: #334155;
}

.keyword-research-ai-review:deep(li) {
  margin: 0.35rem 0;
  padding-left: 0.15rem;
}

.keyword-research-ai-review:deep(strong) {
  color: #0f172a;
  font-weight: 700;
}

.keyword-research-ai-review:deep(em) {
  color: #475569;
}

.keyword-research-ai-review:deep(hr) {
  margin: 1.25rem 0;
  border: 0;
  border-top: 1px solid #e2e8f0;
}

.keyword-research-ai-review:deep(code) {
  border-radius: 0.5rem;
  background: #f8fafc;
  padding: 0.15rem 0.4rem;
  color: #0f172a;
  font-size: 0.875em;
}
</style>
