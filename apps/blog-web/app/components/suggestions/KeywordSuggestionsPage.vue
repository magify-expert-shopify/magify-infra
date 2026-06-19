<script setup lang="ts">
import { pageTypeLabels } from "~/constants/pages";
import KeywordGroupDeduplicationModal from "~/components/suggestions/KeywordGroupDeduplicationModal.vue";
import KeywordGroupSuggestionsGrid from "~/components/suggestions/KeywordGroupSuggestionsGrid.vue";
import { defaultKeywordDifficultyLevels } from "~/constants/keyword-difficulty";
import type {
  KeywordGroupSuggestionRecord,
  KeywordPageType,
} from "~/types/keywords";
import { getKeywordDifficultySortRank } from "~/utils/keyword-difficulty";
import { normalizeSearchText } from "~/utils/search-normalizer";

type BreadcrumbItem = {
  label: string;
  to?: string;
};

type SuggestionSortMode =
  | "easeThenVolume"
  | "volumeThenEase"
  | "difficultyThenVolume"
  | "alphabetical";

const props = withDefaults(
  defineProps<{
    dataKey: string;
    breadcrumbItems: BreadcrumbItem[];
    title: string;
    description: string;
    pageTypeFilter?: KeywordPageType | null;
    showTemplateFilter?: boolean;
    showSortFilter?: boolean;
    showAssignmentFilter?: boolean;
    showFavoritesFilter?: boolean;
    showDedupButton?: boolean;
    showIdeasBox?: boolean;
    ideasBoxTo?: string;
    ideasBoxTitle?: string;
    ideasBoxDescription?: string;
    ideasBoxButtonLabel?: string;
  }>(),
  {
    pageTypeFilter: null,
    showTemplateFilter: true,
    showSortFilter: true,
    showAssignmentFilter: true,
    showFavoritesFilter: true,
    showDedupButton: false,
    showIdeasBox: false,
    ideasBoxTo: "",
    ideasBoxTitle: "Besoin d'idées pour les prochains contenus ?",
    ideasBoxDescription:
      "Consulte la page des suggestions pour repérer rapidement les opportunités à rédiger.",
    ideasBoxButtonLabel: "Voir les suggestions",
  },
);

const { listSuggestions } = useKeywords();
const { getCurrentSprint, getKeywordDifficultyLevels } = useSettings();
const { user: connectedUser } = useSupabaseAuth();
const { currentProject } = useCurrentProject();
const currentProjectId = computed(() => currentProject.value?.id?.trim() ?? "");

const {
  data: suggestions,
  status,
  error,
  refresh,
} = await useAsyncData(
  () => `${props.dataKey}:${currentProjectId.value || "no-project"}`,
  () => {
    if (!currentProjectId.value) {
      return [];
    }

    return listSuggestions();
  },
  {
    default: () => [],
    watch: [currentProjectId],
  },
);

const { data: currentSprint } = await useAsyncData(
  () => `${props.dataKey}:current-sprint:${currentProjectId.value || "no-project"}`,
  () => {
    if (!currentProjectId.value) {
      return null;
    }

    return getCurrentSprint();
  },
  {
    watch: [currentProjectId],
  },
);

const { data: keywordDifficultyLevelsSettings } = await useAsyncData(
  () =>
    `${props.dataKey}:keyword-difficulty-levels:${currentProjectId.value || "no-project"}`,
  () => {
    if (!currentProjectId.value) {
      return null;
    }

    return getKeywordDifficultyLevels();
  },
  {
    watch: [currentProjectId],
  },
);

const searchQuery = ref("");
const ALL_TEMPLATE_TYPES = "__all__";
const templateTypeFilter = ref<KeywordPageType | typeof ALL_TEMPLATE_TYPES>(
  props.pageTypeFilter ?? ALL_TEMPLATE_TYPES,
);
const sortMode = ref<SuggestionSortMode>("easeThenVolume");
const hideSuggestionsAssignedToOthers = ref(true);
const showFavoritesOnly = ref(false);
const isDedupModalOpen = ref(false);
const editorialTemplateTypes: KeywordPageType[] = [
  "BLOG_ARTICLE",
  "TUTORIAL",
  "GUIDE",
  "DEFINITION",
];

