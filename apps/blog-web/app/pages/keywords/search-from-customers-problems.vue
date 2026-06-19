<script setup lang="ts">
import type { CustomerProblem } from "~/types/customer-problems";
import type { SuggestedKeywordCard } from "~/types/keyword-search";
import { isDataForSeoQuotaError } from "~/utils/is-dataforseo-quota-error";
import { buildKeywordResearchUrl } from "~/utils/keyword-research-url";
import { normalizeSearchText } from "~/utils/search-normalizer";

const { useCustomerProblemsList } = useCustomerProblems();
const { analyzeKeyword, suggestKeywords } = useKeywordAnalysis();
const { deleteKeyword, setKeywordFavorite } = useKeywords();

const {
  data: customerProblems,
  status,
  error,
} = await useCustomerProblemsList();
const { data: globalKeywords, refresh: refreshGlobalKeywords } =
  await useAsyncData("keyword-search:all-keywords", () =>
    suggestKeywords("", 2000),
  );

const selectedProblemIds = ref<string[]>([]);
const search = ref("");
const isKeywordImportModalOpen = ref(false);
const isKeywordRenameModalOpen = ref(false);
const isScanningAllKeywords = ref(false);
const scanAllProgress = ref({
  total: 0,
  processed: 0,
  currentKeyword: "",
});
const deletingKeywordId = ref<string | null>(null);
const editingKeywordId = ref<string | null>(null);
const editingKeywordValue = ref("");

const problemsWithKeywords = computed(() =>
  (customerProblems.value ?? []).filter(
    (problem) => problem.keywords.length > 0,
  ),
);

const problemGroups = computed(() => {
  const groupsMap = new Map<
    string,
    {
      id: string;
      title: string;
      problems: CustomerProblem[];
    }
  >();

  for (const problem of problemsWithKeywords.value) {
    const groupId = problem.category?.id ?? "__uncategorized__";
    const groupTitle = problem.category?.title ?? "Sans catégorie";
    const existingGroup = groupsMap.get(groupId);

    if (existingGroup) {
      existingGroup.problems.push(problem);
      continue;
    }

    groupsMap.set(groupId, {
      id: groupId,
      title: groupTitle,
      problems: [problem],
    });
  }

  return [...groupsMap.values()]
    .map((group) => ({
      ...group,
      problems: [...group.problems].sort((left, right) =>
        left.title.localeCompare(right.title),
      ),
    }))
    .sort((left, right) => left.title.localeCompare(right.title));
});

const problemGroupCards = computed(() => {
  const selectedSet = new Set(selectedProblemIds.value);

  return problemGroups.value.map((group) => {
    const selectedProblems = group.problems.filter((problem) =>
      selectedSet.has(problem.id),
    );
    const selectedCount = selectedProblems.length;
    const allSelected =
      selectedCount > 0 && selectedCount === group.problems.length;
    const partiallySelected = selectedCount > 0 && !allSelected;

    return {
      ...group,
      selectedCount,
      allSelected,
      partiallySelected,
      visibleProblems: group.problems,
    };
  });
});

const filteredProblems = computed(() => {
  if (!selectedProblemIds.value.length) {
    return problemsWithKeywords.value;
  }

  const selectedSet = new Set(selectedProblemIds.value);

  return problemsWithKeywords.value.filter((problem) =>
    selectedSet.has(problem.id),
  );
});

