<script setup lang="ts">
import type { BlogArticle, SeoCluster } from "~/types/domain";
import { blogArticleStatusLabels } from "~/constants/blog-articles";
import { keywordLengthTypeLabels, searchIntentLabels } from "~/constants/enums";
import { defaultKeywordDifficultyLevels } from "~/constants/keyword-difficulty";
import { pageTypeLabels } from "~/constants/pages";
import DashboardPagesInReviewSection from "~/components/dashboard/DashboardPagesInReviewSection.vue";
import ContentSuggestionsSection from "~/components/suggestions/ContentSuggestionsSection.vue";
import type { KeywordPageType, KeywordRecord } from "~/types/keywords";
import {
  getKeywordDifficultyLabel,
  getKeywordDifficultySortRank,
} from "~/utils/keyword-difficulty";
import { filterPagesInReviewAssignedToUser } from "~/utils/page-review";
import { buildKeywordResearchUrl } from "~/utils/keyword-research-url";
import { normalizeSearchText } from "~/utils/search-normalizer";

type ClusterDiagnostic = {
  cluster: SeoCluster;
  pillarPageCount: number;
  satellitePageCount: number;
  reasons: string[];
};

const { request } = useApi();
const { assignKeywordTemplate, listSuggestions } = useKeywords();
const { getKeywordDifficultyLevels } = useSettings();
const { user } = useSupabaseAuth();

const savingFavoriteKeywordId = ref<string | null>(null);
const pendingFavoriteTemplates = ref<Record<string, KeywordPageType | "">>({});

const {
  data: homeDashboard,
  error: homeDashboardError,
  status: homeDashboardStatus,
} = await useAsyncData("home-dashboard", async () => {
  const [articles, clusters] = await Promise.all([
    request<BlogArticle[]>("/blog-articles"),
    request<SeoCluster[]>("/seo-clusters"),
  ]);

  const clusterIds = clusters.map((cluster) => cluster.id);

  if (!clusterIds.length) {
    return {
      articles,
      detailedClusters: [] as SeoCluster[],
    };
  }

  const detailedClusters = await Promise.all(
    clusterIds.map(async (clusterId) => {
      try {
        return await request<SeoCluster>(`/seo-clusters/${clusterId}`);
      } catch {
        return null;
      }
    }),
  );

  return {
    articles,
    detailedClusters: detailedClusters.filter(
      (cluster): cluster is SeoCluster => !!cluster,
    ),
  };
});
const {
  data: allKeywords,
  error: favoriteKeywordsError,
  status: favoriteKeywordsStatus,
  refresh: refreshFavoriteKeywords,
} = await useAsyncData("home-favorite-keywords", () =>
  request<KeywordRecord[]>("/keywords"),
);
const {
  data: contentSuggestions,
  error: contentSuggestionsError,
  status: contentSuggestionsStatus,
  refresh: refreshContentSuggestions,
} = await useAsyncData("home-content-suggestions", () => listSuggestions(), {
  default: () => [],
});
const { data: pages } = await useAsyncData("home-pages-reviews", () =>
  usePages().listPages(),
);
const { data: keywordDifficultyLevelsSettings } = await useAsyncData(
  "settings:keyword-difficulty-levels",
  () => getKeywordDifficultyLevels(),
);
const keywordDifficultyLevels = computed(
  () =>
    keywordDifficultyLevelsSettings.value?.levels ??
    defaultKeywordDifficultyLevels,
);

const articles = computed(() => homeDashboard.value?.articles ?? []);
const detailedClusters = computed(
  () => homeDashboard.value?.detailedClusters ?? [],
);
const favoriteKeywords = computed(() =>
  (allKeywords.value ?? [])
    .filter((keyword) => keyword.isFavorite)
    .sort((left, right) => {
      const volumeDifference = (right.volume ?? -1) - (left.volume ?? -1);

      if (volumeDifference !== 0) {
        return volumeDifference;
      }

      return left.keyword.localeCompare(right.keyword);
    }),
);
const favoriteKeywordCards = computed(() => favoriteKeywords.value.slice(0, 8));
const ungroupedKeywords = computed(() =>
  (allKeywords.value ?? [])
    .filter((keyword) => !keyword.keywordGroup?.id)
    .sort((left, right) => {
      const volumeDifference = (right.volume ?? -1) - (left.volume ?? -1);

      if (volumeDifference !== 0) {
        return volumeDifference;
      }

      return left.keyword.localeCompare(right.keyword);
    }),
);
const ungroupedKeywordCards = computed(() =>
  ungroupedKeywords.value.slice(0, 8),
);
const pageTypeOptions = Object.entries(pageTypeLabels).map(
  ([value, label]) => ({
    value: value as KeywordPageType,
    label,
  }),
);

