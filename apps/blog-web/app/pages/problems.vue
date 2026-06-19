<script setup lang="ts">
import {
  customerProblemIntentOptions,
  customerProblemSourceOptions,
} from "~/constants/customer-problems";
import type {
  CustomerProblem,
  UpsertCustomerProblemInput,
} from "~/types/customer-problems";
import { normalizeSearchText } from "~/utils/search-normalizer";

const { useSeoClustersList } = useSeoClusters();
const { createCustomerProblemCategory, useCustomerProblemCategoriesList } =
  useCustomerProblemCategories();
const {
  createCustomerProblem,
  deleteCustomerProblem,
  extractCustomerProblemKeywords,
  updateCustomerProblem,
  useCustomerProblemsList,
} = useCustomerProblems();

const { data: customerProblems, refresh: refreshCustomerProblems } =
  await useCustomerProblemsList();
const { data: clusters } = await useSeoClustersList();
const { data: categories, refresh: refreshCategories } =
  await useCustomerProblemCategoriesList();

const form = reactive<UpsertCustomerProblemInput>({
  title: "",
  description: "",
  source: "CUSTOMER_INTERVIEW",
  intention: null,
  categoryId: null,
  clusterIds: [],
});

const search = ref("");
const editingProblemId = ref<string | null>(null);
const isSaving = ref(false);
const isImporting = ref(false);
const deletingProblemId = ref<string | null>(null);
const extractingProblemId = ref<string | null>(null);
const feedbackMessage = ref("");
const isDropZoneActive = ref(false);
const dragDepth = ref(0);
const importSummaryMessage = ref("");
const importProgress = reactive({
  total: 0,
  processed: 0,
  createdProblems: 0,
  updatedProblems: 0,
  createdCategories: 0,
  skippedProblems: 0,
  currentTitle: "",
});

const isEditing = computed(() => !!editingProblemId.value);
const isBusy = computed(() => isSaving.value || isImporting.value);
const isImportPanelVisible = computed(
  () => isImporting.value || !!importSummaryMessage.value,
);
const importProgressPercent = computed(() =>
  importProgress.total
    ? Math.round((importProgress.processed / importProgress.total) * 100)
    : 0,
);

const breadcrumbItems = [
  {
    label: "Accueil",
    to: "/",
  },
  {
    label: "Problèmes",
  },
];

const filteredProblems = computed(() => {
  const query = normalizeSearchText(search.value);

  if (!query) {
    return customerProblems.value ?? [];
  }

  return (customerProblems.value ?? []).filter((problem) =>
    [
      problem.title,
      problem.description,
      problem.source,
      problem.intention,
      problem.category?.title,
      ...problem.clusters.map((cluster) => cluster.name),
      ...problem.clusters.map((cluster) => cluster.primaryKeyword),
    ]
      .filter((value): value is string => typeof value === "string")
      .some((value) => normalizeSearchText(value).includes(query)),
  );
});

const sortedClusters = computed(() =>
  [...(clusters.value ?? [])].sort((left, right) =>
    left.name.localeCompare(right.name),
  ),
);

const sortedCategories = computed(() =>
  [...(categories.value ?? [])].sort((left, right) =>
    left.title.localeCompare(right.title),
  ),
);

function findCategoryById(categoryId?: string | null) {
  if (!categoryId) {
    return null;
  }

  return sortedCategories.value.find((category) => category.id === categoryId) ?? null;
}

function resetForm() {
  form.title = "";
  form.description = "";
  form.source = "CUSTOMER_INTERVIEW";
  form.intention = null;
  form.categoryId = null;
  form.clusterIds = [];
  editingProblemId.value = null;
}

function startEditing(problem: CustomerProblem) {
  form.title = problem.title;
  form.description = problem.description ?? "";
  form.source = problem.source;
  form.intention = problem.intention ?? null;
  form.categoryId = problem.category?.id ?? null;
  form.clusterIds = problem.clusters.map((cluster) => cluster.id);
  editingProblemId.value = problem.id;
  feedbackMessage.value = "";
}

function toggleCluster(clusterId: string) {
  const clusterIds = new Set(form.clusterIds ?? []);

  if (clusterIds.has(clusterId)) {
    clusterIds.delete(clusterId);
  } else {
    clusterIds.add(clusterId);
  }

  form.clusterIds = [...clusterIds];
}