const currentUserId = computed(() => connectedUser.value?.id ?? null);

const keywordDifficultyLevels = computed(
  () =>
    keywordDifficultyLevelsSettings.value?.levels ??
    defaultKeywordDifficultyLevels,
);

const templateTypeOptions = computed(() => [
  {
    label: "Tous les types",
    value: ALL_TEMPLATE_TYPES,
  },
  ...editorialTemplateTypes.map((templateType) => ({
    label: pageTypeLabels[templateType],
    value: templateType,
  })),
]);

const sortOptions = [
  {
    label: "Facilité puis volume",
    value: "easeThenVolume",
  },
  {
    label: "Volume puis facilité",
    value: "volumeThenEase",
  },
  {
    label: "Niveau de difficulté puis volume",
    value: "difficultyThenVolume",
  },
  {
    label: "Nom alphabétique",
    value: "alphabetical",
  },
] as const;

function normalizeUserId(userId?: string | null) {
  return userId?.trim() ?? "";
}

function getSuggestionKeywords(suggestion: KeywordGroupSuggestionRecord) {
  return Array.isArray(suggestion.keywords) ? suggestion.keywords : [];
}

function getPrimaryKeywordRecord(suggestion: KeywordGroupSuggestionRecord) {
  const keywords = getSuggestionKeywords(suggestion);
  const primaryKeyword = normalizeSearchText(suggestion.primaryKeyword);

  if (!primaryKeyword) {
    return keywords[0] ?? null;
  }

  return (
    keywords.find(
      (keyword) => normalizeSearchText(keyword.keyword) === primaryKeyword,
    ) ??
    keywords[0] ??
    null
  );
}

function getSuggestionTemplateTypes(suggestion: KeywordGroupSuggestionRecord) {
  const keywords = getSuggestionKeywords(suggestion);

  return [
    ...new Set(
      keywords
        .map((keyword) => keyword.template)
        .filter(
          (template): template is KeywordPageType =>
            Boolean(template) && editorialTemplateTypes.includes(template),
        ),
    ),
  ];
}

function matchesSearchFilter(suggestion: KeywordGroupSuggestionRecord) {
  const search = normalizeSearchText(searchQuery.value);

  if (!search) {
    return true;
  }

  const keywords = getSuggestionKeywords(suggestion);
  const searchableText = [
    suggestion.name,
    suggestion.description ?? "",
    suggestion.primaryKeyword ?? "",
    suggestion.assignedSupabaseUserName ?? "",
    suggestion.assignedSupabaseUserEmail ?? "",
    ...keywords.map((keyword) => keyword.keyword),
  ]
    .join(" ")
    .trim();

  return normalizeSearchText(searchableText).includes(search);
}

function matchesTemplateTypeFilter(suggestion: KeywordGroupSuggestionRecord) {
  if (props.pageTypeFilter) {
    return getSuggestionTemplateTypes(suggestion).includes(props.pageTypeFilter);
  }

  if (templateTypeFilter.value === ALL_TEMPLATE_TYPES) {
    return true;
  }

  return getSuggestionTemplateTypes(suggestion).includes(
    templateTypeFilter.value,
  );
}

function isAssignedToCurrentUser(suggestion: KeywordGroupSuggestionRecord) {
  const assigneeId = normalizeUserId(suggestion.assignedSupabaseUserId);
  const userId = normalizeUserId(currentUserId.value);

  return Boolean(assigneeId && userId && assigneeId === userId);
}

function isAssignedToAnotherUser(suggestion: KeywordGroupSuggestionRecord) {
  const assigneeId = normalizeUserId(suggestion.assignedSupabaseUserId);

  return Boolean(assigneeId) && !isAssignedToCurrentUser(suggestion);
}

function matchesAssignmentFilter(suggestion: KeywordGroupSuggestionRecord) {
  if (!props.showAssignmentFilter || !hideSuggestionsAssignedToOthers.value) {
    return true;
  }

  return !isAssignedToAnotherUser(suggestion);
}

function matchesFavoritesFilter(suggestion: KeywordGroupSuggestionRecord) {
  if (!props.showFavoritesFilter || !showFavoritesOnly.value) {
    return true;
  }

  return suggestion.isFavorite;
}

