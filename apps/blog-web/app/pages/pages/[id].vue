<script setup lang="ts">
import { searchIntentLabels } from "~/constants/enums";
import {
  pageStatusLabels,
  pageStatusOptions,
  pageTypeLabels,
  seoRoleLabels,
} from "~/constants/pages";
import { useAppToast } from "~/composables/useAppToast";
import type { PageStatus } from "~/types/pages";

const route = useRoute();
const config = useRuntimeConfig();
const pageId = computed(() => {
  const rawId = route.params.id;

  if (Array.isArray(rawId)) {
    return rawId[0] ?? "";
  }

  return rawId?.toString() ?? "";
});

const bullDashboardUrl = computed(
  () => `${config.public.apiUrl}/admin/queues`,
);
const shopifyPageUrl = computed(() => page.value?.url?.trim() ?? "");
const { deletePage, getPage, regeneratePageArticle, updatePage } = usePages();
const { showErrorToast, showSuccessToast } = useAppToast();
const isSaving = ref(false);
const isDeleting = ref(false);
const isRegenerating = ref(false);
let jobRefreshTimer: ReturnType<typeof setInterval> | null = null;
const draftTitle = ref("");
const draftSlug = ref("");
const draftStatus = ref<PageStatus>("DRAFT");

const {
  data: page,
  status,
  error,
  refresh,
} = await useAsyncData("pages:detail", () => getPage(pageId.value), {
  watch: [pageId],
});

watch(
  page,
  (value) => {
    if (!value) {
      return;
    }

    draftTitle.value = value.title ?? "";
    draftSlug.value = value.slug ?? "";
    draftStatus.value = value.status ?? "DRAFT";
  },
  { immediate: true },
);

const hasPage = computed(() => Boolean(page.value));
const pageJob = computed(() => page.value?.blogArticleGenerationJob ?? null);
const shouldPollJob = computed(() =>
  Boolean(pageJob.value) &&
  (["waiting", "active", "delayed"].includes(pageJob.value.state) ||
    (pageJob.value.state === "completed" && !page.value?.blogArticle)),
);
const hasChanges = computed(() => {
  if (!page.value) {
    return false;
  }

  return (
    draftTitle.value.trim() !== (page.value.title ?? "").trim() ||
    draftSlug.value.trim() !== (page.value.slug ?? "") ||
    draftStatus.value !== (page.value.status ?? "DRAFT")
  );
});

const canSave = computed(
  () => Boolean(draftTitle.value.trim()) && hasChanges.value && !isSaving.value,
);

async function handleSave() {
  if (!page.value || isSaving.value) {
    return;
  }

  const normalizedTitle = draftTitle.value.trim();

  if (!normalizedTitle) {
    showErrorToast(
      "Titre requis",
      "Le titre de la page ne peut pas être vide.",
    );
    return;
  }

  isSaving.value = true;

  try {
    const updatedPage = await updatePage(pageId.value, {
      title: normalizedTitle,
      slug: draftSlug.value.trim() || null,
      status: draftStatus.value,
    });

    page.value = updatedPage;
    draftTitle.value = updatedPage.title ?? "";
    draftSlug.value = updatedPage.slug ?? "";
    draftStatus.value = updatedPage.status ?? "DRAFT";

    showSuccessToast(
      "Page enregistrée",
      "Les modifications ont bien été sauvegardées.",
    );
  } catch (error: any) {
    showErrorToast(
      "Impossible d'enregistrer la page",
      error?.message || "Une erreur inattendue est survenue.",
    );
  } finally {
    isSaving.value = false;
  }
}

async function handleDelete() {
  if (!page.value || isDeleting.value) {
    return;
  }

  const confirmed = window.confirm(
    `Supprimer définitivement la page "${page.value.title}" ?\n\nLes mots-clés seront détachés de cette page, mais resteront en base.`,
  );

  if (!confirmed) {
    return;
  }

  isDeleting.value = true;

  try {
    await deletePage(pageId.value);
    showSuccessToast(
      "Page supprimée",
      "La page a été déplacée à la corbeille.",
    );
    await navigateTo("/pages");
  } catch (error: any) {
    showErrorToast(
      "Impossible de supprimer la page",
      error?.message || "Une erreur inattendue est survenue.",
    );
  } finally {
    isDeleting.value = false;
  }
}

function getStatusLabel(statusValue: PageStatus) {
  return pageStatusLabels[statusValue] ?? statusValue;
}

function getJobStateLabel(state?: string | null) {
  if (!state) {
    return "Inconnu";
  }

  return (
    {
      waiting: "En attente",
      active: "En cours",
      delayed: "Différé",
      completed: "Terminé",
      failed: "En erreur",
      paused: "En pause",
    }[state] ?? state
  );
}

function getJobStateColor(state?: string | null) {
  if (!state) {
    return "neutral";
  }

  return (
    {
      waiting: "info",
      delayed: "info",
      active: "warning",
      completed: "success",
      failed: "error",
      paused: "neutral",
    }[state] ?? "neutral"
  );
}

