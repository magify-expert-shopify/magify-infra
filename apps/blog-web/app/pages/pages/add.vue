<script setup lang="ts">
import { pageTypeLabels } from "~/constants/pages";
import { useAppToast } from "~/composables/useAppToast";
import { useKeywords } from "~/composables/useKeywords";
import { usePages } from "~/composables/usePages";
import { useSeoClusters } from "~/composables/useSeoClusters";
import type { KeywordGroupSuggestionRecord } from "~/types/keywords";

const route = useRoute();
const { listSuggestions } = useKeywords();
const { listSeoClusters } = useSeoClusters();
const {
  createBlankPageFromSuggestionGroup,
  createPageFromSuggestionGroup,
  generatePagePlanFromSuggestionGroup,
  getStoredPagePlanFromSuggestionGroup,
  savePagePlanFromSuggestionGroup,
  suggestSecondaryKeywordsFromSuggestionGroup,
} = usePages();
const { showErrorToast, showSuccessToast } = useAppToast();

const { data: suggestions, status: suggestionsStatus } = await useAsyncData(
  "pages:add:suggestions",
  () => listSuggestions(),
  {
    default: () => [],
  },
);

const { data: seoClusters } = await useAsyncData(
  "pages:add:seo-clusters",
  () => listSeoClusters(),
  {
    default: () => [],
  },
);

const suggestionId = computed(() => {
  const value = route.query.groupId;

  return typeof value === "string" && value.trim() ? value.trim() : null;
});

const currentSuggestion = computed<KeywordGroupSuggestionRecord | null>(() => {
  if (!suggestions.value?.length || !suggestionId.value) {
    return null;
  }

  return (
    suggestions.value.find(
      (suggestion) => suggestion.id === suggestionId.value,
    ) ?? null
  );
});

const currentSuggestionCluster = computed(() => {
  const clusterId = currentSuggestion.value?.seoClusterId?.trim();

  if (!clusterId) {
    return null;
  }

  return (
    seoClusters.value.find((cluster) => cluster.id === clusterId) ??
    currentSuggestion.value?.seoCluster ??
    null
  );
});

const currentSuggestionPillarPage = computed(() => {
  const cluster = currentSuggestionCluster.value;

  if (!cluster || !("pages" in cluster) || !Array.isArray(cluster.pages)) {
    return null;
  }

  return (
    cluster.pages.find(
      (page) => page.seoRole === "PILLAR" && page.pageType === "LANDING_PAGE",
    ) ??
    cluster.pages.find((page) => page.seoRole === "PILLAR") ??
    null
  );
});

const currentSuggestionPillarKeywordGroup = computed(() => {
  const cluster = currentSuggestionCluster.value;

  if (!cluster || !("pillarKeywordGroup" in cluster)) {
    return null;
  }

  return cluster.pillarKeywordGroup ?? null;
});

const currentSuggestionPillarLabel = computed(() => {
  if (currentSuggestionPillarPage.value?.title?.trim()) {
    return currentSuggestionPillarPage.value.title.trim();
  }

  if (currentSuggestionPillarKeywordGroup.value?.name?.trim()) {
    return currentSuggestionPillarKeywordGroup.value.name.trim();
  }

  return null;
});

const currentSuggestionClusterPrimaryKeyword = computed(() => {
  const cluster = currentSuggestionCluster.value;

  if (!cluster || !("primaryKeyword" in cluster)) {
    return null;
  }

  return cluster.primaryKeyword?.trim() || null;
});

const currentSuggestionPillarSecondaryLabel = computed(() => {
  const pillarKeyword =
    currentSuggestionPillarKeywordGroup.value?.primaryKeyword?.trim();

  if (pillarKeyword) {
    return pillarKeyword;
  }

  return null;
});

const templateTypes = computed(() =>
  [
    ...new Set(
      (currentSuggestion.value?.keywords ?? [])
        .map((keyword) => keyword.template)
        .filter(Boolean),
    ),
  ].filter((template): template is NonNullable<typeof template> =>
    Boolean(template),
  ),
);

const detectedPageTypeLabel = computed(() =>
  templateTypes.value.length
    ? pageTypeLabels[templateTypes.value[0]]
    : "Type de page non déterminé",
);