const isLoading = computed(() => homeDashboardStatus.value === "pending");
const areFavoriteKeywordsLoading = computed(
  () => favoriteKeywordsStatus.value === "pending",
);

const hasError = computed(() => !!homeDashboardError.value);
const hasFavoriteKeywordsError = computed(() => !!favoriteKeywordsError.value);
const reviewPages = computed(() =>
  filterPagesInReviewAssignedToUser(pages.value ?? [], user.value?.id ?? null),
);

const allResumedEditingArticles = computed(() =>
  (articles.value ?? [])
    .filter(
      (article) =>
        isStartedArticle(article) &&
        !isFinishedArticle(article) &&
        article.status !== "PLANNED",
    )
    .sort(
      (left, right) =>
        getArticleProgressScore(right) - getArticleProgressScore(left),
    ),
);

const resumedEditingArticles = computed(() =>
  allResumedEditingArticles.value.slice(0, 6),
);

const clusterDiagnostics = computed<ClusterDiagnostic[]>(() =>
  (detailedClusters.value ?? []).map((cluster) => {
    const pillarPageCount = (cluster.pages ?? []).filter(
      (page) => page.seoRole === "PILLAR",
    ).length;
    const satellitePageCount = (cluster.pages ?? []).filter(
      (page) => page.seoRole === "SATELLITE",
    ).length;
    const reasons: string[] = [];

    if (!pillarPageCount) {
      reasons.push("Aucune page pilier");
    }

    if (!satellitePageCount) {
      reasons.push("Aucune page satellite");
    }

    if (
      !(cluster.blogArticles?.length ?? 0) &&
      !(cluster.descendantBlogArticles?.length ?? 0)
    ) {
      reasons.push("Aucun article lié");
    }

    return {
      cluster,
      pillarPageCount,
      satellitePageCount,
      reasons,
    };
  }),
);

const allClustersWithoutPillar = computed(() =>
  clusterDiagnostics.value.filter((item) => item.pillarPageCount === 0),
);

const clustersWithoutPillar = computed(() =>
  allClustersWithoutPillar.value.slice(0, 6),
);

const allIncompleteClusters = computed(() =>
  clusterDiagnostics.value
    .filter(
      (item) =>
        item.pillarPageCount > 0 &&
        item.reasons.some((reason) => reason !== "Aucune page pilier"),
    )
    .sort((left, right) => right.reasons.length - left.reasons.length),
);

const incompleteClusters = computed(() =>
  allIncompleteClusters.value.slice(0, 6),
);

const allPushedWaitingVisibilityArticles = computed(() =>
  (articles.value ?? []).filter(
    (article) => article.status === "PUSHED" && !!article.shopifyArticleId,
  ),
);

const pushedWaitingVisibilityArticles = computed(() =>
  allPushedWaitingVisibilityArticles.value.slice(0, 6),
);
const visibleContentSuggestions = computed(() =>
  [...(contentSuggestions.value ?? [])]
    .filter((suggestion) => {
      const assignedUserId = suggestion.assignedSupabaseUserId?.trim() ?? "";
      const currentUserId = user.value?.id?.trim() ?? "";

      return !assignedUserId || assignedUserId === currentUserId;
    })
    .sort(compareContentSuggestionByDifficulty),
);

const summaryCards = computed(() => [
  {
    label: "Articles à reprendre",
    value: allResumedEditingArticles.value.length,
    icon: "i-lucide-file-pen-line",
    toneClass: "bg-sky-50 text-sky-700",
  },
  {
    label: "Clusters sans pilier",
    value: allClustersWithoutPillar.value.length,
    icon: "i-lucide-flag-off",
    toneClass: "bg-amber-50 text-amber-700",
  },
  {
    label: "Clusters incomplets",
    value: allIncompleteClusters.value.length,
    icon: "i-lucide-layers-3",
    toneClass: "bg-violet-50 text-violet-700",
  },
  {
    label: "Shopify en attente",
    value: allPushedWaitingVisibilityArticles.value.length,
    icon: "i-lucide-eye-off",
    toneClass: "bg-cyan-50 text-cyan-700",
  },
]);

