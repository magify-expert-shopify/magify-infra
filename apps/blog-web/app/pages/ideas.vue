<script setup lang="ts">
const {
  assignIdeaClustersWithAi,
  createBlogArticleIdea,
  deleteBlogArticle,
  useBlogArticleIdeasList,
} = useBlogArticles();
const { data: ideas, error, status } = await useBlogArticleIdeasList();

const ideaTitle = ref("");
const isSubmittingIdea = ref(false);
const submitError = ref<string | null>(null);
const isBulkCreateModalOpen = ref(false);
const bulkIdeaTitles = ref<string[]>([]);
const deletingIdeaId = ref<string | null>(null);
const bulkDuplicateTitles = ref<string[]>([]);
const isAssigningClusters = ref(false);
const breadcrumbItems = [
  {
    label: "Idées",
  },
];

const existingIdeaTitleSet = computed(() => {
  return new Set(
    (ideas.value ?? []).map((idea) => normalizeIdeaTitle(idea.title)),
  );
});

const bulkUniqueTitlesToCreate = computed(() =>
  bulkIdeaTitles.value.filter(
    (title, index, array) =>
      !existingIdeaTitleSet.value.has(title) && array.indexOf(title) === index,
  ),
);

function normalizeIdeaTitle(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

async function submitIdea() {
  const normalizedTitle = normalizeIdeaTitle(ideaTitle.value);

  if (isSubmittingIdea.value || !normalizedTitle) {
    return;
  }

  if (existingIdeaTitleSet.value.has(normalizedTitle)) {
    submitError.value = "Cette idée d'article existe déjà.";
    return;
  }

  isSubmittingIdea.value = true;
  submitError.value = null;

  try {
    const createdIdea = await createBlogArticleIdea(normalizedTitle);
    ideaTitle.value = "";
    ideas.value = [createdIdea, ...(ideas.value ?? [])];
  } catch (error) {
    submitError.value = "Impossible d'ajouter l'idée d'article.";
    console.error(error);
  } finally {
    isSubmittingIdea.value = false;
  }
}

function onIdeaPaste(event: ClipboardEvent) {
  const pastedText = event.clipboardData?.getData("text") ?? "";
  const lines = pastedText
    .split(/\r?\n/)
    .map((line) => normalizeIdeaTitle(line))
    .filter(Boolean);

  if (lines.length <= 1) {
    return;
  }

  event.preventDefault();
  bulkIdeaTitles.value = lines;
  bulkDuplicateTitles.value = lines.filter((title) =>
    existingIdeaTitleSet.value.has(title),
  );
  isBulkCreateModalOpen.value = true;
  submitError.value = null;
}

function closeBulkCreateModal() {
  isBulkCreateModalOpen.value = false;
  bulkIdeaTitles.value = [];
  bulkDuplicateTitles.value = [];
}

async function submitBulkIdeas() {
  const uniqueTitlesToCreate = bulkUniqueTitlesToCreate.value;

  if (isSubmittingIdea.value || !uniqueTitlesToCreate.length) {
    if (!uniqueTitlesToCreate.length) {
      submitError.value =
        "Toutes les idées collées existent déjà côté front.";
    }

    return;
  }

  isSubmittingIdea.value = true;
  submitError.value = null;

  try {
    const createdIdeas = await Promise.all(
      uniqueTitlesToCreate.map((title) => createBlogArticleIdea(title)),
    );
    closeBulkCreateModal();
    ideas.value = [...createdIdeas.reverse(), ...(ideas.value ?? [])];
  } catch (error) {
    submitError.value =
      "Impossible d'ajouter toutes les idées d'articles.";
    console.error(error);
  } finally {
    isSubmittingIdea.value = false;
  }
}

async function removeIdea(id: string) {
  if (deletingIdeaId.value) {
    return;
  }

  deletingIdeaId.value = id;

  try {
    await deleteBlogArticle(id);
    ideas.value = (ideas.value ?? []).filter((idea) => idea.id !== id);
  } catch (error) {
    console.error(error);
  } finally {
    deletingIdeaId.value = null;
  }
}

async function assignClustersWithAi() {
  if (isAssigningClusters.value) {
    return;
  }

  isAssigningClusters.value = true;
  submitError.value = null;

  try {
    const updatedIdeas = await assignIdeaClustersWithAi();

    if (!updatedIdeas.length) {
      return;
    }

    const updatedIdeasById = new Map(updatedIdeas.map((idea) => [idea.id, idea]));

    ideas.value = (ideas.value ?? []).map((idea) =>
      updatedIdeasById.get(idea.id) ?? idea,
    );
  } catch (error) {
    submitError.value =
      "Impossible d'associer automatiquement les clusters avec l'IA.";
    console.error(error);
  } finally {
    isAssigningClusters.value = false;
  }
}

function toLucideIconName(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return "i-lucide-folder-kanban";
  }

  return `i-lucide-${trimmed.replace(/^i-lucide-/, "")}`;
}
</script>