const isSubmittingPlan = ref(false);
const isSubmittingArticle = ref(false);
const isSubmittingBlankArticle = ref(false);
const currentStep = ref<1 | 2 | 3>(1);
const subjectExact = ref("");
const primaryKeyword = ref("");
const secondaryKeywords = ref("");
const secondaryKeywordDraft = ref("");
const target = ref("Entrepreneuses et e-commerçantes débutantes");
const conversionObjective = ref(
  "Créer de la confiance, expliquer et faire passer à l'action",
);
const approxLength = ref("1200 mots");
const plan = ref("");
const isLoadingStoredPlan = ref(false);
const hasStoredPlan = ref(false);
const isSavingPlan = ref(false);
const isSuggestingSecondaryKeywords = ref(false);

type HeadingChecklistItem = {
  label: string;
  passed: boolean;
  detail?: string;
};

const stepItems = [
  {
    step: 1 as const,
    eyebrow: "Étape 1",
    title: "Brief",
    description: "On cadre le contenu et les objectifs.",
  },
  {
    step: 2 as const,
    eyebrow: "Étape 2",
    title: "Plan éditorial",
    description: "On affine le plan avant génération.",
  },
  {
    step: 3 as const,
    eyebrow: "Étape 3",
    title: "Récapitulatif",
    description: "On vérifie le brief avant de créer la page.",
  },
];

const progressPercentage = computed(() =>
  Math.round((currentStep.value / stepItems.length) * 100),
);

const currentStepMeta = computed(
  () =>
    stepItems.find((item) => item.step === currentStep.value) ?? stepItems[0],
);

function getDefaultApproxLength() {
  const primaryTemplateType = templateTypes.value[0];

  if (primaryTemplateType === "DEFINITION") {
    return "300 mots maximum";
  }

  if (primaryTemplateType === "GUIDE") {
    return "Minimum 2 000 mots";
  }

  return "1200 mots";
}

function buildDefaultFields() {
  const suggestion = currentSuggestion.value;

  if (!suggestion) {
    return;
  }

  const normalizedPrimaryKeyword =
    suggestion.primaryKeyword?.trim() ||
    suggestion.keywords[0]?.keyword?.trim() ||
    "";

  subjectExact.value = suggestion.description?.trim() || suggestion.name.trim();
  primaryKeyword.value = normalizedPrimaryKeyword;
  secondaryKeywords.value = suggestion.keywords
    .map((keyword) => keyword.keyword.trim())
    .filter((keyword) => keyword && keyword !== normalizedPrimaryKeyword)
    .join(", ");
  target.value = "Entrepreneuses et e-commerçantes débutantes";
  conversionObjective.value =
    "Créer de la confiance, expliquer et faire passer à l'action";
  approxLength.value = getDefaultApproxLength();
  plan.value = "";
  hasStoredPlan.value = false;
  currentStep.value = 1;
}

watch(
  () => currentSuggestion.value?.id,
  async (groupId) => {
    buildDefaultFields();

    if (!groupId) {
      return;
    }

    try {
      isLoadingStoredPlan.value = true;
      const storedPlan = await getStoredPagePlanFromSuggestionGroup(groupId);

      if (!storedPlan || currentSuggestion.value?.id !== groupId) {
        return;
      }

      subjectExact.value =
        storedPlan.subjectExact?.trim() || subjectExact.value;
      primaryKeyword.value =
        storedPlan.primaryKeyword?.trim() || primaryKeyword.value;
      secondaryKeywords.value = storedPlan.secondaryKeywords?.trim() || "";
      target.value = storedPlan.target?.trim() || target.value;
      conversionObjective.value =
        storedPlan.conversionObjective?.trim() || conversionObjective.value;
      approxLength.value =
        storedPlan.approxLength?.trim() || approxLength.value;
      plan.value = storedPlan.plan ?? "";
      hasStoredPlan.value = Boolean(storedPlan.plan?.trim());
      currentStep.value = storedPlan.plan?.trim() ? 2 : 1;
    } catch (error) {
      console.error("Impossible de charger le plan sauvegardé", error);
    } finally {
      if (currentSuggestion.value?.id === groupId) {
        isLoadingStoredPlan.value = false;
      }
    }
  },
  { immediate: true },
);

function getSuggestionPayload() {
  return {
    pageType: templateTypes.value[0] ?? undefined,
    subjectExact: subjectExact.value,
    primaryKeyword: primaryKeyword.value,
    secondaryKeywords: secondaryKeywords.value,
    target: target.value,
    conversionObjective: conversionObjective.value,
    approxLength: approxLength.value,
  };
}