function applyCategoryClusters(categoryId?: string | null) {
  const category = findCategoryById(categoryId);

  if (!category) {
    return;
  }

  form.clusterIds = (category.clusters ?? []).map((cluster) => cluster.id);
}

function normalizeCsvValue(value: string) {
  return value
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .trim();
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let currentValue = "";
  let isInsideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (isInsideQuotes && nextChar === '"') {
        currentValue += '"';
        index += 1;
      } else {
        isInsideQuotes = !isInsideQuotes;
      }
      continue;
    }

    if (char === "," && !isInsideQuotes) {
      values.push(currentValue);
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  values.push(currentValue);

  return values.map(normalizeCsvValue);
}

function parseCustomerProblemsCsv(rawCsv: string) {
  const lines = rawCsv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("Le fichier CSV est vide.");
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const expectedHeaders = [
    "category",
    "title",
    "description",
    "intent",
    "source",
  ];

  if (
    headers.length !== expectedHeaders.length ||
    !expectedHeaders.every((header, index) => headers[index] === header)
  ) {
    throw new Error(
      "Le CSV doit avoir exactement les colonnes : category,title,description,intent,source",
    );
  }

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);

    if (values.length !== expectedHeaders.length) {
      throw new Error(`La ligne ${index + 2} ne contient pas 5 colonnes.`);
    }

    return {
      category: values[0] || "",
      title: values[1] || "",
      description: values[2] || "",
      intent: values[3] || "",
      source: values[4] || "",
    };
  });
}

function normalizeProblemSource(value: string) {
  const normalizedValue = value.trim().toUpperCase();

  return (
    customerProblemSourceOptions.find(
      (option) =>
        option.value === normalizedValue ||
        option.label.toUpperCase() === normalizedValue,
    )?.value ?? null
  );
}

function normalizeSearchIntent(value: string) {
  const normalizedValue = value.trim().toUpperCase();

  return (
    customerProblemIntentOptions.find(
      (option) =>
        option.value === normalizedValue ||
        option.label.toUpperCase() === normalizedValue,
    )?.value ?? null
  );
}

function getProblemDedupKey(input: {
  title: string;
  categoryTitle?: string | null;
}) {
  return [
    input.title.trim().toLowerCase(),
    input.categoryTitle?.trim().toLowerCase() || "",
  ].join("::");
}

function handleDropZoneDragEnter() {
  dragDepth.value += 1;
  isDropZoneActive.value = true;
}

function handleDropZoneDragLeave() {
  dragDepth.value = Math.max(0, dragDepth.value - 1);

  if (!dragDepth.value) {
    isDropZoneActive.value = false;
  }
}

function resetDropZoneState() {
  dragDepth.value = 0;
  isDropZoneActive.value = false;
}

function resetImportProgress() {
  importProgress.total = 0;
  importProgress.processed = 0;
  importProgress.createdProblems = 0;
  importProgress.updatedProblems = 0;
  importProgress.createdCategories = 0;
  importProgress.skippedProblems = 0;
  importProgress.currentTitle = "";
}

function closeImportPanel() {
  importSummaryMessage.value = "";
  resetImportProgress();
}

