<script setup lang="ts">
import type { SeoCluster } from "~/types/domain";
import type { KeywordGroupRecord } from "~/types/keywords";
import { normalizeSearchText } from "~/utils/search-normalizer";

const props = defineProps<{
  inline?: boolean;
  open: boolean;
  isEditing: boolean;
  isSubmitting: boolean;
  errorMessage?: string | null;
  form: {
    name: string;
    parentClusterId: string;
    slug: string;
    icon: string;
    pillarKeywordGroupId: string;
    secondaryKeywordGroupIds: string[];
    description: string;
    primaryKeyword: string;
    childClusterIds: string[];
  };
  availableParentClusters: SeoCluster[];
  availableKeywordGroups: KeywordGroupRecord[];
  availableChildClusters: SeoCluster[];
}>();

const emit = defineEmits<{
  close: [];
  submit: [];
}>();

const isVisible = computed(() => props.inline || props.open);

const keywordGroupSearch = ref("");
const secondaryKeywordGroupSearch = ref("");
const parentClusterSearch = ref("");
const childClusterSearch = ref("");

const filteredKeywordGroups = computed(() => {
  const search = normalizeSearchText(keywordGroupSearch.value);

  if (!search) {
    return props.availableKeywordGroups;
  }

  return props.availableKeywordGroups.filter((keywordGroup) =>
    [keywordGroup.name, keywordGroup.primaryKeyword, keywordGroup.description]
      .filter((value): value is string => typeof value === "string")
      .some((value) => normalizeSearchText(value).includes(search)),
  );
});

const filteredSecondaryKeywordGroups = computed(() => {
  const search = normalizeSearchText(secondaryKeywordGroupSearch.value);

  return props.availableKeywordGroups.filter((keywordGroup) => {
    if (keywordGroup.id === props.form.pillarKeywordGroupId) {
      return false;
    }

    if (!search) {
      return true;
    }

    return [keywordGroup.name, keywordGroup.primaryKeyword, keywordGroup.description]
      .filter((value): value is string => typeof value === "string")
      .some((value) => normalizeSearchText(value).includes(search));
  });
});

const filteredChildClusters = computed(() => {
  const search = normalizeSearchText(childClusterSearch.value);

  if (!search) {
    return props.availableChildClusters;
  }

  return props.availableChildClusters.filter((cluster) =>
    [cluster.name, cluster.slug, cluster.primaryKeyword, cluster.description]
      .filter((value): value is string => typeof value === "string")
      .some((value) => normalizeSearchText(value).includes(search)),
  );
});

const filteredParentClusters = computed(() => {
  const search = normalizeSearchText(parentClusterSearch.value);

  if (!search) {
    return props.availableParentClusters;
  }

  return props.availableParentClusters.filter((cluster) =>
    [cluster.name, cluster.slug, cluster.primaryKeyword, cluster.description]
      .filter((value): value is string => typeof value === "string")
      .some((value) => normalizeSearchText(value).includes(search)),
  );
});

function toggleChildCluster(clusterId: string) {
  const nextChildClusterIds = props.form.childClusterIds.includes(clusterId)
    ? props.form.childClusterIds.filter((id) => id !== clusterId)
    : [...props.form.childClusterIds, clusterId];

  props.form.childClusterIds = nextChildClusterIds;
}

function selectKeywordGroup(keywordGroup: KeywordGroupRecord) {
  if (!keywordGroup.primaryKeyword?.trim()) {
    return;
  }

  props.form.pillarKeywordGroupId = keywordGroup.id;
}

function toggleSecondaryKeywordGroup(keywordGroupId: string) {
  const nextSecondaryKeywordGroupIds = props.form.secondaryKeywordGroupIds.includes(
    keywordGroupId,
  )
    ? props.form.secondaryKeywordGroupIds.filter((id) => id !== keywordGroupId)
    : [...props.form.secondaryKeywordGroupIds, keywordGroupId];

  props.form.secondaryKeywordGroupIds = nextSecondaryKeywordGroupIds.filter(
    (id) => id !== props.form.pillarKeywordGroupId,
  );
}
</script>

