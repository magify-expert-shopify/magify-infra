<script setup lang="ts">
import KeywordGroupClusterAssignModal from "~/components/keywords/KeywordGroupClusterAssignModal.vue";
import KeywordGroupParentAssignModal from "~/components/keywords/KeywordGroupParentAssignModal.vue";
import KeywordGroupSplitModal from "~/components/keywords/KeywordGroupSplitModal.vue";
import KeywordGroupSuggestionCard from "~/components/suggestions/KeywordGroupSuggestionCard.vue";
import type {
  ArticleSuggestionRecord,
  KeywordPageType,
  KeywordGroupRecord,
} from "~/types/keywords";
import { normalizeSearchText } from "~/utils/search-normalizer";

const route = useRoute();
const {
  createKeywordGroup,
  listKeywordGroups,
  listSuggestions,
  updateKeywordGroup,
  setKeywordGroupFavorite,
} = useKeywords();
const { listSeoClusters } = useSeoClusters();
const { showErrorToast, showSuccessToast } = useAppToast();
const { user } = useSupabaseAuth();

const groupId = computed(() =>
  typeof route.params.id === "string" ? route.params.id.trim() : "",
);

const {
  data: groups,
  status,
  error,
  refresh,
} = await useAsyncData("keywords:groups:detail", () => listKeywordGroups());

const { data: contentSuggestions, status: contentSuggestionsStatus } =
  await useAsyncData(
    "keywords:groups:detail:content-suggestions",
    () => listSuggestions(),
    {
      default: () => [],
    },
  );
const { data: seoClusters } = await useAsyncData(
  "keywords:groups:detail:seo-clusters",
  () => listSeoClusters(),
  {
    default: () => [],
  },
);

const group = computed<KeywordGroupRecord | null>(() => {
  if (!groupId.value) {
    return null;
  }

  return (groups.value ?? []).find((item) => item.id === groupId.value) ?? null;
});

const contentSuggestion = computed<ArticleSuggestionRecord | null>(() => {
  if (!groupId.value) {
    return null;
  }

  return (
    (contentSuggestions.value ?? []).find(
      (item) => item.id === groupId.value,
    ) ?? null
  );
});

function handleContentSuggestionAssociated(payload: {
  suggestionId: string;
  pageId: string;
  pageTitle: string;
}) {
  contentSuggestions.value = (contentSuggestions.value ?? []).filter(
    (item) => item.id !== payload.suggestionId,
  );
}

const isInitialLoading = computed(
  () => status.value === "pending" && !groups.value?.length,
);

const isArticleSuggestionLoading = computed(
  () =>
    contentSuggestionsStatus.value === "pending" &&
    !contentSuggestions.value?.length,
);
const isUpdatingFavorite = ref(false);
const isUpdatingPrimaryKeyword = ref(false);
const isSplitModalOpen = ref(false);
const isSplittingGroup = ref(false);
const isParentAssignModalOpen = ref(false);
const isAssigningParent = ref(false);
const isClusterAssignModalOpen = ref(false);
const isAssigningCluster = ref(false);
const currentUserId = computed(() => user.value?.id ?? null);

const linkedPages = computed(() => {
  const pagesById = new Map<
    string,
    NonNullable<KeywordGroupRecord["keywords"][number]["page"]>
  >();

  for (const keyword of group.value?.keywords ?? []) {
    if (!keyword.page?.id) {
      continue;
    }

    if (!pagesById.has(keyword.page.id)) {
      pagesById.set(keyword.page.id, keyword.page);
    }
  }

  return Array.from(pagesById.values());
});

const primaryLinkedPage = computed(() => linkedPages.value[0] ?? null);

const primaryKeywordRecord = computed(() => {
  const keywords = group.value?.keywords ?? [];
  const primaryKeyword = normalizeSearchText(group.value?.primaryKeyword);

  if (!primaryKeyword) {
    return null;
  }

  return (
    keywords.find(
      (keyword) => normalizeSearchText(keyword.keyword) === primaryKeyword,
    ) ?? null
  );
});