function normalizeSecondaryKeyword(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function parseSecondaryKeywordsValue(value?: string | null) {
  const seen = new Set<string>();

  return (value ?? "")
    .split(/[,;\n]/g)
    .map((keyword) => normalizeSecondaryKeyword(keyword))
    .filter(Boolean)
    .filter((keyword) => {
      const key = keyword.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    });
}

function updateSecondaryKeywordsFromList(keywords: string[]) {
  secondaryKeywords.value = keywords.join(", ");
}

const secondaryKeywordTags = computed(() =>
  parseSecondaryKeywordsValue(secondaryKeywords.value),
);

function mergeSecondaryKeywords(keywords: string[]) {
  const nextKeywords = [...secondaryKeywordTags.value];
  const seen = new Set(nextKeywords.map((keyword) => keyword.toLowerCase()));
  const normalizedPrimaryKeyword = normalizeSecondaryKeyword(
    primaryKeyword.value,
  ).toLowerCase();

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeSecondaryKeyword(keyword);
    const key = normalizedKeyword.toLowerCase();

    if (
      !normalizedKeyword ||
      key === normalizedPrimaryKeyword ||
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);
    nextKeywords.push(normalizedKeyword);
  }

  updateSecondaryKeywordsFromList(nextKeywords);
}

function handleSecondaryKeywordDraftCommit() {
  if (!secondaryKeywordDraft.value.trim()) {
    return;
  }

  mergeSecondaryKeywords(
    parseSecondaryKeywordsValue(secondaryKeywordDraft.value),
  );
  secondaryKeywordDraft.value = "";
}

function handleSecondaryKeywordDraftKeydown(event: KeyboardEvent) {
  if (
    event.key === "Enter" ||
    event.key === "," ||
    event.key === ";" ||
    event.key === "Tab"
  ) {
    event.preventDefault();
    handleSecondaryKeywordDraftCommit();
  }
}

function removeSecondaryKeyword(keywordToRemove: string) {
  updateSecondaryKeywordsFromList(
    secondaryKeywordTags.value.filter(
      (keyword) => keyword.toLowerCase() !== keywordToRemove.toLowerCase(),
    ),
  );
}