const breadcrumbItems = [
  {
    label: "Accueil",
  },
  {
    label: "Tableau de bord",
  },
];

function isStartedArticle(article: BlogArticle) {
  return Boolean(
    article.content?.trim() ||
    article.slug?.trim() ||
    article.primaryKeyword?.trim() ||
    article.requiredKeywords?.trim() ||
    article.seoTitle?.trim() ||
    article.seoDescription?.trim(),
  );
}

function isFinishedArticle(article: BlogArticle) {
  return article.status === "PUSHED" || article.status === "PUBLISHED";
}

function getArticleProgressScore(article: BlogArticle) {
  let score = 0;

  if (article.content?.trim()) {
    score += 3;
  }

  if (article.primaryKeyword?.trim()) {
    score += 1;
  }

  if (article.seoTitle?.trim()) {
    score += 1;
  }

  if (article.seoDescription?.trim()) {
    score += 1;
  }

  if (article.status === "READY_TO_PUBLISH") {
    score += 3;
  } else if (article.status === "PLANNED") {
    score += 2;
  } else if (article.status === "DRAFT") {
    score += 1;
  }

  return score;
}

function getClusterArticleCount(cluster: SeoCluster) {
  return (
    (cluster.blogArticles?.length ?? 0) +
    (cluster.descendantBlogArticles?.length ?? 0)
  );
}

function getArticleStatusLabel(status?: BlogArticle["status"] | null) {
  if (!status) {
    return "Brouillon";
  }

  return blogArticleStatusLabels[status] ?? "Brouillon";
}

function getSuggestionKeywords(
  suggestion: NonNullable<typeof contentSuggestions.value>[number],
) {
  return Array.isArray(suggestion.keywords) ? suggestion.keywords : [];
}

function getContentSuggestionPrimaryKeywordRecord(
  suggestion: NonNullable<typeof contentSuggestions.value>[number],
) {
  const keywords = getSuggestionKeywords(suggestion);
  const primaryKeyword = normalizeSearchText(suggestion.primaryKeyword);

  if (!primaryKeyword) {
    return keywords[0] ?? null;
  }

  return (
    keywords.find(
      (keyword) => normalizeSearchText(keyword.keyword) === primaryKeyword,
    ) ?? keywords[0] ?? null
  );
}

function compareContentSuggestionByDifficulty(
  left: NonNullable<typeof contentSuggestions.value>[number],
  right: NonNullable<typeof contentSuggestions.value>[number],
) {
  const leftPrimary = getContentSuggestionPrimaryKeywordRecord(left);
  const rightPrimary = getContentSuggestionPrimaryKeywordRecord(right);
  const leftDifficulty = getKeywordDifficultySortRank(
    leftPrimary?.difficulty,
    keywordDifficultyLevels.value,
  );
  const rightDifficulty = getKeywordDifficultySortRank(
    rightPrimary?.difficulty,
    keywordDifficultyLevels.value,
  );

  if (leftDifficulty !== rightDifficulty) {
    return leftDifficulty - rightDifficulty;
  }

  const leftVolume = leftPrimary?.volume ?? -1;
  const rightVolume = rightPrimary?.volume ?? -1;

  if (leftVolume !== rightVolume) {
    return rightVolume - leftVolume;
  }

  return left.name.localeCompare(right.name, "fr", { sensitivity: "base" });
}

function getFavoriteKeywordTemplateValue(keyword: KeywordRecord) {
  return (
    pendingFavoriteTemplates.value[keyword.id] ?? keyword.page?.pageType ?? ""
  );
}

function updateFavoriteKeywordTemplate(keywordId: string, value: string) {
  pendingFavoriteTemplates.value = {
    ...pendingFavoriteTemplates.value,
    [keywordId]: value as KeywordPageType | "",
  };
}

async function handleAssignFavoriteKeywordTemplate(keyword: KeywordRecord) {
  const selectedTemplate = getFavoriteKeywordTemplateValue(keyword);

  if (!selectedTemplate || savingFavoriteKeywordId.value) {
    return;
  }

  savingFavoriteKeywordId.value = keyword.id;

  try {
    const updatedKeyword = await assignKeywordTemplate(
      keyword.id,
      selectedTemplate,
    );

    if (allKeywords.value) {
      allKeywords.value = allKeywords.value.map((item) =>
        item.id === updatedKeyword.id ? updatedKeyword : item,
      );
    }
  } finally {
    savingFavoriteKeywordId.value = null;
  }
}
</script>