const hasValidPrimaryKeyword = computed(() => Boolean(primaryKeywordRecord.value));

const suggestedPrimaryKeyword = computed(() => {
  const keywords = group.value?.keywords ?? [];

  if (!keywords.length || hasValidPrimaryKeyword.value) {
    return null;
  }

  return [...keywords].sort((left, right) => {
    const leftVolume = left.volume ?? -1;
    const rightVolume = right.volume ?? -1;

    if (leftVolume !== rightVolume) {
      return rightVolume - leftVolume;
    }

    const leftDifficulty = left.difficulty ?? Number.POSITIVE_INFINITY;
    const rightDifficulty = right.difficulty ?? Number.POSITIVE_INFINITY;

    if (leftDifficulty !== rightDifficulty) {
      return leftDifficulty - rightDifficulty;
    }

    return left.keyword.localeCompare(right.keyword, "fr", {
      sensitivity: "base",
    });
  })[0] ?? null;
});

const contentSuggestionChecks = computed(() => {
  const keywords = group.value?.keywords ?? [];
  const hasAnyKeyword = keywords.length > 0;
  const allowedTemplates = [
    "BLOG_ARTICLE",
    "TUTORIAL",
    "GUIDE",
    "DEFINITION",
  ] as const;
  const hasEligibleTemplate = keywords.some((keyword) =>
    allowedTemplates.includes(keyword.template as (typeof allowedTemplates)[number]),
  );
  const hasKeywordWithoutPage = keywords.some((keyword) => !keyword.page);
  const hasEligibleKeyword = keywords.some(
    (keyword) =>
      allowedTemplates.includes(
        keyword.template as (typeof allowedTemplates)[number],
      ) && !keyword.page,
  );

  const checks = [
    {
      label: "Le groupe contient au moins un mot-clé",
      met: hasAnyKeyword,
    },
    {
      label: "Au moins un mot-clé a un template éditorial",
      met: hasEligibleTemplate,
    },
    {
      label: "Au moins un mot-clé n’a pas encore de page",
      met: hasKeywordWithoutPage,
    },
    {
      label:
        "Au moins un mot-clé réunit les deux conditions: template éditorial + page vide",
      met: hasEligibleKeyword,
    },
  ];

  return {
    valid: checks.filter((check) => check.met),
    missing: checks.filter((check) => !check.met),
  };
});

function getTemplateIcon(template?: KeywordPageType | null) {
  if (template === "BLOG_ARTICLE") {
    return "i-lucide-file-text";
  }

  if (template === "GUIDE") {
    return "i-lucide-map";
  }

  if (template === "TUTORIAL") {
    return "i-lucide-graduation-cap";
  }

  if (template === "DEFINITION") {
    return "i-lucide-book-open-text";
  }

  if (template === "COLLECTION_PAGE") {
    return "i-lucide-layout-grid";
  }

  if (template === "PRODUCT_PAGE") {
    return "i-lucide-package";
  }

  if (template === "LANDING_PAGE") {
    return "i-lucide-flag";
  }

  return "i-lucide-file-search";
}

async function toggleFavorite() {
  if (!group.value || isUpdatingFavorite.value) {
    return;
  }

  isUpdatingFavorite.value = true;

  try {
    const updatedGroup = await setKeywordGroupFavorite(
      group.value.id,
      !group.value.isFavorite,
    );

    groups.value =
      groups.value?.map((item) =>
        item.id === updatedGroup.id
          ? { ...item, isFavorite: updatedGroup.isFavorite }
          : item,
      ) ?? groups.value;
  } catch (error) {
    showErrorToast("Impossible de mettre à jour le favori du groupe.", error);
  } finally {
    isUpdatingFavorite.value = false;
  }
}

