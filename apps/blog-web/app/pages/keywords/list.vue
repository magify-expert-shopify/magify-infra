<script setup lang="ts">
import { defaultKeywordVolumeThresholds } from "~/constants/keyword-volume";
import { searchIntentLabels } from "~/constants/enums";
import { defaultKeywordDifficultyLevels } from "~/constants/keyword-difficulty";
import {
  getKeywordPriorityIntentRank,
  getKeywordPriorityLevel,
} from "~/utils/keyword-priority";
import { isDataForSeoQuotaError } from "~/utils/is-dataforseo-quota-error";
import { buildKeywordResearchUrl } from "~/utils/keyword-research-url";
import type { KeywordRecord } from "~/types/keywords";
import type { SearchIntent } from "~/types/customer-problems";
import {
  getKeywordDifficultyTextClass,
  getKeywordDifficultyToneClass,
} from "~/utils/keyword-difficulty";
import { normalizeSearchText } from "~/utils/search-normalizer";

const route = useRoute();
const router = useRouter();
const pageStartedAt = performance.now();
const hasLoggedInitialRender = ref(false);
const { analyzeKeyword } = useKeywordAnalysis();
const { getKeywordVolumeThresholds } = useSettings();
const { deleteKeyword, listKeywords, setKeywordFavorite, useKeywordsList } =
  useKeywords();
const keywordVolumeThresholdsSettingsState = useAsyncData(
  "settings:keyword-volume-thresholds:keywords-list",
  () => getKeywordVolumeThresholds(),
);
const { getKeywordDifficultyLevels } = useSettings();
const keywordDifficultyLevelsSettingsState = useAsyncData(
  "settings:keyword-difficulty-levels:keywords-list",
  () => getKeywordDifficultyLevels(),
);
const keywordsList = useKeywordsList();
const { data: keywords, status, error, refresh } = keywordsList;
const search = ref("");
const ALL_INTENTS = "__all__";
const ALL_GROUPS = "__all__";
const selectedIntent = ref(ALL_INTENTS);
const selectedGroup = ref(ALL_GROUPS);
const onlyFavorites = ref(false);
const isKeywordImportModalOpen = ref(false);
const isScanningAllKeywords = ref(false);
const scanAllProgress = ref({
  total: 0,
  processed: 0,
  currentKeyword: "",
});
const keywordTablePageSize = 50;
const activePrioritySectionKey = ref("");
const sectionPages = ref<Record<string, number>>({});
const updatingFavoriteIds = ref<string[]>([]);
const deletingKeywordIds = ref<string[]>([]);
const isRefreshingKeywords = ref(false);
const keywordVolumeThresholds = computed(
  () =>
    keywordVolumeThresholdsSettingsState.data.value ??
    defaultKeywordVolumeThresholds,
);
const keywordDifficultyLevels = computed(
  () =>
    keywordDifficultyLevelsSettingsState.data.value?.levels ??
    defaultKeywordDifficultyLevels,
);
const breadcrumbItems = [
  {
    label: "Mots-clés",
  },
  {
    label: "Liste",
  },
];

watch(
  () => route.query.filter,
  (value) => {
    search.value = typeof value === "string" ? value : "";
  },
  { immediate: true },
);

watch(search, async (value) => {
  const currentFilter =
    typeof route.query.filter === "string" ? route.query.filter : "";
  const nextFilter = value.trim();

  if (currentFilter === nextFilter) {
    return;
  }

  await router.replace({
    query: {
      ...route.query,
      filter: nextFilter || undefined,
    },
  });
});

onMounted(() => {
  void refresh();
});

const filteredKeywords = computed(() => {
  const query = normalizeSearchText(search.value);
  const intent = selectedIntent.value.trim();
  const group = selectedGroup.value.trim();

  return (keywords.value ?? []).filter(
    (keyword) =>
      (query ? normalizeSearchText(keyword.keyword).includes(query) : true) &&
      (intent === ALL_INTENTS ? true : keyword.searchIntent === intent) &&
      (group === ALL_GROUPS
        ? true
        : group === "__none__"
          ? !keyword.keywordGroup?.id
          : keyword.keywordGroup?.id === group) &&
      (onlyFavorites.value ? keyword.isFavorite : true),
  );
});