<template>
  <div
    v-if="isVisible"
    :class="
      props.inline
        ? 'w-full'
        : 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4'
    "
    @pointerdown.self="!props.inline && $emit('close')"
  >
    <div
      :class="
        props.inline
          ? 'w-full'
          : 'w-full max-w-7xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl 2xl:max-w-[92rem]'
      "
      @pointerdown.stop
    >
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-xl font-semibold text-slate-900">
            {{ isEditing ? "Modifier le cluster" : "Ajouter un cluster" }}
          </h2>
          <p class="text-sm text-slate-500">
            Le titre, le mot-clé principal et le slug sont dérivés du groupe
            pilier choisi.
          </p>
        </div>

        <button
          type="button"
          class="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          @click="$emit('close')"
        >
          <UIcon name="i-lucide-x" class="h-5 w-5" />
        </button>
      </div>

      <form class="mt-6" @submit.prevent="$emit('submit')">
        <div class="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] 2xl:grid-cols-[1.05fr_0.9fr_0.85fr]">
          <div class="space-y-4">
            <div class="rounded-3xl border border-slate-200 bg-slate-50/60 p-4">
              <div class="mb-3 flex items-center gap-2">
                <UIcon
                  name="i-lucide-layout-template"
                  class="h-4 w-4 text-slate-500"
                />
                <p class="text-sm font-semibold text-slate-700">
                  Contenu du cluster
                </p>
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <label class="block space-y-2 sm:col-span-2">
                  <span class="text-sm font-medium text-slate-700">
                    Titre du cluster <span class="text-red-500">*</span>
                  </span>
                  <input
                    v-model="form.name"
                    type="text"
                    placeholder="Ex. SEO local restaurant"
                    class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  />
                </label>

                <label class="block space-y-2 sm:col-span-2">
                  <span class="text-sm font-medium text-slate-700">
                    Description
                  </span>
                  <textarea
                    v-model="form.description"
                    rows="5"
                    placeholder="Décrivez rapidement le cluster et son angle éditorial."
                    class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  />
                </label>

                <label class="block space-y-2 sm:col-span-2">
                  <span class="text-sm font-medium text-slate-700">
                    Icône Lucide
                  </span>
                  <ClustersSeoClusterIconInput v-model="form.icon" />
                </label>
              </div>
            </div>

            <div class="rounded-3xl border border-sky-200 bg-sky-50/70 p-4">
              <div class="mb-3 flex items-center gap-2">
                <UIcon name="i-lucide-sparkles" class="h-4 w-4 text-sky-500" />
                <p class="text-sm font-semibold text-sky-900">
                  Résumé du cluster
                </p>
              </div>

              <dl class="space-y-3 text-sm">
                <div class="flex items-start justify-between gap-4">
                  <dt class="text-slate-500">Titre</dt>
                  <dd class="max-w-[18rem] truncate font-medium text-slate-900">
                    {{ form.name || "—" }}
                  </dd>
                </div>
                <div class="flex items-start justify-between gap-4">
                  <dt class="text-slate-500">Description</dt>
                  <dd
                    class="max-w-[18rem] truncate text-right font-medium text-slate-900"
                  >
                    {{ form.description || "—" }}
                  </dd>
                </div>
                <div class="flex items-start justify-between gap-4">
                  <dt class="text-slate-500">Groupe pilier</dt>
                  <dd class="max-w-[18rem] truncate font-medium text-slate-900">
                    {{
                      availableKeywordGroups.find(
                        (group) => group.id === form.pillarKeywordGroupId,
                      )?.name || "—"
                    }}
                  </dd>
                </div>
                <div class="flex items-start justify-between gap-4">
                  <dt class="text-slate-500">Groupes secondaires</dt>
                  <dd class="font-medium text-slate-900">
                    {{ form.secondaryKeywordGroupIds.length }}
                  </dd>
                </div>
                <div class="flex items-start justify-between gap-4">
                  <dt class="text-slate-500">Slug</dt>
                  <dd class="max-w-[18rem] truncate font-medium text-slate-900">
                    {{ form.slug || "—" }}
                  </dd>
                </div>
                <div class="flex items-start justify-between gap-4">
                  <dt class="text-slate-500">Enfants</dt>
                  <dd class="font-medium text-slate-900">
                    {{ form.childClusterIds.length }}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div class="space-y-4">
            <div class="rounded-3xl border border-slate-200 bg-slate-50/60 p-4">
              <div class="mb-3 flex items-center gap-2">
                <UIcon
                  name="i-lucide-git-branch"
                  class="h-4 w-4 text-slate-500"
                />
                <p class="text-sm font-semibold text-slate-700">
                  Groupe pilier et hiérarchie
                </p>
              </div>

              <label class="block space-y-2">
                <span class="text-sm font-medium text-slate-700">
                  Groupe pilier <span class="text-red-500">*</span>
                </span>
                <input
                  v-model="keywordGroupSearch"
                  type="text"
                  placeholder="Rechercher un KeywordGroup pilier..."
                  class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                />
              </label>

              <div
                class="mt-3 max-h-[22rem] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3"
              >
                <div class="space-y-2">
                  <button
                    v-for="keywordGroup in filteredKeywordGroups"
                    :key="keywordGroup.id"
                    type="button"
                    class="flex w-full items-start justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-left transition"
                    :class="
                      form.pillarKeywordGroupId === keywordGroup.id
                        ? 'border-sky-300 bg-sky-50 ring-2 ring-sky-100'
                        : 'bg-white hover:bg-slate-50'
                    "
                    :disabled="!keywordGroup.primaryKeyword?.trim()"
                    @click="selectKeywordGroup(keywordGroup)"
                  >
                    <div class="min-w-0 space-y-1">
                      <p class="truncate text-sm font-medium text-slate-900">
                        {{ keywordGroup.name }}
                      </p>
                    </div>

                    <UIcon
                      v-if="form.pillarKeywordGroupId === keywordGroup.id"
                      name="i-lucide-check"
                      class="h-4 w-4 shrink-0 text-sky-600"
                    />
                  </button>
                </div>
              </div>
            </div>

            <div class="rounded-3xl border border-slate-200 bg-slate-50/60 p-4">
              <div class="mb-3 flex items-center gap-2">
                <UIcon
                  name="i-lucide-layers-3"
                  class="h-4 w-4 text-slate-500"
                />
                <p class="text-sm font-semibold text-slate-700">
                  Groupes secondaires
                </p>
              </div>

              <label class="block space-y-2">
                <span class="text-sm font-medium text-slate-700">
                  Rechercher un KeywordGroup
                </span>
                <input
                  v-model="secondaryKeywordGroupSearch"
                  type="text"
                  placeholder="Rechercher un KeywordGroup secondaire..."
                  class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                />
              </label>

              <div
                class="mt-3 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3"
              >
                <div v-if="filteredSecondaryKeywordGroups.length" class="space-y-2">
                  <button
                    v-for="keywordGroup in filteredSecondaryKeywordGroups"
                    :key="keywordGroup.id"
                    type="button"
                    class="flex w-full items-start justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-left transition"
                    :class="
                      form.secondaryKeywordGroupIds.includes(keywordGroup.id)
                        ? 'border-sky-300 bg-sky-50 ring-2 ring-sky-100'
                        : 'bg-white hover:bg-slate-50'
                    "
                    :disabled="
                      keywordGroup.id === form.pillarKeywordGroupId ||
                      !keywordGroup.primaryKeyword?.trim()
                    "
                    @click="toggleSecondaryKeywordGroup(keywordGroup.id)"
                  >
                    <div class="min-w-0 space-y-1">
                      <p class="truncate text-sm font-medium text-slate-900">
                        {{ keywordGroup.name }}
                      </p>
                      <p class="truncate text-xs text-slate-500">
                        Mot-clé principal :
                        {{ keywordGroup.primaryKeyword || "—" }}
                      </p>
                      <p
                        v-if="keywordGroup.description"
                        class="line-clamp-2 text-xs text-slate-400"
                      >
                        {{ keywordGroup.description }}
                      </p>
                    </div>

                    <UIcon
                      v-if="form.secondaryKeywordGroupIds.includes(keywordGroup.id)"
                      name="i-lucide-check"
                      class="h-4 w-4 shrink-0 text-sky-600"
                    />
                  </button>
                </div>

                <p v-else class="px-2 py-4 text-sm text-slate-500">
                  Aucun KeywordGroup secondaire ne correspond à cette recherche.
                </p>
              </div>
            </div>
          </div>

          <div class="space-y-4 2xl:col-start-3">
            <div class="rounded-3xl border border-slate-200 bg-slate-50/60 p-4">
              <div class="mb-3 flex items-center gap-2">
                <UIcon
                  name="i-lucide-git-merge"
                  class="h-4 w-4 text-slate-500"
                />
                <p class="text-sm font-semibold text-slate-700">
                  Cluster parent
                </p>
              </div>

              <label class="block space-y-2">
                <span class="text-sm font-medium text-slate-700">
                  Rechercher un cluster parent
                </span>
                <input
                  v-model="parentClusterSearch"
                  type="text"
                  placeholder="Rechercher un cluster..."
                  class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                />
              </label>

              <div
                class="mt-3 max-h-[18rem] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3"
              >
                <div class="space-y-2">
                  <button
                    v-for="cluster in filteredParentClusters"
                    :key="cluster.id"
                    type="button"
                    class="flex w-full items-start justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-left transition"
                    :class="
                      form.parentClusterId === cluster.id
                        ? 'border-sky-300 bg-sky-50 ring-2 ring-sky-100'
                        : 'bg-white hover:bg-slate-50'
                    "
                    @click="
                      form.parentClusterId =
                        form.parentClusterId === cluster.id ? '' : cluster.id
                    "
                  >
                    <div class="min-w-0 space-y-1">
                      <p class="truncate text-sm font-medium text-slate-900">
                        {{ cluster.name }}
                      </p>
                      <p v-if="cluster.slug" class="truncate text-xs text-slate-500">
                        /{{ cluster.slug }}
                      </p>
                    </div>

                    <UIcon
                      v-if="form.parentClusterId === cluster.id"
                      name="i-lucide-check"
                      class="h-4 w-4 shrink-0 text-sky-600"
                    />
                  </button>
                </div>
              </div>
            </div>

            <div class="rounded-3xl border border-slate-200 bg-slate-50/60 p-4">
              <div class="mb-3 flex items-center gap-2">
                <UIcon
                  name="i-lucide-folder-tree"
                  class="h-4 w-4 text-slate-500"
                />
                <p class="text-sm font-semibold text-slate-700">
                  Cluster enfants
                </p>
              </div>

              <label class="block space-y-2">
                <span class="text-sm font-medium text-slate-700">
                  Rechercher un sous-cluster
                </span>
                <input
                  v-model="childClusterSearch"
                  type="text"
                  placeholder="Rechercher un sous-cluster..."
                  class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                />
              </label>

              <div
                class="mt-3 max-h-[18rem] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3"
              >
                <div v-if="filteredChildClusters.length" class="space-y-2">
                  <button
                    v-for="cluster in filteredChildClusters"
                    :key="cluster.id"
                    type="button"
                    class="flex w-full items-start justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-left transition"
                    :class="
                      form.childClusterIds.includes(cluster.id)
                        ? 'border-sky-300 bg-sky-50 ring-2 ring-sky-100'
                        : 'bg-white hover:bg-slate-50'
                    "
                    @click="toggleChildCluster(cluster.id)"
                  >
                    <div class="min-w-0 space-y-1">
                      <p class="truncate text-sm font-medium text-slate-900">
                        {{ cluster.name }}
                      </p>
                      <p v-if="cluster.slug" class="truncate text-xs text-slate-500">
                        /{{ cluster.slug }}
                      </p>
                    </div>

                    <UIcon
                      v-if="form.childClusterIds.includes(cluster.id)"
                      name="i-lucide-check"
                      class="h-4 w-4 shrink-0 text-sky-600"
                    />
                  </button>
                </div>

                <p v-else class="px-2 py-4 text-sm text-slate-500">
                  Aucun sous-cluster ne correspond à cette recherche.
                </p>
              </div>
            </div>
          </div>
        </div>

        <FeedbackErrorMessage v-if="errorMessage" class="mt-4">
          {{ errorMessage }}
        </FeedbackErrorMessage>

        <div
          class="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4"
        >
          <UButton
            type="button"
            color="neutral"
            variant="soft"
            @click="$emit('close')"
          >
            Annuler
          </UButton>
          <UButton
            type="submit"
            :loading="isSubmitting"
            :disabled="
              !form.name.trim() ||
              !form.primaryKeyword.trim() ||
              !form.slug.trim() ||
              (!isEditing && !form.pillarKeywordGroupId.trim())
            "
          >
            {{
              isSubmitting
                ? isEditing
                  ? "Enregistrement..."
                  : "Création..."
                : isEditing
                  ? "Enregistrer"
                  : "Créer le cluster"
            }}
          </UButton>
        </div>
      </form>
    </div>
  </div>
</template>