function formatJobTimestamp(value?: number | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

watch(
  shouldPollJob,
  (shouldPoll) => {
    if (jobRefreshTimer) {
      clearInterval(jobRefreshTimer);
      jobRefreshTimer = null;
    }

    if (shouldPoll) {
      jobRefreshTimer = setInterval(() => {
        void refresh();
      }, 5000);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (jobRefreshTimer) {
    clearInterval(jobRefreshTimer);
    jobRefreshTimer = null;
  }
});

async function handleRegenerateArticle() {
  if (!page.value || isRegenerating.value) {
    return;
  }

  isRegenerating.value = true;

  try {
    const updatedPage = await regeneratePageArticle(pageId.value);
    page.value = updatedPage;

    showSuccessToast(
      "Génération relancée",
      "La queue Bull de génération d'article a bien été relancée.",
    );
  } catch (error: any) {
    showErrorToast(
      "Impossible de relancer la génération",
      error?.message || "Une erreur inattendue est survenue.",
    );
  } finally {
    isRegenerating.value = false;
  }
}
</script>

<template>
  <section class="space-y-6">
    <header
      class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
    >
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900">
          {{ page?.pageType && pageTypeLabels[page.pageType] }}
          {{ page?.title ?? "Page" }}
        </h1>
        <p class="text-sm text-slate-500">
          Détails de la page et mots-clés associés.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-external-link"
          :to="shopifyPageUrl"
          external
          target="_blank"
          :disabled="!shopifyPageUrl"
        >
          Voir sur Shopify
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

        <UButton
          color="red"
          variant="soft"
          icon="i-lucide-trash-2"
          :loading="isDeleting"
          :disabled="!page"
          @click="handleDelete"
        >
          Supprimer la page
        </UButton>
      </div>
    </header>

    <FeedbackInlineMessage
      v-if="status === 'pending' && !hasPage"
      class="animate-pulse"
      tone="info"
    >
      Chargement de la page...
    </FeedbackInlineMessage>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :details="error.toString()"
      title="Impossible de charger la page"
      description="La page demandée n’a pas pu être récupérée."
      action-label="Réessayer"
      @action="refresh()"
    />

    <div v-else-if="page" class="space-y-6">
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p
            class="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Type
          </p>
          <p class="mt-2 text-sm font-medium text-slate-900">
            {{ pageTypeLabels[page.pageType] }}
          </p>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p
            class="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Rôle SEO
          </p>
          <p class="mt-2 text-sm font-medium text-slate-900">
            {{ seoRoleLabels[page.seoRole] }}
          </p>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p
            class="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Intent
          </p>
          <p class="mt-2 text-sm font-medium text-slate-900">
            {{
              page.searchIntent ? searchIntentLabels[page.searchIntent] : "-"
            }}
          </p>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p
            class="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            URL
          </p>
          <NuxtLink
            :to="shopifyPageUrl"
            external
            class="mt-2 block break-all text-sm font-medium text-sky-700 underline decoration-transparent underline-offset-4 transition hover:decoration-sky-300"
          >
            {{ shopifyPageUrl }}
          </NuxtLink>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-slate-900">Métadonnées</h2>
            <p class="text-sm text-slate-500">
              Modifie le titre, le slug et le statut de la page.
            </p>
          </div>

          <UBadge color="neutral" variant="soft">
            {{ getStatusLabel(draftStatus) }}
          </UBadge>
        </div>

        <div class="mt-5 grid gap-4 lg:grid-cols-3">
          <label class="block space-y-2 text-sm font-medium text-slate-700">
            <span class="block">Title</span>
            <UInput v-model="draftTitle" placeholder="Titre de la page" />
          </label>

          <label class="block space-y-2 text-sm font-medium text-slate-700">
            <span class="block">Slug</span>
            <UInput v-model="draftSlug" placeholder="slug-de-la-page" />
          </label>

          <label class="block space-y-2 text-sm font-medium text-slate-700">
            <span class="block">PageStatus</span>
            <select
              v-model="draftStatus"
              class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
            >
              <option
                v-for="option in pageStatusOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>

        <div
          class="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="text-sm text-slate-500">
            {{
              hasChanges
                ? "Des modifications sont en attente."
                : "Aucun changement à enregistrer."
            }}
          </p>

          <UButton
            color="primary"
            icon="i-lucide-save"
            :loading="isSaving"
            :disabled="!canSave"
            @click="handleSave"
          >
            Sauvegarder les changements
          </UButton>
        </div>
      </div>

      <div
        v-if="pageJob"
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-slate-900">
              Job de génération d'article
            </h2>
            <p class="text-sm text-slate-500">
              État du job Bull attaché à cette page.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <UBadge
              :color="getJobStateColor(pageJob.state)"
              variant="soft"
            >
              {{ getJobStateLabel(pageJob.state) }}
            </UBadge>

            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-rotate-ccw"
              :loading="isRegenerating"
              @click="handleRegenerateArticle"
            >
              Relancer la génération
            </UButton>
          </div>
        </div>

        <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Queue
            </p>
            <p class="mt-2 text-sm font-medium text-slate-900">
              {{ pageJob.queueName }}
            </p>
          </div>

          <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Job ID
            </p>
            <p class="mt-2 break-all text-sm font-medium text-slate-900">
              {{ pageJob.id }}
            </p>
          </div>

          <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Début
            </p>
            <p class="mt-2 text-sm font-medium text-slate-900">
              {{ formatJobTimestamp(pageJob.timestamp) }}
            </p>
          </div>

          <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Fin
            </p>
            <p class="mt-2 text-sm font-medium text-slate-900">
              {{ formatJobTimestamp(pageJob.finishedOn) }}
            </p>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-slate-500">
            Tentatives: {{ pageJob.attemptsMade }} · Traitement:
            {{ formatJobTimestamp(pageJob.processedOn) }}
          </p>

          <a
            :href="bullDashboardUrl"
            target="_blank"
            rel="noreferrer"
            class="text-sm font-medium text-sky-600 underline underline-offset-2 transition hover:text-sky-700"
          >
            Ouvrir Bull Dashboard
          </a>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-lg font-semibold text-slate-900">
            Mots-clés associés
          </h2>
          <UBadge color="neutral" variant="soft">
            {{ page.keywords.length }} mot-clé(s)
          </UBadge>
        </div>

        <ul
          v-if="page.keywords.length"
          class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3"
        >
          <li
            v-for="keyword in page.keywords"
            :key="keyword.id"
            class="rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="space-y-1">
                <NuxtLink
                  :to="`/keywords/research?q=${encodeURIComponent(keyword.keyword)}&autorun=0`"
                  class="font-semibold text-slate-900 underline decoration-transparent underline-offset-4 transition hover:decoration-slate-300"
                >
                  {{ keyword.keyword }}
                </NuxtLink>

                <p v-if="keyword.keywordGroup" class="text-xs text-slate-500">
                  Groupe :
                  <span class="font-medium text-slate-700">
                    {{ keyword.keywordGroup.name }}
                  </span>
                </p>

                <p
                  v-if="keyword.keywordGroup?.description"
                  class="max-w-2xl text-xs leading-5 text-slate-500"
                >
                  {{ keyword.keywordGroup.description }}
                </p>
              </div>

              <UBadge
                v-if="keyword.template"
                color="info"
                variant="soft"
                class="shrink-0"
              >
                {{ pageTypeLabels[keyword.template] }}
              </UBadge>
            </div>

            <div
              class="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500"
            >
              <span v-if="keyword.volume !== null"
                >Vol. {{ keyword.volume }}</span
              >
              <span v-if="keyword.difficulty !== null"
                >Diff. {{ keyword.difficulty }}</span
              >
              <span v-if="keyword.searchIntent">
                {{ searchIntentLabels[keyword.searchIntent] }}
              </span>
            </div>
          </li>
        </ul>

        <FeedbackInlineMessage v-else tone="info" class="mt-4">
          Aucun mot-clé associé pour le moment.
        </FeedbackInlineMessage>
      </div>

      <div
        v-if="page.blogArticle"
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-slate-900">
              Article généré
            </h2>
            <p class="text-sm text-slate-500">
              Article associé à cette page.
            </p>
          </div>

          <UBadge color="neutral" variant="soft">
            {{ page.blogArticle.status ?? "DRAFT" }}
          </UBadge>
        </div>

        <div class="mt-4 space-y-4">
          <NuxtLink
            :to="`/articles/${page.blogArticle.id}`"
            class="block rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-sky-300 hover:bg-sky-50/60"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="space-y-1">
                <p class="text-sm font-semibold text-slate-900">
                  {{ page.blogArticle.title }}
                </p>
                <p
                  v-if="page.blogArticle.seoTitle"
                  class="text-xs text-slate-500"
                >
                  SEO title: {{ page.blogArticle.seoTitle }}
                </p>
              </div>

              <span class="text-xs font-medium text-sky-700">
                Voir l’article
              </span>
            </div>
          </NuxtLink>

          <p v-if="page.blogArticle.excerpt" class="text-sm text-slate-600">
            {{ page.blogArticle.excerpt }}
          </p>

          <div class="flex flex-wrap gap-2 text-xs text-slate-500">
            <span v-if="page.blogArticle.primaryKeyword">
              Mot-clé principal :
              <span class="font-medium text-slate-700">
                {{ page.blogArticle.primaryKeyword }}
              </span>
            </span>
            <span v-if="page.blogArticle.requiredKeywords">
              Mots-clés requis :
              <span class="font-medium text-slate-700">
                {{ page.blogArticle.requiredKeywords }}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