const groupOptions = computed(() => {
  const groups = new Map<string, string>();

  for (const keyword of keywords.value ?? []) {
    if (keyword.keywordGroup?.id) {
      groups.set(keyword.keywordGroup.id, keyword.keywordGroup.name);
    }
  }

  return [
    { value: ALL_GROUPS, label: "Tous les groupes" },
    { value: "__none__", label: "Sans groupe" },
    ...[...groups.entries()]
      .sort((left, right) =>
        left[1].localeCompare(right[1], "fr", { sensitivity: "base" }),
      )
      .map(([value, label]) => ({ value, label })),
  ];
});

const intentOptions = computed(() => [
  { value: ALL_INTENTS, label: "Tous les intents" },
  ...(Object.entries(searchIntentLabels) as Array<[SearchIntent, string]>).map(
    ([value, label]) => ({
      value,
      label,
    }),
  ),
]);

const sortedKeywords = computed(() => {
  return [...filteredKeywords.value].sort((left, right) => {
    const leftPriority = getKeywordPriorityRank(left);
    const rightPriority = getKeywordPriorityRank(right);
    const priorityDifference = leftPriority - rightPriority;

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const intentDifference =
      getKeywordPriorityIntentRank(left.searchIntent) -
      getKeywordPriorityIntentRank(right.searchIntent);

    if (intentDifference !== 0) {
      return intentDifference;
    }

    const volumeDifference = (right.volume ?? -1) - (left.volume ?? -1);

    if (volumeDifference !== 0) {
      return volumeDifference;
    }

    return left.keyword.localeCompare(right.keyword);
  });
});

const prioritySections = computed(() => {
  const sectionDefinitions = [
    {
      level: 1,
      title: "Niveau 1",
      description: "TRANSACTIONAL / COMMERCIAL + fort volume",
    },
    {
      level: 2,
      title: "Niveau 2",
      description: "TRANSACTIONAL / COMMERCIAL + moyen/faible volume",
    },
    {
      level: 3,
      title: "Niveau 3",
      description: "INFORMATIONAL",
    },
    {
      level: 4,
      title: "Niveau 4",
      description: "NAVIGATIONNEL",
    },
  ] as const;

  const sections = sectionDefinitions.map((section) => ({
    ...section,
    keywords: sortedKeywords.value.filter(
      (keyword) =>
        getKeywordPriorityLevel(
          keyword.searchIntent,
          keyword.volume,
          keywordVolumeThresholds.value,
        ) === section.level,
    ),
  }));

  const uncategorizedKeywords = sortedKeywords.value.filter(
    (keyword) =>
      getKeywordPriorityLevel(
        keyword.searchIntent,
        keyword.volume,
        keywordVolumeThresholds.value,
      ) === null,
  );

  if (uncategorizedKeywords.length) {
    sections.push({
      level: null,
      title: "Sans priorité",
      description: "Intent ou volume insuffisants pour calculer un niveau",
      keywords: uncategorizedKeywords,
    });
  }

  return sections;
});

const visiblePrioritySections = computed(() =>
  prioritySections.value.filter((section) => section.keywords.length),
);

function getPrioritySectionKey(section: {
  level: number | null;
  title: string;
}) {
  return section.level === null
    ? "priority-uncategorized"
    : `priority-${section.level}`;
}

function getSectionPage(sectionKey: string) {
  return sectionPages.value[sectionKey] ?? 1;
}

function setSectionPage(sectionKey: string, page: number) {
  sectionPages.value = {
    ...sectionPages.value,
    [sectionKey]: Math.max(1, page),
  };
}

const activePrioritySection = computed(() => {
  const sections = visiblePrioritySections.value;

  if (!sections.length) {
    return null;
  }

  return (
    sections.find(
      (section) =>
        getPrioritySectionKey(section) === activePrioritySectionKey.value,
    ) ?? sections[0]
  );
});