const suggestedKeywords = computed(() => {
  const query = normalizeSearchText(search.value);
  const keywordMap = new Map<string, SuggestedKeywordCard>();

  for (const problem of filteredProblems.value) {
    for (const keyword of problem.keywords) {
      const normalizedKeyword = keyword.keyword.trim();

      if (!normalizedKeyword) {
        continue;
      }

      const keywordKey = normalizeSearchText(normalizedKeyword);
      const existingEntry = keywordMap.get(keywordKey);
      const keywordIsAnalyzed = Boolean(keyword.lastScannedAt);

      if (existingEntry) {
        existingEntry.isAnalyzed =
          existingEntry.isAnalyzed || keywordIsAnalyzed;
        existingEntry.isFavorite = existingEntry.isFavorite || false;
        existingEntry.sourceProblems.push(problem);
        continue;
      }

      keywordMap.set(keywordKey, {
        id: keyword.id,
        keyword: normalizedKeyword,
        isFavorite: false,
        volume: null,
        searchIntent: keyword.searchIntent ?? null,
        isAnalyzed: keywordIsAnalyzed,
        globalKeywordId: null,
        sourceProblems: [problem],
      });
    }
  }

  for (const keyword of globalKeywords.value ?? []) {
    const normalizedKeyword = keyword.keyword.trim();

    if (!normalizedKeyword) {
      continue;
    }

    const key = normalizeSearchText(normalizedKeyword);
    const existingEntry = keywordMap.get(key);
    const keywordIsAnalyzed = Boolean(keyword.lastScannedAt);

    if (existingEntry) {
      existingEntry.isAnalyzed = existingEntry.isAnalyzed || keywordIsAnalyzed;

      if (!existingEntry.searchIntent && keyword.intent) {
        existingEntry.searchIntent = keyword.intent;
      }

      if (existingEntry.volume == null && keyword.volume != null) {
        existingEntry.volume = keyword.volume;
      }

      if (!existingEntry.isFavorite && keyword.isFavorite) {
        existingEntry.isFavorite = true;
      }

      if (!existingEntry.globalKeywordId) {
        existingEntry.globalKeywordId = keyword.id;
      }

      continue;
    }

    keywordMap.set(key, {
      id: keyword.id,
      keyword: normalizedKeyword,
      isFavorite: keyword.isFavorite ?? false,
      volume: keyword.volume ?? null,
      searchIntent: keyword.intent ?? null,
      isAnalyzed: keywordIsAnalyzed,
      globalKeywordId: keyword.id,
      sourceProblems: [],
    });
  }

  return [...keywordMap.values()]
    .filter((item) => {
      if (!query) {
        return true;
      }

      return (
        normalizeSearchText(item.keyword).includes(query) ||
        item.sourceProblems.some((problem) =>
          normalizeSearchText(problem.title).includes(query),
        )
      );
    })
    .sort((left, right) => {
      const getIntentRank = (intent?: string | null) => {
        if (intent === "TRANSACTIONAL") {
          return 0;
        }

        if (intent === "INFORMATIONAL") {
          return 1;
        }

        return 2;
      };

      const intentRankDifference =
        getIntentRank(left.searchIntent) - getIntentRank(right.searchIntent);

      if (intentRankDifference !== 0) {
        return intentRankDifference;
      }

      const leftVolume = left.volume ?? -1;
      const rightVolume = right.volume ?? -1;

      if (leftVolume !== rightVolume) {
        return rightVolume - leftVolume;
      }

      return left.keyword.localeCompare(right.keyword);
    });
});

const globalKeywordNames = computed(() =>
  (globalKeywords.value ?? []).map((item) => item.keyword),
);
const scanAllPercent = computed(() => {
  if (scanAllProgress.value.total <= 0) {
    return 0;
  }

  return Math.round(
    (scanAllProgress.value.processed / scanAllProgress.value.total) * 100,
  );
});

function toggleProblem(problemId: string) {
  const nextSelection = new Set(selectedProblemIds.value);

  if (nextSelection.has(problemId)) {
    nextSelection.delete(problemId);
  } else {
    nextSelection.add(problemId);
  }

  selectedProblemIds.value = [...nextSelection];
}

function toggleCategory(groupId: string, shouldCheck: boolean) {
  const group = problemGroups.value.find((item) => item.id === groupId);

  if (!group) {
    return;
  }

  const nextSelection = new Set(selectedProblemIds.value);

  for (const problem of group.problems) {
    if (shouldCheck) {
      nextSelection.add(problem.id);
    } else {
      nextSelection.delete(problem.id);
    }
  }

  selectedProblemIds.value = [...nextSelection];
}

function syncCategoryCheckbox(
  element: HTMLInputElement | null,
  isPartiallySelected: boolean,
) {
  if (!element) {
    return;
  }

  element.indeterminate = isPartiallySelected;
}

function clearFilters() {
  selectedProblemIds.value = [];
  search.value = "";
}

async function handleKeywordsImported() {
  await refreshGlobalKeywords();
}

async function handleAnalyzeRequested(keyword: string) {
  await refreshGlobalKeywords();
  await navigateTo(
    buildKeywordResearchUrl(keyword, {
      language: "fr",
      country: "fr",
    }),
  );
}