<template>
  <section class="space-y-8">
    <UBreadcrumb :items="breadcrumbItems" class="text-slate-500" />

    <header class="space-y-3">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
        Tableau de bord éditorial
      </p>
      <div class="space-y-2">
        <h1 class="text-3xl font-semibold text-slate-900">
          Que faut-il faire aujourd’hui ?
        </h1>
        <p class="max-w-3xl text-sm leading-6 text-slate-500">
          Reprends les articles commencés, comble les trous dans les clusters et
          termine ce qui attend encore une publication Shopify.
        </p>
      </div>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">
      Chargement des priorités du jour...
    </p>

    <FeedbackRichMessage
      v-else-if="hasError"
      tone="error"
      title="Impossible de charger complètement la homepage"
      description="Une ou plusieurs sections du tableau de bord n'ont pas pu être récupérées."
    />

    <template v-else>
      <DashboardSummaryCards :cards="summaryCards" />

      <DashboardPagesInReviewSection
        v-if="reviewPages.length"
        :pages="reviewPages"
        :preview-count="4"
        title="Pages en review"
        description="Quelques pages qui t'ont été assignées pour relecture."
        see-all-to="/review"
        see-all-label="Voir toutes"
      />

      <ContentSuggestionsSection
        v-if="
          visibleContentSuggestions.length ||
          contentSuggestionsStatus === 'pending' ||
          contentSuggestionsError
        "
        :suggestions="visibleContentSuggestions"
        :loading="contentSuggestionsStatus === 'pending'"
        :error="contentSuggestionsError"
        :current-user-id="user?.id ?? null"
        @refresh="refreshContentSuggestions()"
      />

      <div class="grid gap-6 xl:grid-cols-2">
        <DashboardResumedArticlesSection
          :articles="allResumedEditingArticles"
        />
        <DashboardClustersWithoutPillarSection
          :clusters="allClustersWithoutPillar"
        />
        <DashboardIncompleteClustersSection :clusters="allIncompleteClusters" />
        <DashboardShopifyVisibilitySection
          :articles="allPushedWaitingVisibilityArticles"
        />
      </div>

      <DashboardFavoriteKeywordsSection
        :keywords="favoriteKeywords"
        :loading="areFavoriteKeywordsLoading"
        :error="favoriteKeywordsError"
        :page-type-options="pageTypeOptions"
        :keyword-difficulty-levels="keywordDifficultyLevels"
        :selected-templates="pendingFavoriteTemplates"
        :saving-keyword-id="savingFavoriteKeywordId"
        @refresh="refreshFavoriteKeywords()"
        @update-template="updateFavoriteKeywordTemplate"
        @assign-template="handleAssignFavoriteKeywordTemplate"
      />

      <DashboardUngroupedKeywordsSection :keywords="ungroupedKeywords" />

      <div class="hidden">
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article
            v-for="card in summaryCards"
            :key="card.label"
            class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="space-y-1">
                <p class="text-sm text-slate-500">{{ card.label }}</p>
                <p class="text-3xl font-semibold text-slate-900">
                  {{ card.value }}
                </p>
              </div>
              <div
                class="flex h-11 w-11 items-center justify-center rounded-2xl"
                :class="card.toneClass"
              >
                <UIcon :name="card.icon" class="h-5 w-5" />
              </div>
            </div>
          </article>
        </div>

        <ContentSuggestionsSection
          :suggestions="visibleContentSuggestions"
          :loading="contentSuggestionsStatus === 'pending'"
          :error="contentSuggestionsError"
          :current-user-id="user?.id ?? null"
          @refresh="refreshContentSuggestions()"
        />

        <section
          class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div
            class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
          >
            <div class="space-y-1">
              <h2 class="text-lg font-semibold text-slate-900">
                Mots-clés favoris
              </h2>
              <p class="text-sm text-slate-500">
                Priorise les favoris avec le plus de volume, analyse ceux qui
                manquent de données et associe un template quand aucune page
                n’est encore liée.
              </p>
            </div>

            <div class="flex items-center gap-3">
              <UBadge color="warning" variant="soft">
                {{ favoriteKeywords.length }}
              </UBadge>

              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-rotate-ccw"
                @click="refreshFavoriteKeywords()"
              >
                <!-- Rafraîchir -->
              </UButton>
            </div>
          </div>

          <FeedbackInlineMessage
            v-if="areFavoriteKeywordsLoading"
            class="mt-5 animate-pulse"
          >
            Chargement des mots-clés favoris...
          </FeedbackInlineMessage>

          <FeedbackRichMessage
            v-else-if="hasFavoriteKeywordsError"
            tone="error"
            title="Impossible de charger les mots-clés favoris"
            description="La section des favoris n'a pas pu être récupérée."
            :details="favoriteKeywordsError?.toString()"
            action-label="Réessayer"
            class="mt-5"
            @action="refreshFavoriteKeywords"
          />

          <div
            v-else-if="!favoriteKeywords.length"
            class="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500"
          >
            Aucun mot-clé favori pour le moment.
          </div>

          <div v-else class="mt-5 grid gap-4 xl:grid-cols-2">
            <article
              v-for="keyword in favoriteKeywordCards"
              :key="keyword.id"
              class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="space-y-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="font-medium text-slate-900">
                      {{ keyword.keyword }}
                    </p>
                    <UBadge color="warning" variant="soft"> Favori </UBadge>
                    <UBadge
                      v-if="keyword.searchIntent"
                      color="neutral"
                      variant="soft"
                    >
                      {{ searchIntentLabels[keyword.searchIntent] }}
                    </UBadge>
                  </div>

                  <div class="flex flex-wrap gap-2 text-sm text-slate-500">
                    <span>Volume: {{ keyword.volume ?? "-" }}</span>
                    <span>
                      Difficulté: {{ keyword.difficulty ?? "-" }}
                      <template v-if="keyword.difficulty !== null">
                        ·
                        {{
                          getKeywordDifficultyLabel(
                            keyword.difficulty,
                            keywordDifficultyLevels,
                          )
                        }}
                      </template>
                    </span>
                    <span>
                      Longueur:
                      {{
                        keyword.lengthType
                          ? keywordLengthTypeLabels[keyword.lengthType]
                          : "-"
                      }}
                    </span>
                  </div>
                </div>

                <UBadge
                  :color="keyword.lastScannedAt ? 'success' : 'neutral'"
                  variant="soft"
                >
                  {{ keyword.lastScannedAt ? "Analysé" : "À analyser" }}
                </UBadge>
              </div>

              <div class="mt-4 flex flex-wrap items-center gap-3">
                <NuxtLink
                  v-if="!keyword.lastScannedAt"
                  :to="
                    buildKeywordResearchUrl(keyword.keyword, {
                      language: 'fr',
                      country: 'fr',
                      autorun: false,
                    })
                  "
                  class="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
                >
                  <UIcon name="i-lucide-scan-search" class="h-4 w-4" />
                  Analyser
                </NuxtLink>

                <NuxtLink
                  v-else
                  :to="
                    buildKeywordResearchUrl(keyword.keyword, {
                      language: 'fr',
                      country: 'fr',
                      autorun: false,
                    })
                  "
                  class="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                >
                  <UIcon name="i-lucide-chart-column-big" class="h-4 w-4" />
                  Voir l’analyse
                </NuxtLink>

                <template v-if="keyword.lastScannedAt && !keyword.page">
                  <select
                    :value="getFavoriteKeywordTemplateValue(keyword)"
                    class="min-w-52 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    @change="
                      updateFavoriteKeywordTemplate(
                        keyword.id,
                        ($event.target as HTMLSelectElement).value,
                      )
                    "
                  >
                    <option value="">Associer un template...</option>
                    <option
                      v-for="option in pageTypeOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>

                  <UButton
                    color="neutral"
                    variant="soft"
                    icon="i-lucide-file-plus-2"
                    :loading="savingFavoriteKeywordId === keyword.id"
                    :disabled="!getFavoriteKeywordTemplateValue(keyword)"
                    @click="handleAssignFavoriteKeywordTemplate(keyword)"
                  >
                    Associer
                  </UButton>
                </template>

                <span
                  v-else-if="!keyword.lastScannedAt"
                  class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500"
                >
                  <UIcon name="i-lucide-lock" class="h-4 w-4" />
                  Analyse requise avant le template
                </span>

                <NuxtLink
                  v-else
                  to="/templates"
                  class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <UIcon name="i-lucide-file-text" class="h-4 w-4" />
                  {{ pageTypeLabels[keyword.page.pageType] }}
                </NuxtLink>
              </div>
            </article>
          </div>
        </section>

        <section
          class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div
            class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
          >
            <div class="space-y-1">
              <h2 class="text-lg font-semibold text-slate-900">
                Mots-clés non groupés
              </h2>
              <p class="text-sm text-slate-500">
                Ces mots-clés n’ont encore aucun groupe associé. Tu peux les
                organiser dès maintenant.
              </p>
            </div>

            <div class="flex items-center gap-3">
              <UBadge color="neutral" variant="soft">
                {{ ungroupedKeywords.length }}
              </UBadge>

              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-folder-tree"
                to="/keywords/groups"
              >
                Organiser
              </UButton>
            </div>
          </div>

          <div
            v-if="!ungroupedKeywords.length"
            class="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500"
          >
            Tous les mots-clés sont déjà classés dans des groupes.
          </div>

          <div v-else class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article
              v-for="keyword in ungroupedKeywordCards"
              :key="keyword.id"
              class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/40"
            >
              <div class="space-y-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="space-y-2">
                    <p class="font-medium text-slate-900">
                      {{ keyword.keyword }}
                    </p>
                    <div class="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>Volume: {{ keyword.volume ?? "-" }}</span>
                      <span> Diff.: {{ keyword.difficulty ?? "-" }} </span>
                    </div>
                  </div>

                  <UIcon
                    name="i-lucide-folder-x"
                    class="mt-1 size-5 text-slate-300"
                  />
                </div>

                <div class="flex flex-wrap gap-2">
                  <UBadge
                    v-if="keyword.searchIntent"
                    color="neutral"
                    variant="soft"
                  >
                    {{ searchIntentLabels[keyword.searchIntent] }}
                  </UBadge>

                  <UBadge
                    :color="keyword.lastScannedAt ? 'success' : 'neutral'"
                    variant="soft"
                  >
                    {{ keyword.lastScannedAt ? "Analysé" : "Pas scanné" }}
                  </UBadge>
                </div>

                <div class="flex flex-wrap gap-2">
                  <NuxtLink
                    :to="
                      buildKeywordResearchUrl(keyword.keyword, {
                        autorun: false,
                        language: 'fr',
                        country: 'fr',
                      })
                    "
                    class="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
                  >
                    <UIcon name="i-lucide-chart-column-big" class="h-4 w-4" />
                    Analyser
                  </NuxtLink>

                  <UButton
                    color="neutral"
                    variant="soft"
                    icon="i-lucide-folder-tree"
                    to="/keywords/groups"
                  >
                    Grouper
                  </UButton>
                </div>
              </div>
            </article>
          </div>
        </section>

        <div class="grid gap-6 xl:grid-cols-2">
          <section
            class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-1">
                <h2 class="text-lg font-semibold text-slate-900">
                  Reprendre des articles commencés
                </h2>
                <p class="text-sm text-slate-500">
                  Articles déjà touchés, mais pas encore terminés ni envoyés en
                  visibilité finale.
                </p>
              </div>
              <UBadge color="neutral" variant="soft">
                {{ resumedEditingArticles.length }}
              </UBadge>
            </div>

            <div v-if="resumedEditingArticles.length" class="mt-5 space-y-3">
              <NuxtLink
                v-for="article in resumedEditingArticles"
                :key="article.id"
                :to="`/articles/${article.id}`"
                class="block rounded-2xl border border-slate-200 px-4 py-4 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 space-y-1">
                    <p class="truncate font-medium text-slate-900">
                      {{ article.title }}
                    </p>
                    <p class="text-sm text-slate-500">
                      {{ article.cluster?.name || "Sans cluster" }}
                    </p>
                  </div>
                  <UBadge color="neutral" variant="soft" class="shrink-0">
                    {{ getArticleStatusLabel(article.status) }}
                  </UBadge>
                </div>
              </NuxtLink>
            </div>

            <div
              v-else
              class="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500"
            >
              Aucun article commencé n’attend de reprise.
            </div>
          </section>

          <section
            class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-1">
                <h2 class="text-lg font-semibold text-slate-900">
                  Trouver une page pilier
                </h2>
                <p class="text-sm text-slate-500">
                  Clusters qui n’ont encore aucune page pilier définie.
                </p>
              </div>
              <UBadge color="warning" variant="soft">
                {{ clustersWithoutPillar.length }}
              </UBadge>
            </div>

            <div v-if="clustersWithoutPillar.length" class="mt-5 space-y-3">
              <NuxtLink
                v-for="item in clustersWithoutPillar"
                :key="item.cluster.id"
                :to="`/clusters/${item.cluster.id}`"
                class="block rounded-2xl border border-amber-200 bg-amber-50/50 px-4 py-4 transition hover:bg-amber-50"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 space-y-1">
                    <p class="truncate font-medium text-slate-900">
                      {{ item.cluster.name }}
                    </p>
                    <p class="text-sm text-slate-600">
                      {{ item.cluster.primaryKeyword }}
                    </p>
                  </div>
                  <span
                    class="text-xs font-medium uppercase tracking-wide text-amber-700"
                  >
                    À définir
                  </span>
                </div>
              </NuxtLink>
            </div>

            <div
              v-else
              class="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500"
            >
              Tous les clusters ont déjà une page pilier.
            </div>
          </section>

          <section
            class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-1">
                <h2 class="text-lg font-semibold text-slate-900">
                  Clusters incomplets
                </h2>
                <p class="text-sm text-slate-500">
                  Exemple: clusters avec pilier mais sans page satellite ou sans
                  article lié.
                </p>
              </div>
              <UBadge color="secondary" variant="soft">
                {{ incompleteClusters.length }}
              </UBadge>
            </div>

            <div v-if="incompleteClusters.length" class="mt-5 space-y-3">
              <NuxtLink
                v-for="item in incompleteClusters"
                :key="item.cluster.id"
                :to="`/clusters/${item.cluster.id}`"
                class="block rounded-2xl border border-slate-200 px-4 py-4 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div class="space-y-3">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0 space-y-1">
                      <p class="truncate font-medium text-slate-900">
                        {{ item.cluster.name }}
                      </p>
                      <p class="text-sm text-slate-500">
                        {{ getClusterArticleCount(item.cluster) }} article(s)
                        lié(s)
                      </p>
                    </div>
                    <UBadge color="neutral" variant="soft" class="shrink-0">
                      {{ item.satellitePageCount }} satellite
                    </UBadge>
                  </div>

                  <div class="flex flex-wrap gap-2">
                    <UBadge
                      v-for="reason in item.reasons"
                      :key="reason"
                      color="neutral"
                      variant="soft"
                    >
                      {{ reason }}
                    </UBadge>
                  </div>
                </div>
              </NuxtLink>
            </div>

            <div
              v-else
              class="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500"
            >
              Aucun cluster incomplet détecté avec les règles actuelles.
            </div>
          </section>

          <section
            class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-1">
                <h2 class="text-lg font-semibold text-slate-900">
                  Shopify en attente de visibilité
                </h2>
                <p class="text-sm text-slate-500">
                  Articles déjà pushés vers Shopify, mais encore masqués.
                </p>
              </div>
              <UBadge color="info" variant="soft">
                {{ pushedWaitingVisibilityArticles.length }}
              </UBadge>
            </div>

            <div
              v-if="pushedWaitingVisibilityArticles.length"
              class="mt-5 space-y-3"
            >
              <NuxtLink
                v-for="article in pushedWaitingVisibilityArticles"
                :key="article.id"
                :to="`/articles/${article.id}`"
                class="block rounded-2xl border border-cyan-200 bg-cyan-50/40 px-4 py-4 transition hover:bg-cyan-50"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 space-y-1">
                    <p class="truncate font-medium text-slate-900">
                      {{ article.title }}
                    </p>
                    <p class="text-sm text-slate-600">
                      {{ article.cluster?.name || "Sans cluster" }}
                    </p>
                  </div>
                  <span
                    class="text-xs font-medium uppercase tracking-wide text-cyan-700"
                  >
                    Masqué
                  </span>
                </div>
              </NuxtLink>
            </div>

            <div
              v-else
              class="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500"
            >
              Aucun article Shopify n’attend de mise en visibilité.
            </div>
          </section>
        </div>
      </div>
    </template>
  </section>
</template>