watch(
  visiblePrioritySections,
  (sections) => {
    if (!sections.length) {
      activePrioritySectionKey.value = "";
      return;
    }

    const activeSectionExists = sections.some(
      (section) =>
        getPrioritySectionKey(section) === activePrioritySectionKey.value,
    );

    if (!activeSectionExists) {
      activePrioritySectionKey.value = getPrioritySectionKey(sections[0]);
    }

    const nextPages = { ...sectionPages.value };

    for (const section of sections) {
      const sectionKey = getPrioritySectionKey(section);
      const totalPages = Math.max(
        1,
        Math.ceil(section.keywords.length / keywordTablePageSize),
      );
      const currentPage = nextPages[sectionKey] ?? 1;

      if (currentPage > totalPages) {
        nextPages[sectionKey] = totalPages;
      }
    }

    sectionPages.value = nextPages;
  },
  { immediate: true },
);

const activePrioritySectionPage = computed(() => {
  const section = activePrioritySection.value;

  if (!section) {
    return 1;
  }

  const sectionKey = getPrioritySectionKey(section);
  const totalPages = Math.max(
    1,
    Math.ceil(section.keywords.length / keywordTablePageSize),
  );

  return Math.min(getSectionPage(sectionKey), totalPages);
});

const activePrioritySectionTotalPages = computed(() => {
  const section = activePrioritySection.value;

  if (!section) {
    return 1;
  }

  return Math.max(1, Math.ceil(section.keywords.length / keywordTablePageSize));
});

const activePrioritySectionKeywords = computed(() => {
  const section = activePrioritySection.value;

  if (!section) {
    return [];
  }

  const startIndex =
    (activePrioritySectionPage.value - 1) * keywordTablePageSize;

  return section.keywords.slice(startIndex, startIndex + keywordTablePageSize);
});

function handlePrioritySectionTabClick(sectionKey: string) {
  activePrioritySectionKey.value = sectionKey;
}

function handlePrioritySectionPageChange(nextPage: number) {
  if (!activePrioritySection.value) {
    return;
  }

  const sectionKey = getPrioritySectionKey(activePrioritySection.value);
  setSectionPage(sectionKey, nextPage);
}

const scanAllPercent = computed(() => {
  if (scanAllProgress.value.total <= 0) {
    return 0;
  }

  return Math.round(
    (scanAllProgress.value.processed / scanAllProgress.value.total) * 100,
  );
});

const hasCachedKeywords = computed(() => (keywords.value ?? []).length > 0);
const showInitialKeywordsLoading = computed(
  () => status.value === "pending" && !hasCachedKeywords.value,
);

watch(
  [keywords, status, showInitialKeywordsLoading],
  async ([currentKeywords, currentStatus, currentLoading]) => {
    if (
      hasLoggedInitialRender.value ||
      currentLoading ||
      currentStatus === "pending" ||
      !(currentKeywords?.length ?? 0)
    ) {
      return;
    }

    await nextTick();
    requestAnimationFrame(() => {
      if (hasLoggedInitialRender.value) {
        return;
      }

      hasLoggedInitialRender.value = true;
      console.log(
        `[keywords:list] rendered ${currentKeywords?.length ?? 0} keywords in ${(
          performance.now() - pageStartedAt
        ).toFixed(1)}ms`,
      );
    });
  },
  { immediate: true },
);

async function handleToggleFavorite(keyword: KeywordRecord) {
  if (updatingFavoriteIds.value.includes(keyword.id)) {
    return;
  }

  const previousKeywords = keywords.value ? [...keywords.value] : [];
  const nextIsFavorite = !keyword.isFavorite;

  updatingFavoriteIds.value = [...updatingFavoriteIds.value, keyword.id];

  if (keywords.value) {
    keywords.value = keywords.value.map((item) =>
      item.id === keyword.id
        ? {
            ...item,
            isFavorite: nextIsFavorite,
          }
        : item,
    );
  }

  try {
    const updatedKeyword = await setKeywordFavorite(keyword.id, nextIsFavorite);

    if (keywords.value) {
      keywords.value = keywords.value.map((item) =>
        item.id === updatedKeyword.id ? updatedKeyword : item,
      );
    }
  } catch (error) {
    keywords.value = previousKeywords;
    throw error;
  } finally {
    updatingFavoriteIds.value = updatingFavoriteIds.value.filter(
      (keywordId) => keywordId !== keyword.id,
    );
  }
}