async function applySuggestedPrimaryKeyword() {
  if (
    !group.value ||
    !suggestedPrimaryKeyword.value ||
    isUpdatingPrimaryKeyword.value
  ) {
    return;
  }

  isUpdatingPrimaryKeyword.value = true;

  try {
    const updatedGroup = await updateKeywordGroup(group.value.id, {
      primaryKeyword: suggestedPrimaryKeyword.value.keyword,
    });

    groups.value =
      groups.value?.map((item) =>
        item.id === updatedGroup.id ? updatedGroup : item,
      ) ?? groups.value;
  } finally {
    isUpdatingPrimaryKeyword.value = false;
  }
}

function openSplitModal() {
  if (!group.value?.keywords.length) {
    showErrorToast(
      "Split impossible",
      "Ce groupe doit contenir au moins un mot-clé pour pouvoir être splitté.",
    );
    return;
  }

  isSplitModalOpen.value = true;
}

function openParentAssignModal() {
  if (!group.value) {
    return;
  }

  isParentAssignModalOpen.value = true;
}

function openClusterAssignModal() {
  if (!group.value) {
    return;
  }

  isClusterAssignModalOpen.value = true;
}

async function handleAssignParent(parentGroupId: string) {
  if (!group.value || isAssigningParent.value) {
    return;
  }

  const nextParentGroupIds = [
    ...(group.value.parentGroups?.map((parent) => parent.id) ?? []),
    parentGroupId,
  ].filter((value, index, items) => items.indexOf(value) === index);

  isAssigningParent.value = true;

  try {
    const updatedGroup = await updateKeywordGroup(group.value.id, {
      parentGroupIds: nextParentGroupIds,
    });

    groups.value =
      groups.value?.map((item) => (item.id === updatedGroup.id ? updatedGroup : item)) ??
      groups.value;
    await refresh();
    isParentAssignModalOpen.value = false;
    showSuccessToast(
      "Parent ajouté",
      "Le groupe a bien été affilié à ce parent.",
    );
  } catch (error) {
    showErrorToast(
      "Impossible d’ajouter le parent",
      error instanceof Error ? error.message : "Une erreur inattendue est survenue.",
    );
  } finally {
    isAssigningParent.value = false;
  }
}

async function handleAssignCluster(clusterId: string) {
  if (!group.value || isAssigningCluster.value) {
    return;
  }

  isAssigningCluster.value = true;

  try {
    const updatedGroup = await updateKeywordGroup(group.value.id, {
      seoClusterId: clusterId,
    });

    groups.value =
      groups.value?.map((item) => (item.id === updatedGroup.id ? updatedGroup : item)) ??
      groups.value;
    await refresh();
    isClusterAssignModalOpen.value = false;
    showSuccessToast(
      "Cluster associé",
      "Le groupe a bien été affilié au cluster sélectionné.",
    );
  } catch (error) {
    showErrorToast(
      "Impossible d’associer le cluster",
      error instanceof Error ? error.message : "Une erreur inattendue est survenue.",
    );
  } finally {
    isAssigningCluster.value = false;
  }
}

async function handleSplitGroup(payload: {
  left: {
    name: string;
    description: string;
    keywordIds: string[];
    primaryKeyword: string | null;
  };
  right: {
    name: string;
    description: string;
    keywordIds: string[];
    primaryKeyword: string | null;
  };
}) {
  if (!group.value || isSplittingGroup.value) {
    return;
  }

  isSplittingGroup.value = true;

  try {
    await createKeywordGroup({
      name: payload.right.name,
      description: payload.right.description || null,
      keywordIds: payload.right.keywordIds,
      primaryKeyword: payload.right.primaryKeyword,
      parentGroupIds: group.value.parentGroups?.map((parent) => parent.id) ?? null,
    });

    const updatedGroup = await updateKeywordGroup(group.value.id, {
      name: payload.left.name,
      description: payload.left.description || null,
      keywordIds: payload.left.keywordIds,
      primaryKeyword: payload.left.primaryKeyword,
      parentGroupIds: group.value.parentGroups?.map((parent) => parent.id) ?? null,
    });

    groups.value =
      groups.value?.map((item) => (item.id === updatedGroup.id ? updatedGroup : item)) ??
      groups.value;
    await refresh();
    isSplitModalOpen.value = false;
    showSuccessToast(
      "Groupe splitté",
      "Le groupe a bien été séparé en deux groupes de mots-clés.",
    );
  } catch (error) {
    showErrorToast(
      "Impossible de splitter le groupe",
      error instanceof Error ? error.message : "Une erreur inattendue est survenue.",
    );
  } finally {
    isSplittingGroup.value = false;
  }
}
</script>