function compareSuggestions(
  left: KeywordGroupSuggestionRecord,
  right: KeywordGroupSuggestionRecord,
) {
  const leftPrimary = getPrimaryKeywordRecord(left);
  const rightPrimary = getPrimaryKeywordRecord(right);
  const leftDifficulty = getKeywordDifficultySortRank(
    leftPrimary?.difficulty,
    keywordDifficultyLevels.value,
  );
  const rightDifficulty = getKeywordDifficultySortRank(
    rightPrimary?.difficulty,
    keywordDifficultyLevels.value,
  );
  const leftVolume = leftPrimary?.volume ?? -1;
  const rightVolume = rightPrimary?.volume ?? -1;
  const alphabeticalComparison = left.name.localeCompare(right.name, "fr", {
    sensitivity: "base",
  });

  if (sortMode.value === "alphabetical") {
    return alphabeticalComparison;
  }

  if (sortMode.value === "volumeThenEase") {
    if (leftVolume !== rightVolume) {
      return rightVolume - leftVolume;
    }

    if (leftDifficulty !== rightDifficulty) {
      return leftDifficulty - rightDifficulty;
    }

    return alphabeticalComparison;
  }

  if (sortMode.value === "difficultyThenVolume") {
    if (leftDifficulty !== rightDifficulty) {
      return rightDifficulty - leftDifficulty;
    }

    if (leftVolume !== rightVolume) {
      return rightVolume - leftVolume;
    }

    return alphabeticalComparison;
  }

  if (leftDifficulty !== rightDifficulty) {
    return leftDifficulty - rightDifficulty;
  }

  if (leftVolume !== rightVolume) {
    return rightVolume - leftVolume;
  }

  return alphabeticalComparison;
}

const filteredSuggestions = computed(() =>
  [...(suggestions.value ?? [])]
    .filter(matchesSearchFilter)
    .filter(matchesTemplateTypeFilter)
    .filter(matchesAssignmentFilter)
    .filter(matchesFavoritesFilter)
    .sort(compareSuggestions),
);

const assignedToMeCount = computed(
  () => filteredSuggestions.value.filter(isAssignedToCurrentUser).length,
);

const hasSuggestions = computed(() => filteredSuggestions.value.length > 0);
const hasAnySuggestions = computed(() => (suggestions.value?.length ?? 0) > 0);
const sprintClusterId = computed(() => currentSprint.value?.clusterId ?? null);
const hasCurrentProject = computed(() => Boolean(currentProjectId.value));

function handleSuggestionAssigned(
  updatedSuggestion: KeywordGroupSuggestionRecord,
) {
  suggestions.value = (suggestions.value ?? []).map((suggestion) =>
    suggestion.id === updatedSuggestion.id ? updatedSuggestion : suggestion,
  );
}

function handleSuggestionAssociated(payload: {
  suggestionId: string;
  pageId: string;
  pageTitle: string;
}) {
  suggestions.value = (suggestions.value ?? []).filter(
    (suggestion) => suggestion.id !== payload.suggestionId,
  );
}

function handleSuggestionsMerged(payload: {
  targetGroup: KeywordGroupSuggestionRecord;
  mergedGroupIds: string[];
}) {
  const mergedGroupIds = new Set(payload.mergedGroupIds);

  suggestions.value = (suggestions.value ?? [])
    .filter((suggestion) => !mergedGroupIds.has(suggestion.id))
    .map((suggestion) =>
      suggestion.id === payload.targetGroup.id
        ? payload.targetGroup
        : suggestion,
    );
}

watch(
  () => props.pageTypeFilter,
  (value) => {
    templateTypeFilter.value = value ?? ALL_TEMPLATE_TYPES;
  },
  { immediate: true },
);
</script>