async function handleSuggestSecondaryKeywords() {
  if (!currentSuggestion.value) {
    return;
  }

  try {
    isSuggestingSecondaryKeywords.value = true;
    const response = await suggestSecondaryKeywordsFromSuggestionGroup(
      currentSuggestion.value.id,
      getSuggestionPayload(),
    );
    const previousCount = secondaryKeywordTags.value.length;

    mergeSecondaryKeywords(response.keywords ?? []);

    const addedCount = secondaryKeywordTags.value.length - previousCount;

    showSuccessToast(
      "Suggestions ajoutées",
      addedCount > 0
        ? `${addedCount} mot${addedCount > 1 ? "s-clés" : "-clé"} secondaire${addedCount > 1 ? "s ont été proposés" : " a été proposé"}.`
        : "Aucun nouveau mot-clé secondaire n’a été ajouté.",
    );
  } catch (error) {
    showErrorToast(
      "Impossible de suggérer des mots-clés secondaires",
      error instanceof Error
        ? error.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    isSuggestingSecondaryKeywords.value = false;
  }
}

async function handleGeneratePlan(options?: { force?: boolean }) {
  if (!currentSuggestion.value) {
    return;
  }

  try {
    isSubmittingPlan.value = true;
    const response = await generatePagePlanFromSuggestionGroup(
      currentSuggestion.value.id,
      {
        ...getSuggestionPayload(),
        force: options?.force ?? false,
      },
    );

    plan.value = response.plan;
    hasStoredPlan.value = Boolean(response.plan?.trim());
    currentStep.value = 2;
    showSuccessToast(
      "Plan généré",
      options?.force
        ? "Le plan éditorial a été régénéré et sauvegardé. Tu peux maintenant l’éditer avant de créer la page."
        : "Le plan éditorial a été généré et sauvegardé. Tu peux maintenant l’éditer avant de créer la page.",
    );
  } catch (error) {
    showErrorToast(
      "Impossible de générer le plan",
      error instanceof Error
        ? error.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    isSubmittingPlan.value = false;
  }
}

function handlePrimaryPlanAction() {
  if (hasStoredPlan.value && plan.value.trim()) {
    currentStep.value = 2;
    return;
  }

  void handleGeneratePlan();
}

async function handleSavePlan() {
  if (!currentSuggestion.value) {
    return;
  }

  if (!plan.value.trim()) {
    showErrorToast(
      "Plan vide",
      "Ajoute ou colle un plan avant de le sauvegarder.",
    );
    return;
  }

  try {
    isSavingPlan.value = true;
    const response = await savePagePlanFromSuggestionGroup(
      currentSuggestion.value.id,
      {
        ...getSuggestionPayload(),
        plan: plan.value,
      },
    );

    plan.value = response.plan;
    hasStoredPlan.value = Boolean(response.plan?.trim());
    showSuccessToast(
      "Plan sauvegardé",
      "Les modifications du plan éditorial ont bien été enregistrées.",
    );
  } catch (error) {
    showErrorToast(
      "Impossible de sauvegarder le plan",
      error instanceof Error
        ? error.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    isSavingPlan.value = false;
  }
}

async function handleGenerateArticle() {
  if (!currentSuggestion.value) {
    return;
  }

  if (!plan.value.trim()) {
    showErrorToast(
      "Plan manquant",
      "Génère ou complète d’abord le plan éditorial avant de lancer la génération de l’article.",
    );
    return;
  }

  try {
    isSubmittingArticle.value = true;

    const page = await createPageFromSuggestionGroup(
      currentSuggestion.value.id,
      {
        ...getSuggestionPayload(),
        plan: plan.value,
      },
    );

    showSuccessToast(
      "Page créée",
      `${page.title} a été créée et associée aux mots-clés correspondants.`,
    );

    await navigateTo(`/pages/${page.id}`);
  } catch (error) {
    showErrorToast(
      "Impossible de créer la page",
      error instanceof Error
        ? error.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    isSubmittingArticle.value = false;
  }
}

async function handleGenerateBlankArticle() {
  if (!currentSuggestion.value) {
    return;
  }

  try {
    isSubmittingBlankArticle.value = true;

    const page = await createBlankPageFromSuggestionGroup(
      currentSuggestion.value.id,
      {
        pageType: templateTypes.value[0] ?? null,
      },
    );

    showSuccessToast(
      "Page vide créée",
      `${page.title} a été créée sans IA et associée aux mots-clés correspondants.`,
    );

    await navigateTo(`/pages/${page.id}`);
  } catch (error) {
    showErrorToast(
      "Impossible de créer la page vide",
      error instanceof Error
        ? error.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    isSubmittingBlankArticle.value = false;
  }
}

function extractHeadingLevelsFromPlan(value: string) {
  return value
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .flatMap((line) => {
      const markdownHeading = line.match(/^(#{1,6})\s+/);

      if (markdownHeading) {
        return [markdownHeading[1].length];
      }

      const htmlHeading = line.match(/^<h([1-6])\b/i);

      if (htmlHeading) {
        return [Number(htmlHeading[1])];
      }

      return [];
    });
}

function hasHeadingTreeCoherence(headingLevels: number[]) {
  if (!headingLevels.length) {
    return false;
  }

  let previousLevel = 1;
  let hasSeenH2OrDeeper = false;

  for (const level of headingLevels) {
    if (level - previousLevel > 1) {
      return false;
    }

    if (level === 1 && hasSeenH2OrDeeper) {
      return false;
    }

    if (level >= 2) {
      hasSeenH2OrDeeper = true;
    }

    previousLevel = level;
  }

  return true;
}

function hasH1AfterH2(headingLevels: number[]) {
  let hasSeenH2OrDeeper = false;

  for (const level of headingLevels) {
    if (level >= 2) {
      hasSeenH2OrDeeper = true;
      continue;
    }

    if (level === 1 && hasSeenH2OrDeeper) {
      return true;
    }
  }

  return false;
}

const planHeadingLevels = computed(() =>
  extractHeadingLevelsFromPlan(plan.value),
);

const planHeadingChecklistItems = computed<HeadingChecklistItem[]>(() => {
  const headingLevels = planHeadingLevels.value;
  const hasHeadings = headingLevels.length > 0;
  const headingTreeCoherent = hasHeadingTreeCoherence(headingLevels);
  const h1AfterH2 = hasH1AfterH2(headingLevels);

  return [
    {
      label: "Les Hn ont une bonne arborescence",
      passed: headingTreeCoherent,
      detail: hasHeadings
        ? `Titres détectés: ${headingLevels.join(" → ")}`
        : "Ajoute des titres au plan pour vérifier sa structure.",
    },
    {
      label: "Aucun H1 n'apparaît après un H2",
      passed: !h1AfterH2,
      detail: h1AfterH2
        ? "Un H1 a été détecté après un H2 dans l'ordre du contenu."
        : hasHeadings
          ? "L'ordre des titres reste cohérent."
          : "Ajoute des titres au plan pour vérifier l'ordre du contenu.",
    },
  ];
});
</script>

<template>
  <section class="space-y-6">
    <UBreadcrumb
      :items="[
        { label: 'Rédaction' },
        { label: 'Pages', to: '/suggestions' },
        { label: 'Créer une page' },
      ]"
    />

    <!-- <header class="space-y-2">
      <h1 class="text-2xl font-semibold text-slate-900">
        Créer une page depuis une suggestion
      </h1>
      <p class="max-w-3xl text-sm leading-6 text-slate-500">
        Génère d’abord un plan éditorial, édite-le, puis lance la génération
        finale de l’article à partir de ce plan.
      </p>
    </header> -->

    <div
      v-if="suggestionsStatus === 'pending'"
      class="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm"
    >
      Chargement des suggestions...
    </div>

    <div
      v-else-if="!currentSuggestion"
      class="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-slate-900">
          Choisis d’abord une suggestion
        </h2>
        <p class="text-sm leading-6 text-slate-500">
          Cette page s’ouvre normalement depuis le bouton “Créer la page” d’une
          suggestion.
        </p>
      </div>

      <div v-if="suggestions?.length" class="space-y-3">
        <NuxtLink
          v-for="suggestion in suggestions"
          :key="suggestion.id"
          :to="`/pages/add?groupId=${encodeURIComponent(suggestion.id)}`"
          class="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-white"
        >
          <span class="block font-medium text-slate-900">
            {{ suggestion.name }}
          </span>
          <span class="mt-1 block text-xs text-slate-500">
            {{
              suggestion.description ||
              suggestion.primaryKeyword ||
              "Suggestion éditoriale"
            }}
          </span>
        </NuxtLink>
      </div>
    </div>

    <div v-else class="space-y-6">
      <section
        class="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm"
      >
        <header
          class="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(125,211,252,0.2),_transparent_35%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6"
        >
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="space-y-3">
              <div class="space-y-1">
                <p
                  class="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700"
                >
                  Création guidée
                </p>
                <h2 class="text-2xl font-semibold text-slate-950">
                  {{ currentStepMeta.title }}
                </h2>
                <p class="max-w-2xl text-sm leading-6 text-slate-600">
                  {{ currentStepMeta.description }}
                </p>
              </div>

              <div class="max-w-xl space-y-2">
                <div
                  class="flex items-center justify-between text-xs font-medium text-slate-500"
                >
                  <span>Progression</span>
                  <span>{{ progressPercentage }}%</span>
                </div>
                <div class="h-2 rounded-full bg-slate-200">
                  <div
                    class="h-full rounded-full bg-sky-500 transition-all duration-300"
                    :style="{ width: `${progressPercentage}%` }"
                  />
                </div>
              </div>
            </div>

            <div v-if="templateTypes.length" class="flex flex-wrap gap-2">
              <UBadge
                v-for="template in templateTypes"
                :key="template"
                color="info"
                variant="soft"
              >
                {{ pageTypeLabels[template] }}
              </UBadge>
            </div>
          </div>

          <div class="mt-6 grid gap-3 md:grid-cols-3">
            <button
              v-for="item in stepItems"
              :key="item.step"
              type="button"
              class="rounded-2xl border px-4 py-4 text-left transition"
              :class="
                currentStep === item.step
                  ? 'border-sky-300 bg-sky-50 shadow-sm'
                  : 'border-slate-200 bg-white/80 hover:border-slate-300'
              "
              @click="
                item.step === 1
                  ? (currentStep = 1)
                  : item.step === 2 && plan.trim()
                    ? (currentStep = 2)
                    : item.step === 3 && plan.trim()
                      ? (currentStep = 3)
                      : null
              "
            >
              <div class="flex items-start gap-3">
                <div
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                  :class="
                    currentStep === item.step
                      ? 'bg-sky-500 text-white'
                      : 'bg-slate-100 text-slate-600'
                  "
                >
                  {{ item.step }}
                </div>
                <div class="space-y-1">
                  <p
                    class="text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {{ item.eyebrow }}
                  </p>
                  <p class="font-medium text-slate-900">
                    {{ item.title }}
                  </p>
                  <p class="text-sm text-slate-500">
                    {{ item.description }}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </header>

        <div class="space-y-6 p-6">
          <div class="space-y-6">
            <section
              v-if="currentStep === 1"
              class="rounded-3xl border border-slate-200 bg-white p-6"
            >
              <div class="mb-6 space-y-1">
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Étape 1
                </p>
                <h3 class="text-xl font-semibold text-slate-900">
                  Préparer le brief
                </h3>
                <p class="text-sm text-slate-500">
                  Pose le cadre éditorial avant de générer le plan.
                </p>
              </div>

              <div
                class="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"
              >
                <div class="space-y-6">
                  <div
                    class="rounded-3xl border border-slate-200 bg-slate-50/70 p-5"
                  >
                    <div class="mb-4 space-y-1">
                      <h4
                        class="text-sm font-semibold uppercase tracking-wide text-slate-700"
                      >
                        Angle du contenu
                      </h4>
                      <p class="text-sm text-slate-500">
                        Définis précisément ce que la page doit couvrir.
                      </p>
                    </div>

                    <label class="block space-y-2">
                      <span class="text-sm font-medium text-slate-700">
                        Sujet exact
                      </span>
                      <UTextarea
                        v-model="subjectExact"
                        :rows="5"
                        autoresize
                        class="w-full"
                        placeholder="Sujet exact de l’article"
                      />
                    </label>
                  </div>

                  <div
                    class="rounded-3xl border border-slate-200 bg-slate-50/70 p-5"
                  >
                    <div class="mb-4 space-y-1">
                      <h4
                        class="text-sm font-semibold uppercase tracking-wide text-slate-700"
                      >
                        SEO
                      </h4>
                      <p class="text-sm text-slate-500">
                        Vérifie le mot-clé principal et les variantes à couvrir.
                      </p>
                    </div>

                    <div class="space-y-4">
                      <label class="block space-y-2">
                        <span class="text-sm font-medium text-slate-700">
                          Mot-clé principal
                        </span>
                        <UInput
                          v-model="primaryKeyword"
                          class="w-full"
                          placeholder="Mot-clé principal"
                        />
                      </label>

                      <label class="block space-y-2">
                        <span class="text-sm font-medium text-slate-700">
                          Mots-clés secondaires
                        </span>
                        <div
                          class="space-y-3 rounded-2xl border border-slate-200 bg-white p-3"
                        >
                          <div
                            class="flex flex-wrap gap-2"
                            v-if="secondaryKeywordTags.length"
                          >
                            <span
                              v-for="keyword in secondaryKeywordTags"
                              :key="keyword"
                              class="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-900"
                            >
                              <span>{{ keyword }}</span>
                              <button
                                type="button"
                                class="inline-flex h-5 w-5 items-center justify-center rounded-full text-sky-700 transition hover:bg-sky-200"
                                :aria-label="`Retirer ${keyword}`"
                                @click="removeSecondaryKeyword(keyword)"
                              >
                                <UIcon name="i-lucide-x" class="h-3.5 w-3.5" />
                              </button>
                            </span>
                          </div>

                          <p v-else class="text-sm text-slate-500">
                            Aucun mot-clé secondaire pour l’instant.
                          </p>

                          <div class="flex flex-col gap-2 sm:flex-row">
                            <UInput
                              v-model="secondaryKeywordDraft"
                              class="w-full"
                              placeholder="Ajoute un mot-clé puis valide avec Entrée, , ou ;"
                              @keydown="handleSecondaryKeywordDraftKeydown"
                              @blur="handleSecondaryKeywordDraftCommit"
                            />
                            <UButton
                              color="neutral"
                              variant="soft"
                              icon="i-lucide-plus"
                              :disabled="!secondaryKeywordDraft.trim()"
                              @click="handleSecondaryKeywordDraftCommit"
                            >
                              Ajouter
                            </UButton>
                            <UButton
                              color="primary"
                              variant="soft"
                              icon="i-lucide-sparkles"
                              :loading="isSuggestingSecondaryKeywords"
                              :disabled="!currentSuggestion"
                              class="whitespace-nowrap"
                              @click="handleSuggestSecondaryKeywords"
                            >
                              Suggestions IA
                            </UButton>
                          </div>

                          <p class="text-xs text-slate-500">
                            Le champ est conservé en texte et accepte `,`, `;`
                            ou un retour à la ligne.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <div class="space-y-6">
                  <div
                    class="rounded-3xl border border-slate-200 bg-slate-50/70 p-5"
                  >
                    <div class="mb-4 space-y-1">
                      <h4
                        class="text-sm font-semibold uppercase tracking-wide text-slate-700"
                      >
                        Audience
                      </h4>
                      <p class="text-sm text-slate-500">
                        Pour qui écrit-on, et avec quel niveau de profondeur ?
                      </p>
                    </div>

                    <div class="space-y-4">
                      <label class="block space-y-2">
                        <span class="text-sm font-medium text-slate-700">
                          Cible
                        </span>
                        <UInput
                          v-model="target"
                          class="w-full"
                          placeholder="Entrepreneuses et e-commerçantes débutantes"
                        />
                      </label>

                      <label class="block space-y-2">
                        <span class="text-sm font-medium text-slate-700">
                          Longueur approximative
                        </span>
                        <UInput
                          v-model="approxLength"
                          class="w-full"
                          placeholder="1200 mots"
                        />
                      </label>
                    </div>
                  </div>

                  <div
                    class="rounded-3xl border border-slate-200 bg-slate-50/70 p-5"
                  >
                    <div class="mb-4 space-y-1">
                      <h4
                        class="text-sm font-semibold uppercase tracking-wide text-slate-700"
                      >
                        Conversion
                      </h4>
                      <p class="text-sm text-slate-500">
                        Clarifie ce que cette page doit provoquer chez la
                        lectrice.
                      </p>
                    </div>

                    <label class="block space-y-2">
                      <span class="text-sm font-medium text-slate-700">
                        Objectif de conversion
                      </span>
                      <UTextarea
                        v-model="conversionObjective"
                        :rows="6"
                        autoresize
                        class="w-full"
                        placeholder="Créer de la confiance, expliquer et faire passer à l'action"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div
                class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"
              >
                <p class="text-sm text-slate-500">
                  Quand tout est prêt, on génère le plan éditorial.
                </p>

                <div class="flex items-center gap-3">
                  <span
                    v-if="isLoadingStoredPlan"
                    class="text-xs font-medium text-slate-400"
                  >
                    Chargement du plan sauvegardé...
                  </span>

                  <UButton
                    v-if="hasStoredPlan && plan.trim()"
                    color="neutral"
                    variant="soft"
                    icon="i-lucide-save"
                    :loading="isSavingPlan"
                    :disabled="isLoadingStoredPlan || isSubmittingPlan"
                    @click="handleSavePlan"
                  >
                    Sauvegarder les infos
                  </UButton>

                  <UButton
                    color="primary"
                    variant="solid"
                    :icon="
                      hasStoredPlan && plan.trim()
                        ? 'i-lucide-arrow-right'
                        : 'i-lucide-sparkles'
                    "
                    :loading="isSubmittingPlan || isLoadingStoredPlan"
                    :disabled="isLoadingStoredPlan"
                    @click="handlePrimaryPlanAction"
                    >
                      {{
                        hasStoredPlan && plan.trim()
                          ? "Voir le plan"
                          : "Générer le plan"
                      }}
                  </UButton>

                  <UButton
                    color="neutral"
                    variant="soft"
                    icon="i-lucide-file-plus"
                    :loading="isSubmittingBlankArticle"
                    @click="handleGenerateBlankArticle"
                  >
                    Créer une page vide
                  </UButton>
                </div>
              </div>
            </section>

            <section
              v-else-if="currentStep === 2"
              class="rounded-3xl border border-slate-200 bg-white p-6"
            >
              <div class="mb-6 space-y-1">
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Étape 2
                </p>
                <h3 class="text-xl font-semibold text-slate-900">
                  Affiner le plan éditorial
                </h3>
                <p class="text-sm text-slate-500">
                  Édite librement le plan généré avant de lancer la rédaction
                  finale.
                </p>
              </div>

              <UTextarea
                v-model="plan"
                :rows="18"
                autoresize
                class="w-full"
                placeholder="Le plan généré apparaîtra ici..."
              />

              <div
                class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"
              >
                <UButton
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-arrow-left"
                  @click="currentStep = 1"
                >
                  Revenir au brief
                </UButton>

                <div class="flex flex-wrap items-center gap-3">
                  <UButton
                    color="neutral"
                    variant="soft"
                    icon="i-lucide-save"
                    :loading="isSavingPlan"
                    @click="handleSavePlan"
                  >
                    Sauvegarder le plan
                  </UButton>

                  <UButton
                    color="neutral"
                    variant="soft"
                    icon="i-lucide-rotate-ccw"
                    :loading="isSubmittingPlan"
                    @click="handleGeneratePlan({ force: true })"
                  >
                    Régénérer le plan
                  </UButton>

                  <UButton
                    color="primary"
                    variant="solid"
                    icon="i-lucide-arrow-right"
                    @click="currentStep = 3"
                  >
                    Voir le récapitulatif
                  </UButton>
                </div>
              </div>
            </section>

            <section
              v-else
              class="rounded-3xl border border-sky-200 bg-sky-50 p-5 shadow-sm"
            >
              <div class="space-y-1">
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Étape 3
                </p>
                <h3 class="text-lg font-semibold text-slate-900">
                  Vérification finale du brief
                </h3>
                <p class="text-sm text-slate-500">
                  Vérifie une dernière fois les informations avant de créer la
                  page.
                </p>
              </div>

              <div
                class="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div class="space-y-1">
                  <p
                    class="text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Checklist Hn
                  </p>
                  <h4 class="text-base font-semibold text-slate-900">
                    Arborescence des titres
                  </h4>
                  <p class="text-sm text-slate-500">
                    On vérifie la structure des titres dans l'ordre du plan
                    avant de créer la page.
                  </p>
                </div>

                <div class="mt-4 space-y-2">
                  <div
                    v-for="item in planHeadingChecklistItems"
                    :key="item.label"
                    class="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                  >
                    <div
                      class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      :class="
                        item.passed
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      "
                    >
                      {{ item.passed ? "✓" : "!" }}
                    </div>
                    <div class="min-w-0">
                      <p
                        class="text-sm"
                        :class="
                          item.passed ? 'text-slate-800' : 'text-slate-700'
                        "
                      >
                        {{ item.label }}
                      </p>
                      <p v-if="item.detail" class="text-xs text-slate-500">
                        {{ item.detail }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <dl class="mt-4 grid gap-4 text-sm md:grid-cols-2">
                <div class="space-y-1">
                  <dt class="font-medium text-slate-700">Cluster</dt>
                  <dd class="text-slate-600">
                    {{ currentSuggestionCluster?.name || "-" }}
                  </dd>
                </div>

                <div class="space-y-1">
                  <dt class="font-medium text-slate-700">Mot-clé du cluster</dt>
                  <dd class="text-slate-600">
                    {{ currentSuggestionClusterPrimaryKeyword || "-" }}
                  </dd>
                </div>

                <div class="space-y-1">
                  <dt class="font-medium text-slate-700">
                    Page ou groupe pilier
                  </dt>
                  <dd class="text-slate-600">
                    {{ currentSuggestionPillarLabel || "-" }}
                  </dd>
                </div>

                <div class="space-y-1">
                  <dt class="font-medium text-slate-700">Mot-clé du pilier</dt>
                  <dd class="text-slate-600">
                    {{ currentSuggestionPillarSecondaryLabel || "-" }}
                  </dd>
                </div>

                <div class="space-y-1">
                  <dt class="font-medium text-slate-700">Sujet exact</dt>
                  <dd class="text-slate-600">
                    {{ subjectExact || "-" }}
                  </dd>
                </div>

                <div class="space-y-1">
                  <dt class="font-medium text-slate-700">Mot-clé principal</dt>
                  <dd class="text-slate-600">
                    {{ primaryKeyword || "-" }}
                  </dd>
                </div>

                <div class="space-y-1">
                  <dt class="font-medium text-slate-700">Cible</dt>
                  <dd class="text-slate-600">
                    {{ target || "-" }}
                  </dd>
                </div>

                <div class="space-y-1">
                  <dt class="font-medium text-slate-700">
                    Objectif de conversion
                  </dt>
                  <dd class="text-slate-600">
                    {{ conversionObjective || "-" }}
                  </dd>
                </div>

                <div class="space-y-1">
                  <dt class="font-medium text-slate-700">
                    Longueur approximative
                  </dt>
                  <dd class="text-slate-600">
                    {{ approxLength || "-" }}
                  </dd>
                </div>

                <div class="space-y-1">
                  <dt class="font-medium text-slate-700">Plan</dt>
                  <dd class="text-slate-600">
                    {{
                      plan.trim()
                        ? "Plan prêt à être utilisé"
                        : "Aucun plan généré"
                    }}
                  </dd>
                </div>
              </dl>

              <div
                class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-sky-200 pt-5"
              >
                <UButton
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-arrow-left"
                  @click="currentStep = 2"
                >
                  Revenir au plan
                </UButton>

                <UButton
                  color="primary"
                  variant="solid"
                  icon="i-lucide-file-plus-2"
                  :loading="isSubmittingArticle"
                  @click="handleGenerateArticle"
                >
                  Valider et générer la page
                </UButton>

                <UButton
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-file-plus"
                  :loading="isSubmittingBlankArticle"
                  @click="handleGenerateBlankArticle"
                >
                  Créer une page vide
                </UButton>
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>