async function handleDeleteKeyword(keyword: KeywordRecord) {
  if (deletingKeywordIds.value.includes(keyword.id)) {
    return;
  }

  const confirmed = window.confirm(
    `Mettre à la corbeille le mot-clé « ${keyword.keyword} » ?`,
  );

  if (!confirmed) {
    return;
  }

  const previousKeywords = keywords.value ? [...keywords.value] : [];

  deletingKeywordIds.value = [...deletingKeywordIds.value, keyword.id];

  if (keywords.value) {
    keywords.value = keywords.value.filter((item) => item.id !== keyword.id);
  }

  try {
    await deleteKeyword(keyword.id);
    await syncKeywordsSilently();
  } catch (error) {
    keywords.value = previousKeywords;
    throw error;
  } finally {
    deletingKeywordIds.value = deletingKeywordIds.value.filter(
      (keywordId) => keywordId !== keyword.id,
    );
  }
}

const existingKeywordNames = computed(() =>
  (keywords.value ?? []).map((item) => item.keyword),
);

function escapeCsvValue(value: string) {
  if (/[",\n\r;]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function buildKeywordsCsv(rows: KeywordRecord[]) {
  const header = ["keyword", "volume", "difficulty", "searchIntent"];
  const lines = rows.map((keyword) =>
    [
      escapeCsvValue(keyword.keyword),
      keyword.volume ?? "",
      keyword.difficulty ?? "",
      keyword.searchIntent ?? "",
    ].join(","),
  );

  return [header.join(","), ...lines].join("\n");
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function handleExportKeywords() {
  const exportRows = sortedKeywords.value;

  if (!exportRows.length) {
    return;
  }

  const csv = buildKeywordsCsv(exportRows);
  const timestamp = new Date().toISOString().slice(0, 10);

  downloadTextFile(`keywords-${timestamp}.csv`, csv, "text/csv;charset=utf-8;");
}

async function handleKeywordsImported() {
  await syncKeywordsSilently();
}

async function handleAnalyzeRequested(keyword: string) {
  await syncKeywordsSilently();
  await navigateTo(
    buildKeywordResearchUrl(keyword, {
      language: "fr",
      country: "fr",
    }),
  );
}

async function handleScanAllKeywords() {
  await handleScanKeywordCollection(sortedKeywords.value);
}

async function handleScanKeywordCollection(keywordCollection: KeywordRecord[]) {
  const keywordsToScan = keywordCollection
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
        const analysis = await analyzeKeyword(keyword);
        applyAnalyzedKeywordLocally(keyword, analysis);
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

    await syncKeywordsSilently();
  } finally {
    isScanningAllKeywords.value = false;
  }
}

function applyAnalyzedKeywordLocally(
  rawKeyword: string,
  analysis: {
    volume: number;
    difficulty: number;
    intent: string;
  },
) {
  const normalizedKeyword = normalizeSearchText(rawKeyword);

  if (!normalizedKeyword || !keywords.value) {
    return;
  }

  const scannedAt = new Date().toISOString();

  keywords.value = keywords.value.map((item) =>
    normalizeSearchText(item.keyword) === normalizedKeyword
      ? {
          ...item,
          volume: analysis.volume,
          difficulty: analysis.difficulty,
          searchIntent: analysis.intent as KeywordRecord["searchIntent"],
          lastScannedAt: scannedAt,
        }
      : item,
  );
}

async function syncKeywordsSilently() {
  keywords.value = await listKeywords();
}

async function handleRefreshKeywords() {
  if (isRefreshingKeywords.value || isScanningAllKeywords.value) {
    return;
  }

  isRefreshingKeywords.value = true;

  try {
    await syncKeywordsSilently();
  } finally {
    isRefreshingKeywords.value = false;
  }
}

function handleResetFilters() {
  search.value = "";
  selectedIntent.value = "";
  selectedGroup.value = "";
  onlyFavorites.value = false;
  activePrioritySectionKey.value = "";
  sectionPages.value = {};
}

function getKeywordPriorityRank(keyword: KeywordRecord) {
  const priorityLevel = getKeywordPriorityLevel(
    keyword.searchIntent,
    keyword.volume,
    keywordVolumeThresholds.value,
  );

  return priorityLevel ?? Number.POSITIVE_INFINITY;
}
</script>

<template>
  <section class="space-y-6">
    <UBreadcrumb :items="breadcrumbItems" class="text-slate-500" />

    <KeywordsKeywordImportModal
      v-model:open="isKeywordImportModalOpen"
      :existing-keywords="existingKeywordNames"
      @analyze-requested="handleAnalyzeRequested"
      @imported="handleKeywordsImported"
    />

    <!-- <header class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900">
        Voir les mots-clés
      </h1>
      <p class="text-sm text-slate-500">
        Les mots-clés sont regroupés par niveau de priorité, puis triés par
        volume décroissant dans chaque section.
      </p>
    </header> -->

    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div
        class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
      >
        <div class="flex w-full gap-3">
          <input
            v-model="search"
            type="text"
            placeholder="Filtrer les mots-clés..."
            class="w-full md:max-w-xs rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          />
          <select
            v-model="selectedIntent"
            class="w-full md:max-w-xs rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          >
            <option
              v-for="intent in intentOptions"
              :key="intent.value || 'all'"
              :value="intent.value"
            >
              {{ intent.label }}
            </option>
          </select>
          <select
            v-model="selectedGroup"
            class="w-full md:max-w-xs rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          >
            <option
              v-for="group in groupOptions"
              :key="group.value || 'all-groups'"
              :value="group.value"
            >
              {{ group.label }}
            </option>
          </select>

          <label
            class="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700"
          >
            <input
              v-model="onlyFavorites"
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            Favoris
          </label>

          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-rotate-ccw"
            :disabled="
              !search && !selectedIntent && !selectedGroup && !onlyFavorites
            "
            @click="handleResetFilters"
          >
            Réinitialiser
          </UButton>
        </div>

        <div class="flex flex-wrap justify-end gap-3">
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-scan-search"
            :title="isScanningAllKeywords ? 'Scan en cours...' : ''"
            :loading="isScanningAllKeywords"
            :disabled="!sortedKeywords.length"
            @click="handleScanAllKeywords"
          >
            {{ isScanningAllKeywords ? "Scan en cours..." : "" }}
          </UButton>

          <UButton
            title="Exporter CSV"
            color="neutral"
            variant="soft"
            icon="i-lucide-download"
            :disabled="!sortedKeywords.length || isScanningAllKeywords"
            @click="handleExportKeywords"
          >
            <!-- Exporter CSV -->
          </UButton>

          <UButton
            title="Ajouter des mots-clés"
            icon="i-lucide-plus"
            color="neutral"
            variant="soft"
            :disabled="isScanningAllKeywords"
            @click="isKeywordImportModalOpen = true"
          >
            <!-- Ajouter des mots-clés -->
          </UButton>
          <UButton
            title="Rafraîchir"
            color="neutral"
            variant="soft"
            icon="i-lucide-rotate-ccw"
            :loading="isRefreshingKeywords"
            :disabled="isScanningAllKeywords"
            @click="handleRefreshKeywords"
          >
            <!-- Rafraîchir -->
          </UButton>
        </div>
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

      <div v-if="showInitialKeywordsLoading" class="mt-5 space-y-4">
        <div
          class="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2"
        >
          <button
            v-for="section in prioritySections"
            :key="section.title"
            type="button"
            class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-slate-500"
          >
            <span>{{ section.title }}</span>
            <UBadge color="neutral" variant="soft">0</UBadge>
          </button>
        </div>

        <div
          class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div
            class="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="space-y-0.5">
              <h2 class="text-lg font-semibold text-slate-900">
                Chargement des sections...
              </h2>
              <p class="text-sm text-slate-500">
                Les tableaux s’affichent dès que la première section est prête.
              </p>
            </div>

            <UBadge color="neutral" variant="soft">0</UBadge>
          </div>

          <div class="px-4 py-4">
            <TablesKeywordsTablePlaceholder />
          </div>
        </div>
      </div>

      <FeedbackRichMessage
        v-else-if="error"
        tone="error"
        title="Impossible de charger les mots-clés"
        description="La requête a échoué, tu peux réessayer."
        action-label="Réessayer"
        class="mt-5"
        @action="handleRefreshKeywords"
      />

      <div
        v-else-if="!sortedKeywords.length"
        class="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500"
      >
        Aucun mot-clé à afficher.
      </div>

      <div v-else class="mt-5 space-y-4">
        <div
          class="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2"
        >
          <button
            v-for="section in visiblePrioritySections"
            :key="getPrioritySectionKey(section)"
            type="button"
            class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition"
            :class="
              activePrioritySectionKey === getPrioritySectionKey(section)
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:bg-white hover:text-slate-900'
            "
            @click="
              handlePrioritySectionTabClick(getPrioritySectionKey(section))
            "
          >
            <span>{{ section.title }}</span>
            <UBadge color="neutral" variant="soft">
              {{ section.keywords.length }}
            </UBadge>
          </button>
        </div>

        <div
          v-if="activePrioritySection"
          class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div
            class="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="space-y-0.5">
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-semibold text-slate-900">
                  {{ activePrioritySection.title }}
                </h2>
                <UBadge color="neutral" variant="soft">
                  {{ activePrioritySection.keywords.length }}
                </UBadge>
              </div>
              <UTooltip :text="activePrioritySection.description">
                <p class="text-sm text-slate-500">
                  {{ activePrioritySection.description }}
                </p>
              </UTooltip>
            </div>

            <UButton
              color="neutral"
              variant="soft"
              size="sm"
              icon="i-lucide-scan-search"
              :loading="isScanningAllKeywords"
              @click="
                handleScanKeywordCollection(activePrioritySection.keywords)
              "
            >
              Scanner ce tableau
            </UButton>
          </div>

          <div class="px-4 py-4">
            <div
              class="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500"
            >
              <span class="font-medium text-slate-600">
                Légende difficulté :
              </span>

              <span
                v-for="level in keywordDifficultyLevels"
                :key="`${level.label}-${level.maxScore}`"
                class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium"
                :class="
                  getKeywordDifficultyToneClass(
                    level.maxScore,
                    keywordDifficultyLevels,
                  )
                "
              >
                <span
                  :class="
                    getKeywordDifficultyTextClass(
                      level.maxScore,
                      keywordDifficultyLevels,
                    )
                  "
                >
                  {{ level.label }}
                </span>
                <span class="text-current/70">≤ {{ level.maxScore }}</span>
              </span>
            </div>

            <TablesKeywordsTable
              :keywords="activePrioritySectionKeywords"
              :updating-favorite-ids="updatingFavoriteIds"
              :deleting-keyword-ids="deletingKeywordIds"
              @toggle-favorite="handleToggleFavorite"
              @delete-keyword="handleDeleteKeyword"
            />

            <div
              class="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <p class="text-sm text-slate-500">
                Page {{ activePrioritySectionPage }} /
                {{ activePrioritySectionTotalPages }} ·
                {{ activePrioritySection.keywords.length }} mot-clé{{
                  activePrioritySection.keywords.length > 1 ? "s" : ""
                }}
              </p>

              <div class="flex items-center gap-2">
                <UButton
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-chevron-left"
                  :disabled="activePrioritySectionPage <= 1"
                  @click="
                    handlePrioritySectionPageChange(
                      activePrioritySectionPage - 1,
                    )
                  "
                >
                  Précédent
                </UButton>

                <UButton
                  color="neutral"
                  variant="soft"
                  trailing-icon="i-lucide-chevron-right"
                  :disabled="
                    activePrioritySectionPage >= activePrioritySectionTotalPages
                  "
                  @click="
                    handlePrioritySectionPageChange(
                      activePrioritySectionPage + 1,
                    )
                  "
                >
                  Suivant
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