<template>
  <section class="space-y-6">
    <UBreadcrumb :items="breadcrumbItems" class="text-slate-500" />

    <div class="space-y-1">
      <h1 class="text-2xl font-semibold text-slate-900">Idées de titres</h1>
      <p class="text-sm text-slate-500">
        Liste des idées d’articles de blog enregistrées.
      </p>
    </div>

    <div class="flex justify-end">
      <UButton
        color="primary"
        icon="i-lucide-sparkles"
        variant="soft"
        :loading="isAssigningClusters"
        :disabled="!(ideas?.length ?? 0)"
        @click="assignClustersWithAi"
      >
        {{
          isAssigningClusters
            ? "Association IA..."
            : "Associer les idées à un cluster avec l’IA"
        }}
      </UButton>
    </div>

    <form
      class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      @submit.prevent="submitIdea"
    >
      <div class="flex flex-col gap-3 sm:flex-row">
        <input
          v-model="ideaTitle"
          type="text"
          placeholder="Ajouter une idée d’article..."
          class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          @paste="onIdeaPaste"
        />
        <UButton
          type="submit"
          icon="i-lucide-plus"
          :loading="isSubmittingIdea"
          :disabled="!ideaTitle.trim()"
        >
          Ajouter
        </UButton>
      </div>

      <p v-if="submitError" class="mt-3 text-sm text-red-600">
        {{ submitError }}
      </p>
    </form>

    <p v-if="status === 'pending'" class="text-sm text-slate-500">
      Chargement des idées...
    </p>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :details="error.toString()"
      title="Impossible de charger les idées"
      description="Les idées d'articles n'ont pas pu être récupérées."
    />

    <div
      v-else-if="!(ideas?.length ?? 0)"
      class="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm"
    >
      <p class="text-base font-medium text-slate-900">
        Aucune idée d’article pour le moment
      </p>
      <p class="mt-2 text-sm text-slate-500">
        Les `BlogArticle` avec le statut `IDEA` apparaîtront ici.
      </p>
    </div>

    <div v-else class="flex flex-wrap gap-3">
      <article
        v-for="idea in ideas"
        :key="idea.id"
        class="relative max-w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-12 shadow-sm"
      >
        <div class="flex items-center gap-2">
          <span
            v-if="idea.cluster"
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200"
          >
            <UIcon :name="toLucideIconName(idea.cluster.icon)" class="h-4 w-4" />
          </span>

          <p class="whitespace-nowrap text-sm font-medium text-slate-900">
            {{ idea.title }}
          </p>
        </div>
        <p
          v-if="idea.cluster?.name"
          class="mt-2 whitespace-nowrap text-xs font-medium text-sky-700"
        >
          {{ idea.cluster.name }}
        </p>
        <button
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          :disabled="deletingIdeaId === idea.id"
          @click="removeIdea(idea.id)"
        >
          <UIcon
            :name="
              deletingIdeaId === idea.id
                ? 'i-lucide-loader-circle'
                : 'i-lucide-trash-2'
            "
            class="h-4 w-4"
            :class="{ 'animate-spin': deletingIdeaId === idea.id }"
          />
        </button>
      </article>
    </div>

    <div
      v-if="isBulkCreateModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
      @pointerdown.self="closeBulkCreateModal"
    >
      <div
        class="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl"
        @pointerdown.stop
      >
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <h2 class="text-xl font-semibold text-slate-900">
              Créer plusieurs idées d’articles
            </h2>
            <p class="text-sm text-slate-500">
              Créer un `BlogArticle` en statut `IDEA` pour chaque ligne collée ?
            </p>
          </div>

          <button
            type="button"
            class="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            @click="closeBulkCreateModal"
          >
            <UIcon name="i-lucide-x" class="h-5 w-5" />
          </button>
        </div>

        <div
          v-if="bulkDuplicateTitles.length"
          class="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {{ bulkDuplicateTitles.length }} idée{{
            bulkDuplicateTitles.length > 1 ? "s sont déjà connues" : " est déjà connue"
          }}.
        </div>

        <div
          class="mt-6 overscroll-contain rounded-2xl border border-slate-200 bg-white p-2 pr-1"
          style="height: 18rem; max-height: 18rem; overflow-y: auto;"
        >
          <div class="flex flex-wrap gap-2">
            <article
              v-for="(title, index) in bulkIdeaTitles"
              :key="`${index}-${title}`"
              class="max-w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <p class="whitespace-nowrap text-sm font-medium text-slate-900">
                {{ title }}
              </p>
            </article>
          </div>
        </div>

        <p v-if="submitError" class="mt-4 text-sm text-red-600">
          {{ submitError }}
        </p>

        <div class="mt-6 flex items-center justify-end gap-3">
          <UButton
            type="button"
            color="neutral"
            variant="soft"
            @click="closeBulkCreateModal"
          >
            Annuler
          </UButton>
          <UButton
            type="button"
            icon="i-lucide-list-plus"
            :loading="isSubmittingIdea"
            :disabled="!bulkUniqueTitlesToCreate.length"
            @click="submitBulkIdeas"
          >
            Créer
            {{ bulkUniqueTitlesToCreate.length }}
            idée{{
              bulkUniqueTitlesToCreate.length > 1 ? "s" : ""
            }}
          </UButton>
        </div>
      </div>
    </div>
  </section>
</template>