<template>
  <section class="space-y-6">
    <UBreadcrumb :items="breadcrumbItems" class="text-slate-500" />

    <header class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900">
          {{ title }}
        </h1>
        <p class="text-sm text-slate-500">
          {{ description }}
        </p>
        <div class="flex flex-wrap items-center gap-2 pt-1">
          <UBadge color="primary" variant="soft" class="rounded-full px-3 py-1">
            Mes cartes assignées: {{ assignedToMeCount }}
          </UBadge>
          <UBadge
            v-if="pageTypeFilter"
            color="neutral"
            variant="soft"
            class="rounded-full px-3 py-1"
          >
            {{ pageTypeLabels[pageTypeFilter] }}
          </UBadge>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <UButton
          v-if="showDedupButton"
          color="neutral"
          variant="soft"
          icon="i-lucide-git-merge"
          :disabled="!hasAnySuggestions"
          @click="isDedupModalOpen = true"
        >
          Dédoublonner
        </UButton>

        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-rotate-ccw"
          :loading="status === 'pending'"
          @click="refresh()"
        >
          <!-- Rafraîchir -->
        </UButton>
      </div>
    </header>

    <div
      class="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-[minmax(10rem,1fr)_18rem_18rem_auto_auto]"
    >
      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        size="lg"
        placeholder="Filtrer les suggestions..."
      />

      <USelect
        v-if="showTemplateFilter && !pageTypeFilter"
        v-model="templateTypeFilter"
        :items="templateTypeOptions"
        value-key="value"
        label-key="label"
        size="lg"
      />

      <USelect
        v-if="showSortFilter"
        v-model="sortMode"
        :items="sortOptions"
        value-key="value"
        label-key="label"
        size="lg"
      />

      <div
        v-if="showAssignmentFilter"
        class="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2"
      >
        <USwitch v-model="hideSuggestionsAssignedToOthers" color="primary" />
        <div class="space-y-0.5">
          <p class="text-sm font-medium text-slate-900">
            Cacher celles assignées aux autres
          </p>
          <p class="text-xs text-slate-500">
            Actif par défaut pour garder nos suggestions visibles.
          </p>
        </div>
      </div>

      <div
        v-if="showFavoritesFilter"
        class="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2"
      >
        <USwitch v-model="showFavoritesOnly" color="primary" />
        <div class="space-y-0.5">
          <p class="text-sm font-medium text-slate-900">
            Afficher seulement les favoris
          </p>
          <p class="text-xs text-slate-500">
            Pratique pour se concentrer sur les groupes marqués.
          </p>
        </div>
      </div>
    </div>

    <FeedbackInlineMessage
      v-if="status === 'pending' && !hasSuggestions"
      class="animate-pulse"
      tone="info"
    >
      Recherche des suggestions...
    </FeedbackInlineMessage>

    <FeedbackInlineMessage v-else-if="!hasCurrentProject" tone="warning">
      Sélectionne un projet courant pour charger les suggestions.
    </FeedbackInlineMessage>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :details="error.toString()"
      title="Impossible de charger les suggestions"
      description="Les groupes suggérés n’ont pas pu être récupérés."
      action-label="Réessayer"
      @action="refresh()"
    />

    <div v-else-if="hasSuggestions" class="space-y-4">
      <KeywordGroupSuggestionsGrid
        :suggestions="filteredSuggestions"
        :sprint-cluster-id="sprintClusterId"
        :current-user-id="currentUserId"
        @assigned="handleSuggestionAssigned"
        @associated="handleSuggestionAssociated"
      />
    </div>

    <FeedbackInlineMessage v-else-if="hasAnySuggestions" tone="info">
      Aucune suggestion ne correspond à ces filtres.
    </FeedbackInlineMessage>

    <FeedbackInlineMessage v-else tone="info">
      Aucune suggestion pour le moment.
    </FeedbackInlineMessage>

    <div
      v-if="showIdeasBox"
      class="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 shadow-sm"
    >
      <div
        class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="space-y-1">
          <p class="text-sm font-semibold text-sky-950">
            {{ ideasBoxTitle }}
          </p>
          <p class="text-sm text-sky-800/80">
            {{ ideasBoxDescription }}
          </p>
        </div>

        <UButton
          :to="ideasBoxTo"
          color="primary"
          variant="solid"
          icon="i-lucide-lightbulb"
        >
          {{ ideasBoxButtonLabel }}
        </UButton>
      </div>
    </div>

    <KeywordGroupDeduplicationModal
      v-if="showDedupButton"
      v-model:open="isDedupModalOpen"
      :suggestions="suggestions ?? []"
      @merged="handleSuggestionsMerged"
    />
  </section>
</template>