<template>
  <section class="space-y-6">
    <div class="flex items-center justify-between gap-4">
      <div class="space-y-1">
        <p class="text-sm text-slate-500">
          <NuxtLink
            to="/keywords/groups"
            class="underline decoration-transparent underline-offset-4 transition hover:decoration-slate-300"
          >
            Groupes de mots-clés
          </NuxtLink>
        </p>
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900">
          Détail du groupe
        </h1>
      </div>

      <div class="flex items-center gap-2">
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-network"
          @click="openClusterAssignModal"
        >
          {{ group?.seoCluster ? "Changer de cluster" : "Ajouter un cluster" }}
        </UButton>

        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-folder-tree"
          @click="openParentAssignModal"
        >
          Ajouter un parent
        </UButton>

        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-split"
          :disabled="!group?.keywords.length"
          @click="openSplitModal"
        >
          Splitter
        </UButton>

        <UButton
          color="neutral"
          variant="soft"
          class="group/favorite"
          :loading="isUpdatingFavorite"
          :title="group?.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'"
          @click="toggleFavorite"
        >
          <UIcon
            name="i-lucide-star"
            class="h-4 w-4 transition"
            :class="
              group?.isFavorite
                ? 'fill-amber-500 text-amber-500'
                : 'text-amber-600/40 opacity-80 group-hover/favorite:text-amber-600 group-hover/favorite:opacity-100'
            "
          />
        </UButton>

        <UButton
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="soft"
          :loading="status === 'pending'"
          @click="refresh"
        >
          <!-- Rafraîchir -->
        </UButton>
      </div>
    </div>

    <KeywordGroupSplitModal
      v-model:open="isSplitModalOpen"
      :group="group"
      :is-submitting="isSplittingGroup"
      @submit="handleSplitGroup"
    />

    <KeywordGroupParentAssignModal
      v-model:open="isParentAssignModalOpen"
      :group="group"
      :groups="groups ?? []"
      :is-submitting="isAssigningParent"
      @submit="handleAssignParent"
    />

    <KeywordGroupClusterAssignModal
      v-model:open="isClusterAssignModalOpen"
      :group="group"
      :clusters="seoClusters ?? []"
      :is-submitting="isAssigningCluster"
      @submit="handleAssignCluster"
    />

    <p v-if="isInitialLoading" class="text-sm text-slate-500">
      Chargement du groupe...
    </p>

    <FeedbackRichMessage
      v-else-if="error && !group"
      tone="error"
      title="Impossible de charger le groupe"
      description="Le groupe demandé n'a pas pu être récupéré."
      action-label="Réessayer"
      @action="refresh"
    />

    <FeedbackRichMessage
      v-else-if="!group"
      tone="warning"
      title="Groupe introuvable"
      description="Le groupe demandé n'existe pas ou a été supprimé."
    />

      <div v-else class="space-y-6">
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge color="neutral" variant="soft">
                {{ group.primaryKeyword || "Sans mot-clé principal" }}
              </UBadge>
              <UBadge
                v-if="group.parentGroups?.length"
                color="info"
                variant="soft"
              >
                {{ group.parentGroups.length }} parent{{ group.parentGroups.length > 1 ? "s" : "" }}
              </UBadge>
              <UBadge v-if="group.seoCluster" color="success" variant="soft">
                Cluster lié
              </UBadge>
              <UBadge v-if="group.isFavorite" color="warning" variant="soft">
                Favori
              </UBadge>
            </div>

            <h2 class="text-xl font-semibold text-slate-900">
              {{ group.name }}
            </h2>

            <p
              v-if="group.description"
              class="max-w-3xl text-sm leading-6 text-slate-600"
            >
              {{ group.description }}
            </p>
            <p v-else class="text-sm text-slate-400">
              Aucune description renseignée.
            </p>

            <div
              v-if="group.parentGroups?.length"
              class="flex flex-wrap items-center gap-2 pt-1"
            >
              <span class="text-xs font-medium uppercase tracking-wide text-slate-400">
                Parents
              </span>
              <UBadge
                v-for="parentGroup in group.parentGroups"
                :key="parentGroup.id"
                color="neutral"
                variant="outline"
              >
                {{ parentGroup.name }}
              </UBadge>
            </div>
          </div>

          <div
            v-if="group.seoCluster"
            class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3"
          >
            <p
              class="text-xs font-medium uppercase tracking-wide text-emerald-600"
            >
              Cluster associé
            </p>
            <NuxtLink
              :to="`/clusters/${group.seoCluster.id}`"
              class="mt-1 inline-flex text-sm font-medium text-emerald-800 underline decoration-transparent underline-offset-4 transition hover:decoration-emerald-400"
            >
              {{ group.seoCluster.name }}
            </NuxtLink>
          </div>
        </div>
        </div>

        <div
          v-if="suggestedPrimaryKeyword"
          class="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
        >
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge color="warning" variant="soft">
                  Suggestion de mot-clé principal
                </UBadge>
                <UBadge color="neutral" variant="soft">
                  Vol. {{ suggestedPrimaryKeyword.volume ?? "-" }}
                </UBadge>
                <UBadge color="neutral" variant="soft">
                  Diff. {{ suggestedPrimaryKeyword.difficulty ?? "-" }}
                </UBadge>
              </div>

              <h3 class="text-lg font-semibold text-slate-900">
                {{ suggestedPrimaryKeyword.keyword }}
              </h3>

              <p class="text-sm leading-6 text-slate-600">
                Ce groupe n’a pas encore de mot-clé principal. Nous te
                suggérons celui-ci car il a le meilleur volume disponible parmi
                les mots-clés du groupe.
              </p>
            </div>

            <UButton
              color="warning"
              variant="soft"
              icon="i-lucide-star"
              :loading="isUpdatingPrimaryKeyword"
              @click="applySuggestedPrimaryKeyword"
            >
              Définir comme principal
            </UButton>
          </div>
        </div>

        <div
          v-if="linkedPages.length"
          class="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm"
        >
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge color="info" variant="soft">Page liée</UBadge>
                <UBadge color="neutral" variant="soft">
                  {{ linkedPages.length }} page{{ linkedPages.length > 1 ? "s" : "" }}
                </UBadge>
              </div>

              <h3 class="text-lg font-semibold text-slate-900">
                {{ primaryLinkedPage?.title }}
              </h3>

              <p class="text-sm leading-6 text-slate-600">
                Ce groupe est déjà lié à une page, donc la suggestion de contenu n’est pas affichée.
              </p>
            </div>

            <UButton
              v-if="primaryLinkedPage"
              color="info"
              variant="soft"
              icon="i-lucide-arrow-right"
              :to="`/pages/${primaryLinkedPage.id}`"
            >
              Ouvrir la page
            </UButton>
          </div>
        </div>

      <div
        v-if="!linkedPages.length"
        class="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge color="info" variant="soft">Suggestion de contenu</UBadge>
              <UBadge v-if="contentSuggestion" color="success" variant="soft">
                Possible
              </UBadge>
            </div>

            <h3 class="text-lg font-semibold text-slate-900">
              {{
                contentSuggestion ? group.name : "Aucune suggestion possible"
              }}
            </h3>

            <p
              v-if="contentSuggestion"
              class="max-w-3xl text-sm leading-6 text-slate-600"
            >
              Ce groupe contient des mots-clés déjà orientés vers un template
              éditorial sans page associée. Il peut donc servir de base à un
              article, une définition, un tutoriel ou un guide.
            </p>
            <p v-else class="text-sm text-slate-500">
              Ce groupe ne remplit pas encore les conditions pour proposer une
              suggestion de création de contenu.
            </p>
          </div>

          <UButton
            v-if="contentSuggestion"
            color="info"
            variant="soft"
            icon="i-lucide-lightbulb"
            to="/suggestions"
          >
            Voir toutes les suggestions
          </UButton>
        </div>

        <div v-if="contentSuggestion" class="mt-4">
          <KeywordGroupSuggestionCard
            :suggestion="contentSuggestion"
            :current-user-id="currentUserId"
            @associated="handleContentSuggestionAssociated"
          />
        </div>

        <p
          v-else-if="isArticleSuggestionLoading"
          class="mt-4 text-sm text-slate-500 animate-pulse"
        >
          Recherche d’une suggestion de contenu possible...
        </p>

        <div v-else class="mt-4 grid gap-4 xl:grid-cols-2">
          <div class="rounded-2xl border border-emerald-200 bg-white px-4 py-4">
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-circle-check-big"
                class="h-4 w-4 text-emerald-600"
              />
              <h4 class="font-semibold text-slate-900">Conditions validées</h4>
            </div>

            <ul
              v-if="contentSuggestionChecks.valid.length"
              class="mt-3 space-y-2 text-sm text-slate-700"
            >
              <li
                v-for="check in contentSuggestionChecks.valid"
                :key="check.label"
                class="flex items-start gap-2"
              >
                <UIcon
                  name="i-lucide-check"
                  class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                />
                <span>{{ check.label }}</span>
              </li>
            </ul>

            <p v-else class="mt-3 text-sm text-slate-500">
              Aucune condition n’est encore validée.
            </p>
          </div>

          <div class="rounded-2xl border border-amber-200 bg-white px-4 py-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-circle-x" class="h-4 w-4 text-amber-600" />
              <h4 class="font-semibold text-slate-900">
                Conditions non réunies
              </h4>
            </div>

            <ul
              v-if="contentSuggestionChecks.missing.length"
              class="mt-3 space-y-2 text-sm text-slate-700"
            >
              <li
                v-for="check in contentSuggestionChecks.missing"
                :key="check.label"
                class="flex items-start gap-2"
              >
                <UIcon
                  name="i-lucide-x"
                  class="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                />
                <span>{{ check.label }}</span>
              </li>
            </ul>

            <p v-else class="mt-3 text-sm text-slate-500">
              Toutes les conditions sont réunies.
            </p>
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-lg font-semibold text-slate-900">
            Mots-clés du groupe
          </h3>
          <!-- <UBadge color="neutral" variant="soft">
            {{ group.keywords.length }}
          </UBadge> -->
        </div>

        <ul
          v-if="group.keywords.length"
          class="mt-4 flex flex-wrap gap-4"
        >
          <li
            v-for="keyword in group.keywords"
            :key="keyword.id"
            class="rounded-full border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <UIcon
                  :title="keyword.template"
                  :name="
                    getTemplateIcon(keyword.template ?? keyword.page?.pageType)
                  "
                  class="h-4 w-4 text-slate-500"
                />
                <UBadge
                  v-if="group.primaryKeyword === keyword.keyword"
                  color="warning"
                  variant="soft"
                >
                  Principal
                </UBadge>
                <NuxtLink
                  :to="`/keywords/research?q=${encodeURIComponent(keyword.keyword)}&autorun=0`"
                  class="font-medium text-slate-900 underline decoration-transparent underline-offset-4 transition hover:decoration-slate-300"
                >
                  {{ keyword.keyword }}
                </NuxtLink>
              </div>

              <p
                v-if="keyword.searchIntentDescription"
                class="text-sm leading-6 text-slate-600"
              >
                {{ keyword.searchIntentDescription }}
              </p>
            </div>
          </li>
        </ul>

        <p v-else class="mt-4 text-sm text-slate-500">
          Aucun mot-clé associé à ce groupe.
        </p>
      </div>
    </div>
  </section>
</template>