async function importCustomerProblemsFromCsv(file: File) {
  if (isBusy.value) {
    return;
  }

  isImporting.value = true;
  feedbackMessage.value = "";
  importSummaryMessage.value = "";
  resetImportProgress();

  try {
    const rawCsv = await file.text();
    const rows = parseCustomerProblemsCsv(rawCsv);
    importProgress.total = rows.length;

    const existingProblems = new Set(
      (customerProblems.value ?? []).map((problem) =>
        getProblemDedupKey({
          title: problem.title,
          categoryTitle: problem.category?.title,
        }),
      ),
    );
    const existingProblemsByTitle = new Map<string, CustomerProblem[]>();
    for (const problem of customerProblems.value ?? []) {
      const titleKey = problem.title.trim().toLowerCase();
      const currentProblems = existingProblemsByTitle.get(titleKey) ?? [];
      currentProblems.push(problem);
      existingProblemsByTitle.set(titleKey, currentProblems);
    }
    const categoryMap = new Map(
      (categories.value ?? []).map((category) => [
        category.title.trim().toLowerCase(),
        category,
      ]),
    );

    let createdCategoriesCount = 0;
    let createdProblemsCount = 0;
    let updatedProblemsCount = 0;
    let skippedProblemsCount = 0;

    for (const row of rows) {
      const title = row.title.trim();
      importProgress.currentTitle = title || "Ligne sans titre";

      if (!title) {
        skippedProblemsCount += 1;
        importProgress.skippedProblems = skippedProblemsCount;
        importProgress.processed += 1;
        continue;
      }

      const source = normalizeProblemSource(row.source);

      if (!source) {
        throw new Error(`Source invalide pour « ${title} » : ${row.source}`);
      }

      const categoryTitle = row.category.trim();
      let categoryId: string | null = null;

      if (categoryTitle) {
        const categoryKey = categoryTitle.toLowerCase();
        let category = categoryMap.get(categoryKey);

        if (!category) {
          category = await createCustomerProblemCategory({
            title: categoryTitle,
            clusterIds: [],
          });
          categoryMap.set(categoryKey, category);
          createdCategoriesCount += 1;
          importProgress.createdCategories = createdCategoriesCount;
        }

        categoryId = category.id;
      }

      const dedupKey = getProblemDedupKey({
        title,
        categoryTitle: categoryTitle || null,
      });

      const matchedCategory = categoryId
        ? categoryMap.get(categoryTitle.toLowerCase()) ?? null
        : null;
      const inheritedClusterIds =
        matchedCategory?.clusters?.map((cluster) => cluster.id) ?? [];
      const matchingProblems = existingProblemsByTitle.get(title.toLowerCase()) ?? [];
      const exactExistingProblem = matchingProblems.find(
        (problem) =>
          getProblemDedupKey({
            title: problem.title,
            categoryTitle: problem.category?.title,
          }) === dedupKey,
      );
      const updatableExistingProblem =
        exactExistingProblem ??
        matchingProblems.find(
          (problem) =>
            !problem.category?.id &&
            Boolean(categoryId),
        ) ??
        matchingProblems.find(
          (problem) =>
            !problem.clusters.length &&
            inheritedClusterIds.length > 0,
        );

      if (updatableExistingProblem) {
        const mergedClusterIds = Array.from(
          new Set([
            ...updatableExistingProblem.clusters.map((cluster) => cluster.id),
            ...inheritedClusterIds,
          ]),
        );
        const shouldUpdateCategory =
          !updatableExistingProblem.category?.id && Boolean(categoryId);
        const shouldUpdateClusters =
          !updatableExistingProblem.clusters.length && mergedClusterIds.length > 0;

        if (shouldUpdateCategory || shouldUpdateClusters) {
          const updatedProblem = await updateCustomerProblem(updatableExistingProblem.id, {
            ...(shouldUpdateCategory ? { categoryId } : {}),
            ...(shouldUpdateClusters ? { clusterIds: mergedClusterIds } : {}),
          });

          existingProblemsByTitle.set(
            title.toLowerCase(),
            matchingProblems.map((problem) =>
              problem.id === updatedProblem.id ? updatedProblem : problem,
            ),
          );
          updatedProblemsCount += 1;
          importProgress.updatedProblems = updatedProblemsCount;
        } else {
          skippedProblemsCount += 1;
          importProgress.skippedProblems = skippedProblemsCount;
        }
        importProgress.processed += 1;
        existingProblems.add(dedupKey);
        continue;
      }

      if (existingProblems.has(dedupKey)) {
        skippedProblemsCount += 1;
        importProgress.skippedProblems = skippedProblemsCount;
        importProgress.processed += 1;
        continue;
      }

      const intention = row.intent.trim()
        ? normalizeSearchIntent(row.intent)
        : null;

      if (row.intent.trim() && !intention) {
        throw new Error(`Intent invalide pour « ${title} » : ${row.intent}`);
      }

      const createdProblem = await createCustomerProblem({
        title,
        description: row.description.trim() || null,
        source,
        intention,
        categoryId,
        clusterIds: inheritedClusterIds,
      });

      existingProblems.add(dedupKey);
      existingProblemsByTitle.set(title.toLowerCase(), [
        ...(existingProblemsByTitle.get(title.toLowerCase()) ?? []),
        createdProblem,
      ]);
      createdProblemsCount += 1;
      importProgress.createdProblems = createdProblemsCount;
      importProgress.processed += 1;
    }

    await Promise.all([refreshCustomerProblems(), refreshCategories()]);

    const messageParts = [`${createdProblemsCount} problème(s) importé(s)`];

    if (createdCategoriesCount) {
      messageParts.push(`${createdCategoriesCount} catégorie(s) créée(s)`);
    }

    if (updatedProblemsCount) {
      messageParts.push(`${updatedProblemsCount} problème(s) mis à jour`);
    }

    if (skippedProblemsCount) {
      messageParts.push(`${skippedProblemsCount} doublon(s) ignoré(s)`);
    }

    importSummaryMessage.value = `${messageParts.join(" • ")}.`;
  } finally {
    isImporting.value = false;
    importProgress.currentTitle = "";
    resetDropZoneState();
  }
}