async function handleDeleteKeyword(item: {
  keyword: string;
  globalKeywordId: string | null;
}) {
  if (!item.globalKeywordId) {
    return;
  }

  const confirmed = window.confirm(
    `Supprimer le mot-clé « ${item.keyword} » ?`,
  );

  if (!confirmed) {
    return;
  }

  deletingKeywordId.value = item.globalKeywordId;

  try {
    await deleteKeyword(item.globalKeywordId);
    await refreshGlobalKeywords();
  } finally {
    deletingKeywordId.value = null;
  }
}

function handleEditKeyword(item: {
  keyword: string;
  globalKeywordId: string | null;
}) {
  if (!item.globalKeywordId) {
    return;
  }

  editingKeywordId.value = item.globalKeywordId;
  editingKeywordValue.value = item.keyword;
  isKeywordRenameModalOpen.value = true;
}

async function handleKeywordRenamed() {
  await refreshGlobalKeywords();
}

async function handleFavoriteToggle(item: {
  globalKeywordId: string | null;
  isFavorite: boolean;
}) {
  if (!item.globalKeywordId) {
    return;
  }

  await setKeywordFavorite(item.globalKeywordId, !item.isFavorite);
  await refreshGlobalKeywords();
}

async function handleScanAllKeywords() {
  const keywordsToScan = suggestedKeywords.value
    .map((item) => item.keyword.trim())
    .filter(Boolean);

  if (!keywordsToScan.length || isScanningAllKeywords.value) {
    return;
  }

  isScanningAllKeywords.value = true;
  scanAllProgress.value = {
    total: keywordsToScan.length,
    processed: 0,
    currentKeyword: "",
  };

  const skippedKeywords: string[] = [];

  try {
    for (const keyword of keywordsToScan) {
      scanAllProgress.value = {
        ...scanAllProgress.value,
        currentKeyword: keyword,
      };

      try {
        await analyzeKeyword(keyword);
      } catch (error) {
        if (!isDataForSeoQuotaError(error)) {
          throw error;
        }

        skippedKeywords.push(keyword);
      } finally {
        scanAllProgress.value = {
          ...scanAllProgress.value,
          processed: scanAllProgress.value.processed + 1,
        };
      }
    }

    if (skippedKeywords.length) {
      console.warn(
        `Scan DataForSEO interrompu pour ${skippedKeywords.length} mot-clé(s) faute de quota: ${skippedKeywords.join(", ")}`,
      );
    }

    await refreshGlobalKeywords();
  } finally {
    isScanningAllKeywords.value = false;
  }
}
</script>

