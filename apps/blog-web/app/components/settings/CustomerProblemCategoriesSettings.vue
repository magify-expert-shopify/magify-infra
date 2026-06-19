<script setup lang="ts">
import type { CustomerProblemCategory } from "~/types/customer-problems";

const { useSeoClustersList } = useSeoClusters();
const {
  createCustomerProblemCategory,
  deleteCustomerProblemCategory,
  updateCustomerProblemCategory,
  useCustomerProblemCategoriesList,
} = useCustomerProblemCategories();

const { data: categories, refresh } = await useCustomerProblemCategoriesList();
const { data: clusters } = await useSeoClustersList();

const formTitle = ref("");
const formClusterIds = ref<string[]>([]);
const editingCategoryId = ref<string | null>(null);
const isSaving = ref(false);
const deletingCategoryId = ref<string | null>(null);
const feedbackMessage = ref("");

const isEditing = computed(() => !!editingCategoryId.value);
const sortedCategories = computed(() => categories.value ?? []);
const sortedClusters = computed(() =>
  [...(clusters.value ?? [])].sort((left, right) =>
    left.name.localeCompare(right.name),
  ),
);

function resetForm() {
  formTitle.value = "";
  formClusterIds.value = [];
  editingCategoryId.value = null;
}

function startEditing(category: CustomerProblemCategory) {
  formTitle.value = category.title;
  formClusterIds.value = (category.clusters ?? []).map((cluster) => cluster.id);
  editingCategoryId.value = category.id;
  feedbackMessage.value = "";
}

function toggleCluster(clusterId: string) {
  const nextClusterIds = new Set(formClusterIds.value);

  if (nextClusterIds.has(clusterId)) {
    nextClusterIds.delete(clusterId);
  } else {
    nextClusterIds.add(clusterId);
  }

  formClusterIds.value = [...nextClusterIds];
}

async function submitForm() {
  if (isSaving.value || !formTitle.value.trim()) {
    return;
  }

  isSaving.value = true;
  feedbackMessage.value = "";

  try {
    if (editingCategoryId.value) {
      await updateCustomerProblemCategory(editingCategoryId.value, {
        title: formTitle.value,
        clusterIds: formClusterIds.value,
      });
      feedbackMessage.value = "Catégorie mise à jour.";
    } else {
      await createCustomerProblemCategory({
        title: formTitle.value,
        clusterIds: formClusterIds.value,
      });
      feedbackMessage.value = "Catégorie créée.";
    }

    await refresh();
    resetForm();
  } finally {
    isSaving.value = false;
  }
}

async function removeCategory(category: CustomerProblemCategory) {
  if (deletingCategoryId.value) {
    return;
  }

  if (!window.confirm(`Supprimer la catégorie « ${category.title} » ?`)) {
    return;
  }

  deletingCategoryId.value = category.id;
  feedbackMessage.value = "";

  try {
    await deleteCustomerProblemCategory(category.id);
    await refresh();

    if (editingCategoryId.value === category.id) {
      resetForm();
    }

    feedbackMessage.value = "Catégorie supprimée.";
  } finally {
    deletingCategoryId.value = null;
  }
}
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex flex-col gap-5">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-slate-900">
          Catégories de problèmes clients
        </h2>
        <p class="text-sm leading-6 text-slate-500">
          Gérez ici les catégories utilisées dans le formulaire des problèmes
          clients.
        </p>
      </div>

      <p v-if="feedbackMessage" class="text-sm text-slate-500">
        {{ feedbackMessage }}
      </p>

      <div class="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div class="space-y-4">
          <div class="space-y-1">
            <h3 class="text-base font-semibold text-slate-900">
              {{
                isEditing ? "Modifier une catégorie" : "Ajouter une catégorie"
              }}
            </h3>
            <p class="text-sm text-slate-500">
              Exemple : Acquisition, Refonte Shopify, Conversion, Tracking...
            </p>
          </div>

          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700">
              Titre <span class="text-red-500">*</span>
            </span>
            <input
              v-model="formTitle"
              type="text"
              placeholder="Ex: Refonte Shopify"
              class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
            />
          </label>

          <div class="space-y-3">
            <div>
              <p class="text-sm font-medium text-slate-700">
                Clusters par défaut
              </p>
              <p class="text-sm text-slate-500">
                Ils seront pré-remplis dans le formulaire et lors des imports
                CSV.
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
                    :checked="formClusterIds.includes(cluster.id)"
                    type="checkbox"
                    class="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
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

          <div class="flex flex-wrap justify-end gap-2">
            <UButton
              v-if="isEditing"
              color="neutral"
              variant="soft"
              icon="i-lucide-rotate-ccw"
              @click="resetForm"
            >
              Annuler
            </UButton>

            <UButton
              icon="i-lucide-save"
              :loading="isSaving"
              :disabled="!formTitle.trim()"
              @click="submitForm"
            >
              {{
                isSaving
                  ? "Enregistrement..."
                  : isEditing
                    ? "Mettre à jour"
                    : "Créer la catégorie"
              }}
            </UButton>
          </div>
        </div>

        <div
          class="max-h-[32rem] space-y-3 overflow-y-auto overscroll-contain pr-1"
        >
          <div
            v-if="!sortedCategories.length"
            class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500"
          >
            Aucune catégorie configurée pour le moment.
          </div>

          <article
            v-for="category in sortedCategories"
            :key="category.id"
            class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-2">
                <p class="font-medium text-slate-900">{{ category.title }}</p>
                <UBadge color="neutral" variant="soft">
                  {{ category._count?.customerProblems ?? 0 }} problème(s)
                </UBadge>
                <div
                  v-if="category.clusters?.length"
                  class="flex flex-wrap gap-2"
                >
                  <span
                    v-for="cluster in category.clusters"
                    :key="cluster.id"
                    class="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700"
                  >
                    {{ cluster.name }}
                  </span>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <UButton
                  size="sm"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-pencil"
                  @click="startEditing(category)"
                >
                  Modifier
                </UButton>

                <UButton
                  size="sm"
                  color="error"
                  variant="soft"
                  icon="i-lucide-trash-2"
                  :loading="deletingCategoryId === category.id"
                  :disabled="!!deletingCategoryId"
                  @click="removeCategory(category)"
                >
                  Supprimer
                </UButton>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>