async function handleDropZoneDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0];

  resetDropZoneState();

  if (!file) {
    return;
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    feedbackMessage.value = "Dépose un fichier CSV au format attendu.";
    return;
  }

  await importCustomerProblemsFromCsv(file);
}

async function submitForm() {
  if (isBusy.value || !form.title.trim()) {
    return;
  }

  isSaving.value = true;
  feedbackMessage.value = "";

  const payload: UpsertCustomerProblemInput = {
    title: form.title.trim(),
    description: form.description?.trim() || null,
    source: form.source,
    intention: form.intention || null,
    categoryId: form.categoryId || null,
    clusterIds: form.clusterIds ?? [],
  };

  try {
    if (editingProblemId.value) {
      await updateCustomerProblem(editingProblemId.value, payload);
      feedbackMessage.value = "Problème client mis à jour.";
    } else {
      await createCustomerProblem(payload);
      feedbackMessage.value = "Problème client créé.";
    }

    await refreshCustomerProblems();
    resetForm();
  } finally {
    isSaving.value = false;
  }
}

async function removeProblem(problem: CustomerProblem) {
  if (deletingProblemId.value) {
    return;
  }

  if (!window.confirm(`Supprimer le problème client « ${problem.title} » ?`)) {
    return;
  }

  deletingProblemId.value = problem.id;
  feedbackMessage.value = "";

  try {
    await deleteCustomerProblem(problem.id);
    await refreshCustomerProblems();

    if (editingProblemId.value === problem.id) {
      resetForm();
    }

    feedbackMessage.value = "Problème client supprimé.";
  } finally {
    deletingProblemId.value = null;
  }
}

async function runKeywordExtraction(problem: CustomerProblem) {
  if (extractingProblemId.value) {
    return;
  }

  extractingProblemId.value = problem.id;
  feedbackMessage.value = "";

  try {
    await extractCustomerProblemKeywords(problem.id);
    await refreshCustomerProblems();
    feedbackMessage.value = "Mots-clés extraits depuis le problème client.";
  } finally {
    extractingProblemId.value = null;
  }
}

watch(
  () => form.categoryId,
  (nextCategoryId, previousCategoryId) => {
    if (!nextCategoryId || nextCategoryId === previousCategoryId) {
      return;
    }

    applyCategoryClusters(nextCategoryId);
  },
);
</script>