<template>
  <section class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900">
        Trouver des mots-clés
      </h1>
      <p class="text-sm text-slate-500">
        Explore les mots-clés proposés à partir des problèmes clients déjà
        consignés.
      </p>
    </header>

    <FeedbackInlineMessage v-if="status === 'pending'" class="animate-pulse">
      Chargement des problèmes clients...
    </FeedbackInlineMessage>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      title="Impossible de charger les problèmes clients"
      description="La base de suggestions n'a pas pu être récupérée depuis les problèmes enregistrés."
    />

    <template v-else>
      <KeywordsKeywordImportModal
        v-model:open="isKeywordImportModalOpen"
        :existing-keywords="globalKeywordNames"
        @analyze-requested="handleAnalyzeRequested"
        @imported="handleKeywordsImported"
      />
      <KeywordsKeywordRenameModal
        v-model:open="isKeywordRenameModalOpen"
        :keyword-id="editingKeywordId"
        :initial-keyword="editingKeywordValue"
        @renamed="handleKeywordRenamed"
      />

      <div class="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside
          class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1">
              <h2 class="text-lg font-semibold text-slate-900">Filtres</h2>
              <p class="text-sm text-slate-500">
                Sélectionne un ou plusieurs problèmes clients.
              </p>
            </div>

            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-rotate-ccw"
              @click="clearFilters"
            >
              Reset
            </UButton>
          </div>

          <div class="mt-4">
            <input
              v-model="search"
              type="text"
              placeholder="Filtrer les mots-clés..."
              class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
          </div>

          <div v-if="problemGroupCards.length" class="mt-4 space-y-2">
            <div class="space-y-1">
              <p class="text-sm font-medium text-slate-700">
                Catégories de problèmes
              </p>
              <p class="text-sm text-slate-500">
                Sélectionne des catégories complètes ou seulement certains
                problèmes à l’intérieur.
              </p>
            </div>

            <div
              class="max-h-[46rem] space-y-3 overflow-y-auto overscroll-contain pr-1"
            >
              <article
                v-for="group in problemGroupCards"
                :key="group.id"
                class="rounded-2xl border border-slate-200 bg-slate-50 p-3"
              >
                <label
                  class="flex cursor-pointer items-start gap-3 rounded-2xl bg-white px-3 py-3 transition hover:bg-slate-50"
                >
                  <input
                    :ref="
                      (element) =>
                        syncCategoryCheckbox(
                          element as HTMLInputElement | null,
                          group.partiallySelected,
                        )
                    "
                    :checked="group.allSelected"
                    type="checkbox"
                    class="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    @change="
                      toggleCategory(
                        group.id,
                        ($event.target as HTMLInputElement).checked,
                      )
                    "
                  />
                  <div class="min-w-0 space-y-1">
                    <p class="text-sm font-medium text-slate-900">
                      {{ group.title }}
                    </p>
                    <p class="text-xs text-slate-500">
                      {{ group.selectedCount }}/{{ group.problems.length }}
                      problème(s) sélectionné(s)
                    </p>
                  </div>
                </label>

                <div class="mt-2 space-y-2 pl-6">
                  <label
                    v-for="problem in group.visibleProblems"
                    :key="problem.id"
                    class="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <input
                      :checked="selectedProblemIds.includes(problem.id)"
                      type="checkbox"
                      class="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      @change="toggleProblem(problem.id)"
                    />
                    <div class="min-w-0 space-y-1">
                      <p class="text-sm font-medium text-slate-900">
                        {{ problem.title }}
                      </p>
                      <p class="text-xs text-slate-500">
                        {{ problem.keywords.length }} mot(s)-clé(s)
                      </p>
                    </div>
                  </label>
                </div>
              </article>
            </div>
          </div>
        </aside>

        <section
          class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="space-y-1">
              <h2 class="text-lg font-semibold text-slate-900">
                Mots-clés proposés
              </h2>
              <p class="text-sm text-slate-500">
                Liste agrégée depuis les problèmes clients et les mots-clés déjà
                connus en base.
              </p>
            </div>

            <UBadge color="neutral" variant="soft">
              {{ suggestedKeywords.length }}
            </UBadge>
          </div>

          <div class="mt-4 flex flex-wrap justify-end gap-3">
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-scan-search"
              :loading="isScanningAllKeywords"
              :disabled="!suggestedKeywords.length"
              @click="handleScanAllKeywords"
            >
              {{ isScanningAllKeywords ? "Scan en cours..." : "Scanner tout" }}
            </UButton>

            <UButton
              icon="i-lucide-plus"
              :disabled="isScanningAllKeywords"
              @click="isKeywordImportModalOpen = true"
            >
              Ajouter des mots-clés
            </UButton>
          </div>

          <div
            v-if="
              isScanningAllKeywords ||
              (scanAllProgress.total > 0 &&
                scanAllProgress.processed === scanAllProgress.total)
            "
            class="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4"
          >
            <ImportsImportProgressBar
              :processed="scanAllProgress.processed"
              :total="scanAllProgress.total"
              :percent="scanAllPercent"
              current-label="Scan des mots-clés"
              :current-value="scanAllProgress.currentKeyword"
            />
          </div>

          <div
            v-if="!suggestedKeywords.length"
            class="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500"
          >
            Aucun mot-clé proposé. Lance d’abord une extraction depuis la page
            des problèmes clients.
          </div>

          <div
            v-else
            class="mt-5 grid max-h-[48rem] gap-3 overflow-y-auto overscroll-contain pr-1 md:grid-cols-2"
          >
            <KeywordsKeywordSuggestionCard
              v-for="item in suggestedKeywords"
              :key="item.id"
              :item="item"
              :deleting-keyword-id="deletingKeywordId"
              @delete="handleDeleteKeyword"
              @edit="handleEditKeyword"
              @toggle-favorite="handleFavoriteToggle"
            />
          </div>
        </section>
      </div>
    </template>
  </section>
</template>