<template>
  <section class="space-y-6">
    <UBreadcrumb :items="breadcrumbItems" class="text-slate-500" />

    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-slate-900">Problèmes clients</h1>
      <p class="text-sm text-slate-500">
        Centralise les douleurs clients, leurs sources et les clusters SEO à
        adresser.
      </p>
    </header>

    <ProblemsCustomerProblemImportPanel
      v-if="isImportPanelVisible"
      :is-importing="isImporting"
      :summary-message="importSummaryMessage"
      :progress="importProgress"
      :progress-percent="importProgressPercent"
      @close="closeImportPanel"
    />

    <div class="overflow-x-scroll">
      <div class="grid w-[150%] gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:grid-cols-3! ">
        <section
          class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div
            class="transition-colors"
            :class="isDropZoneActive ? 'rounded-2xl bg-sky-50' : ''"
            @dragenter.prevent="handleDropZoneDragEnter"
            @dragover.prevent="isDropZoneActive = true"
            @dragleave.prevent="handleDropZoneDragLeave"
            @drop.prevent="handleDropZoneDrop"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-1">
                <h2 class="text-lg font-semibold text-slate-900">
                  {{ isEditing ? "Modifier un problème" : "Ajouter un problème" }}
                </h2>
                <p class="text-sm text-slate-500">
                  Associe un problème client à un ou plusieurs clusters pour
                  guider l’édito.
                </p>
              </div>

              <UButton
                v-if="isEditing"
                color="neutral"
                variant="soft"
                icon="i-lucide-rotate-ccw"
                @click="resetForm"
              >
                Annuler
              </UButton>
            </div>

            <p v-if="feedbackMessage" class="mt-4 text-sm text-slate-500">
              {{ feedbackMessage }}
            </p>

            <div
              v-if="isDropZoneActive"
              class="mt-5 flex min-h-80 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50 px-6 py-10 text-center"
            >
              <UIcon name="i-lucide-file-down" class="h-10 w-10 text-sky-600" />
              <p class="mt-4 text-base font-semibold text-sky-900">
                Dépose ton fichier CSV ici
              </p>
              <p class="mt-2 max-w-md text-sm leading-6 text-sky-700">
                Format attendu :
                <code class="rounded bg-white/70 px-1.5 py-0.5 text-sky-900">
                  category,title,description,intent,source
                </code>
              </p>
            </div>

            <div v-else class="mt-5 space-y-4">
              <label class="block space-y-2">
                <span class="text-sm font-medium text-slate-700">
                  Titre <span class="text-red-500">*</span>
                </span>
                <input
                  v-model="form.title"
                  type="text"
                  placeholder="Ex: Je ne sais pas quel thème Shopify choisir"
                  class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>

              <label class="block space-y-2">
                <span class="text-sm font-medium text-slate-700"
                  >Description</span
                >
                <textarea
                  v-model="form.description"
                  rows="5"
                  placeholder="Contexte, verbatim, objections, besoin réel..."
                  class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>

              <div class="grid gap-4 md:grid-cols-2">
                <label class="block space-y-2">
                  <span class="text-sm font-medium text-slate-700">
                    Source <span class="text-red-500">*</span>
                  </span>
                  <select
                    v-model="form.source"
                    class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  >
                    <option
                      v-for="option in customerProblemSourceOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                </label>

                <label class="block space-y-2">
                  <span class="text-sm font-medium text-slate-700"
                    >Intention</span
                  >
                  <select
                    v-model="form.intention"
                    class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  >
                    <option :value="null">Non renseignée</option>
                    <option
                      v-for="option in customerProblemIntentOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                </label>
              </div>

              <label class="block space-y-2">
                <span class="text-sm font-medium text-slate-700">Catégorie</span>
                <select
                  v-model="form.categoryId"
                  class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                >
                  <option :value="null">Aucune catégorie</option>
                  <option
                    v-for="category in sortedCategories"
                    :key="category.id"
                    :value="category.id"
                  >
                    {{ category.title }}
                  </option>
                </select>
              </label>

              <div class="space-y-3">
                <div>
                  <p class="text-sm font-medium text-slate-700">
                    Clusters associés
                  </p>
                  <p class="text-sm text-slate-500">
                    Sélectionne tous les clusters qui peuvent répondre à ce
                    problème.
                  </p>
                </div>

                <div
                  class="max-h-80 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-slate-50 p-3 pr-2"
                >
                  <div v-if="sortedClusters.length" class="space-y-2">
                    <label
                      v-for="cluster in sortedClusters"
                      :key="cluster.id"
                      class="flex cursor-pointer items-start gap-3 rounded-xl border border-transparent bg-white px-3 py-3 transition hover:border-slate-200"
                    >
                      <input
                        :checked="(form.clusterIds ?? []).includes(cluster.id)"
                        type="checkbox"
                        class="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        @change="toggleCluster(cluster.id)"
                      />
                      <div class="min-w-0">
                        <p class="text-sm font-medium text-slate-900">
                          {{ cluster.name }}
                        </p>
                        <p class="text-sm text-slate-500">
                          {{ cluster.primaryKeyword }}
                        </p>
                      </div>
                    </label>
                  </div>

                  <p v-else class="text-sm text-slate-500">
                    Aucun cluster disponible.
                  </p>
                </div>
              </div>

              <div class="flex justify-end">
                <UButton
                  icon="i-lucide-save"
                  :loading="isSaving"
                  :disabled="!form.title.trim() || isImporting"
                  @click="submitForm"
                >
                  {{
                    isSaving
                      ? "Enregistrement..."
                      : isEditing
                        ? "Mettre à jour"
                        : "Créer le problème"
                  }}
                </UButton>
              </div>
            </div>
          </div>
        </section>

        <section
          class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div class="space-y-4">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-semibold text-slate-900">
                  Liste des problèmes
                </h2>
                <UBadge color="neutral" variant="soft">
                  {{ filteredProblems.length }}
                </UBadge>
              </div>
              <p class="text-sm text-slate-500">
                Recherche, modifie ou supprime les problèmes déjà enregistrés.
              </p>
            </div>

            <div class="relative">
              <input
                v-model="search"
                type="text"
                placeholder="Filtrer les problèmes..."
                class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pl-10 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              />
              <div
                class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"
              >
                <UIcon name="i-lucide-search" class="h-4 w-4" />
              </div>
            </div>

            <div
              v-if="!filteredProblems.length"
              class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500"
            >
              Aucun problème client pour le moment.
            </div>

            <div
              v-else
              class="max-h-[48rem] space-y-3 overflow-y-auto overscroll-contain pr-1"
            >
              <article
                v-for="problem in filteredProblems"
                :key="problem.id"
                class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 space-y-2">
                    <p class="font-medium text-slate-900">{{ problem.title }}</p>
                    <p
                      v-if="problem.description"
                      class="text-sm leading-6 text-slate-500"
                    >
                      {{ problem.description }}
                    </p>
                  </div>

                  <div class="flex items-center gap-2">
                    <UButton
                      size="sm"
                      color="primary"
                      variant="soft"
                      icon="i-lucide-sparkles"
                      class="whitespace-nowrap"
                      :loading="extractingProblemId === problem.id"
                      :disabled="!!extractingProblemId"
                      @click="runKeywordExtraction(problem)"
                    >
                      Extraire des mots-clés
                    </UButton>
                    <UButton
                      size="sm"
                      color="neutral"
                      variant="soft"
                      icon="i-lucide-pencil"
                      @click="startEditing(problem)"
                    >
                      Modifier
                    </UButton>
                    <UButton
                      size="sm"
                      color="error"
                      variant="soft"
                      icon="i-lucide-trash-2"
                      :loading="deletingProblemId === problem.id"
                      :disabled="!!deletingProblemId"
                      @click="removeProblem(problem)"
                    >
                      Supprimer
                    </UButton>
                  </div>
                </div>

                <div class="mt-4 flex flex-wrap gap-2">
                  <UBadge v-if="problem.category" color="neutral" variant="soft">
                    {{ problem.category.title }}
                  </UBadge>
                  <UBadge color="neutral" variant="soft">
                    {{
                      customerProblemSourceOptions.find(
                        (option) => option.value === problem.source,
                      )?.label || problem.source
                    }}
                  </UBadge>
                  <UBadge v-if="problem.intention" color="neutral" variant="soft">
                    {{
                      customerProblemIntentOptions.find(
                        (option) => option.value === problem.intention,
                      )?.label || problem.intention
                    }}
                  </UBadge>
                </div>

                <div
                  v-if="problem.clusters.length"
                  class="mt-4 flex flex-wrap gap-2"
                >
                  <NuxtLink
                    v-for="cluster in problem.clusters"
                    :key="cluster.id"
                    :to="`/clusters/${cluster.id}`"
                    class="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
                  >
                    {{ cluster.name }}
                  </NuxtLink>
                </div>

                <div
                  v-if="problem.keywords.length"
                  class="mt-4 flex flex-wrap gap-2"
                >
                  <span
                    v-for="keyword in problem.keywords"
                    :key="keyword.id"
                    class="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                  >
                    {{ keyword.keyword }}
                  </span>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section
          class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Dicta
            consequuntur cupiditate eligendi nihil quos natus. Reprehenderit
            asperiores esse doloremque, laudantium ea cumque in, delectus vel sit
            reiciendis magnam atque velit.
          </p>
        </section>
      </div>
    </div>
  </section>
</template>
