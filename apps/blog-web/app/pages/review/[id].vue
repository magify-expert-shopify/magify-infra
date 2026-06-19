<script setup lang="ts">
import CustomElementHtmlRenderer from "~/components/content/CustomElementHtmlRenderer.vue";
import { blogArticleStatusLabels } from "~/constants/blog-articles";
import { useAppToast } from "~/composables/useAppToast";
import { useBlogArticles } from "~/composables/useBlogArticles";
import type { PageDetailRecord } from "~/types/pages";

const route = useRoute();
const { getPage } = usePages();
const { setBlogArticleReviewStatus } = useBlogArticles();
const { showErrorToast, showSuccessToast } = useAppToast();

const pageId = computed(() => String(route.params.id ?? ""));

const {
  data: page,
  error,
  status,
  refresh,
} = await useAsyncData<PageDetailRecord | null>(
  () => `review-page:${pageId.value}`,
  () => getPage(pageId.value),
  {
    watch: [pageId],
    default: () => null,
  },
);

const reviewComment = ref("");
const isSavingDecision = ref(false);

const breadcrumbItems = computed(() => [
  {
    label: "Accueil",
    to: "/",
  },
  {
    label: "Reviews",
    to: "/review",
  },
  {
    label: page.value?.title || "Détail",
  },
]);

const blogArticle = computed(() => page.value?.blogArticle ?? null);
const isReviewCompleted = computed(
  () => Boolean(blogArticle.value?.reviewCompletedAt),
);
const reviewOutcomeLabel = computed(() => {
  if (blogArticle.value?.reviewOutcome === "APPROVED") {
    return "Validée";
  }

  if (blogArticle.value?.reviewOutcome === "REJECTED") {
    return "Rejetée";
  }

  return "En attente";
});

const reviewBadgeColor = computed(() => {
  if (blogArticle.value?.reviewOutcome === "APPROVED") {
    return "success";
  }

  if (blogArticle.value?.reviewOutcome === "REJECTED") {
    return "error";
  }

  return "warning";
});

const pageTypeLabel = computed(() => {
  const pageType = page.value?.pageType;
  return pageType ? pageType.replaceAll("_", " ") : "Page";
});

function getBlogArticleStatusLabel(status?: string | null) {
  if (!status) {
    return "-";
  }

  return blogArticleStatusLabels[status as keyof typeof blogArticleStatusLabels] ?? status;
}

const canReview = computed(
  () => Boolean(blogArticle.value?.id) && !isReviewCompleted.value,
);

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function submitReview(outcome: "APPROVED" | "REJECTED") {
  const comment = reviewComment.value.trim();

  if (!blogArticle.value?.id) {
    showErrorToast("Aucun article n'est associé à cette page.");
    return;
  }

  if (outcome === "REJECTED" && !comment) {
    showErrorToast("Ajoute un commentaire avant de finaliser la review.");
    return;
  }

  try {
    isSavingDecision.value = true;
    await setBlogArticleReviewStatus(blogArticle.value.id, {
      isReviewCompleted: true,
      reviewOutcome: outcome,
      reviewComment: comment || null,
    });
    await refresh();

    showSuccessToast(
      outcome === "APPROVED" ? "Review validée" : "Review rejetée",
      outcome === "APPROVED"
        ? "La review a bien été marquée comme effectuée."
        : "Le commentaire a bien été enregistré et la review a été marquée comme effectuée.",
    );
  } catch (saveError) {
    showErrorToast(
      outcome === "APPROVED"
        ? "Impossible de valider la review"
        : "Impossible de rejeter la review",
      saveError instanceof Error
        ? saveError.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    isSavingDecision.value = false;
  }
}
</script>

<template>
  <section class="space-y-6">
    <UBreadcrumb :items="breadcrumbItems" class="text-slate-500" />

    <p v-if="status === 'pending' && !page" class="text-sm text-slate-500">
      Chargement de la review...
    </p>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :details="error.toString()"
      title="Impossible de charger la review"
      description="La page à relire n’a pas pu être récupérée."
      action-label="Réessayer"
      @action="refresh()"
    />

    <template v-else-if="page">
      <header class="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
              Review
            </p>
            <h1 class="text-3xl font-semibold text-slate-900">
              {{ page.title }}
            </h1>
            <p class="max-w-4xl text-sm leading-6 text-slate-500">
              {{ page.url }}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <UBadge color="neutral" variant="soft">
              {{ pageTypeLabel }}
            </UBadge>
            <UBadge :color="reviewBadgeColor" variant="soft">
              {{ reviewOutcomeLabel }}
            </UBadge>
          </div>
        </div>

        <div class="grid gap-3 text-sm text-slate-600 md:grid-cols-3">
          <div class="rounded-2xl bg-slate-50 px-4 py-3">
            <p class="text-xs uppercase tracking-wide text-slate-400">
              Cluster
            </p>
            <p class="mt-1 font-medium text-slate-900">
              {{ page.cluster?.name || "Sans cluster" }}
            </p>
          </div>

          <div class="rounded-2xl bg-slate-50 px-4 py-3">
            <p class="text-xs uppercase tracking-wide text-slate-400">
              Review assignée à
            </p>
            <p class="mt-1 font-medium text-slate-900">
              {{
                blogArticle?.reviewSupabaseUser?.displayName ||
                blogArticle?.reviewSupabaseUser?.email ||
                "Non renseigné"
              }}
            </p>
          </div>

          <div class="rounded-2xl bg-slate-50 px-4 py-3">
            <p class="text-xs uppercase tracking-wide text-slate-400">
              Date de review
            </p>
            <p class="mt-1 font-medium text-slate-900">
              {{ formatDate(blogArticle?.reviewDueAt) }}
            </p>
          </div>
        </div>
      </header>

      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div class="space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div class="space-y-1">
                <h2 class="text-lg font-semibold text-slate-900">
                  Aperçu de la page
                </h2>
                <p class="text-sm text-slate-500">
                  {{
                    blogArticle
                      ? "Aperçu de l’article associé à cette page."
                      : "Cette page n’a pas encore d’article associé."
                  }}
                </p>
              </div>

              <UButton
                v-if="blogArticle"
                :to="`/articles/${blogArticle.id}`"
                color="neutral"
                variant="soft"
                icon="i-lucide-external-link"
              >
                Ouvrir l’article
              </UButton>
            </div>

            <div class="mx-auto w-full max-w-[900px]">
              <div v-if="blogArticle?.content?.trim()" class="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <CustomElementHtmlRenderer
                  :html="blogArticle.content"
                  content-class="editor-preview-content prose prose-slate max-w-none"
                />
              </div>

              <div
                v-else-if="blogArticle?.excerpt?.trim()"
                class="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm leading-6 text-slate-600"
              >
                {{ blogArticle.excerpt }}
              </div>

              <div
                v-else
                class="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500"
              >
                Aucun contenu de prévisualisation n’est disponible pour cette page.
              </div>
            </div>
          </div>
        </section>

        <aside class="space-y-6">
          <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div class="space-y-2">
              <h2 class="text-lg font-semibold text-slate-900">
                Décision de review
              </h2>
              <p class="text-sm text-slate-500">
                Ajoute ton commentaire puis valide ou rejette le travail.
              </p>
            </div>

            <div v-if="isReviewCompleted" class="mt-5 space-y-3">
              <UAlert
                color="success"
                variant="soft"
                title="Review effectuée"
                description="Cette review a déjà été marquée comme terminée."
              />

              <div class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <p class="text-xs uppercase tracking-wide text-slate-400">
                  Verdict
                </p>
                <p class="mt-1 font-medium text-slate-900">
                  {{ reviewOutcomeLabel }}
                </p>
              </div>

              <div
                v-if="blogArticle?.reviewComment"
                class="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
              >
                <p class="text-xs uppercase tracking-wide text-slate-400">
                  Commentaire
                </p>
                <p class="mt-1 whitespace-pre-wrap">
                  {{ blogArticle.reviewComment }}
                </p>
              </div>
            </div>

            <div v-else class="mt-5 space-y-4">
              <label class="block space-y-2">
                <span class="text-sm font-medium text-slate-700">
                  Commentaire
                  <span class="text-slate-400">(facultatif pour valider)</span>
                </span>
                <textarea
                  v-model="reviewComment"
                  rows="7"
                  class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                  placeholder="Explique ce qui va, ce qui doit être corrigé, ou pourquoi tu rejettes la review."
                />
              </label>

              <div class="flex flex-col gap-3 sm:flex-row">
                <UButton
                  color="primary"
                  variant="solid"
                  icon="i-lucide-check"
                  :loading="isSavingDecision"
                  :disabled="!canReview"
                  @click="submitReview('APPROVED')"
                >
                  Valider
                </UButton>

                <UButton
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-x"
                  :loading="isSavingDecision"
                  :disabled="!canReview"
                  @click="submitReview('REJECTED')"
                >
                  Rejeter
                </UButton>
              </div>
            </div>
          </section>

          <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 class="text-lg font-semibold text-slate-900">
              Informations
            </h2>

            <dl class="mt-4 space-y-4 text-sm">
              <div class="space-y-1">
                <dt class="font-medium text-slate-700">Statut article</dt>
                <dd class="text-slate-600">
                  {{ getBlogArticleStatusLabel(blogArticle?.status) }}
                </dd>
              </div>

              <div class="space-y-1">
                <dt class="font-medium text-slate-700">Review complétée</dt>
                <dd class="text-slate-600">
                  {{ blogArticle?.reviewCompletedAt ? formatDate(blogArticle.reviewCompletedAt) : "-" }}
                </dd>
              </div>

              <div class="space-y-1">
                <dt class="font-medium text-slate-700">Mot-clé principal</dt>
                <dd class="text-slate-600">
                  {{ blogArticle?.primaryKeyword || "-" }}
                </dd>
              </div>
            </dl>

            <div class="mt-5">
              <UButton
                to="/review"
                color="neutral"
                variant="ghost"
                icon="i-lucide-arrow-left"
              >
                Retour à la liste
              </UButton>
            </div>
          </section>
        </aside>
      </div>
    </template>
  </section>
</template>

<style scoped>
:deep(.editor-preview-content) {
  line-height: 1.75;
}

:deep(.editor-preview-content .details-element) {
  border: 1px solid #cbd5e1;
  border-radius: 1rem;
  margin: 1.25rem 0;
  padding: 1rem 1.1rem;
}

:deep(.editor-preview-content .details-element__summary) {
  cursor: pointer;
  font-weight: 700;
  color: #0f172a;
}

:deep(.editor-preview-content .details-element__content) {
  color: #334155;
  margin-top: 0.75rem;
}

:deep(.editor-preview-content .editor-figure-image) {
  margin: 1.25rem 0;
}

:deep(.editor-preview-content .editor-figure-image__img) {
  display: block;
  height: auto;
  width: 100%;
}

:deep(.editor-preview-content .editor-figure-image__caption) {
  color: #64748b;
  font-size: 0.875rem;
  line-height: 1.6;
  margin-top: 0.5rem;
  text-align: center;
}

:deep(.editor-preview-content h1) {
  font-size: 2.25rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.1;
  margin: 2rem 0 1rem;
}

:deep(.editor-preview-content h2) {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  margin-top: 2rem;
}

:deep(.editor-preview-content h3) {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  margin-top: 2rem;
}

:deep(.editor-preview-content h4) {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 1rem;
  margin-top: 2rem;
}

:deep(.editor-preview-content h5) {
  font-size: 1.125rem;
  font-weight: 700;
  margin-bottom: 0.85rem;
  margin-top: 1.75rem;
}

:deep(.editor-preview-content h6) {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.85rem;
  margin-top: 1.5rem;
  text-transform: uppercase;
}

:deep(.editor-preview-content blockquote) {
  border-left: 4px solid #cbd5e1;
  color: #475569;
  font-style: italic;
  margin: 1.5rem 0;
  padding-left: 1rem;
}

:deep(.editor-preview-content pre) {
  background: #0f172a;
  border-radius: 1rem;
  color: #e2e8f0;
  margin: 1.5rem 0;
  overflow-x: auto;
  padding: 1.1rem 1.25rem;
}

:deep(.editor-preview-content pre code) {
  background: transparent;
  color: inherit;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  padding: 0;
}

:deep(.editor-preview-content .editor-callout-aside),
:deep(.editor-preview-content .editor-info-aside) {
  border-radius: 1rem;
  margin: 1.5rem 0;
  padding: 1rem 1.25rem;
}

:deep(.editor-preview-content .editor-callout-aside--info),
:deep(.editor-preview-content .editor-info-aside) {
  background: #eff6ff;
  border: 1px solid #93c5fd;
  border-left: 4px solid #2563eb;
  color: #1e3a8a;
}

:deep(.editor-preview-content .editor-callout-aside--warning) {
  background: #fff7ed;
  border: 1px solid #fdba74;
  border-left: 4px solid #ea580c;
  color: #9a3412;
}

:deep(.editor-preview-content .editor-callout-aside--success) {
  background: #ecfdf5;
  border: 1px solid #86efac;
  border-left: 4px solid #16a34a;
  color: #166534;
}

:deep(.editor-preview-content .editor-callout-aside--tip) {
  background: #f5f3ff;
  border: 1px solid #c4b5fd;
  border-left: 4px solid #7c3aed;
  color: #5b21b6;
}

:deep(.editor-preview-content .editor-callout-aside p),
:deep(.editor-preview-content .editor-info-aside p) {
  margin: 0;
}

:deep(.editor-preview-content .editor-callout-box) {
  background: var(--editor-callout-box-background-color, #f8fafc);
  border-left: 5px solid var(--editor-callout-box-border-color, #cbd5e1);
  margin: 1.5rem 0;
  padding: 1rem 1.25rem;
}

:deep(.editor-preview-content .editor-callout-box p) {
  margin: 0;
}

:deep(.editor-preview-content ul),
:deep(.editor-preview-content ol) {
  margin: 1rem 0;
  padding-left: 1.5rem;
}

:deep(.editor-preview-content ul) {
  list-style-type: disc;
}

:deep(.editor-preview-content ol) {
  list-style-type: decimal;
}

:deep(.editor-preview-content li) {
  margin: 0.4rem 0;
}

:deep(.editor-preview-content .editor-table),
:deep(.editor-preview-content table) {
  border-collapse: collapse;
  margin: 1.5rem 0;
  width: 100%;
}

:deep(.editor-preview-content table td),
:deep(.editor-preview-content table th) {
  border: 1px solid #cbd5e1;
  padding: 0.75rem 0.9rem;
  vertical-align: top;
}

:deep(.editor-preview-content table th) {
  background: #f8fafc;
  font-weight: 700;
}

:deep(.editor-preview-content .editor-video-embed) {
  margin: 1.5rem 0;
  overflow: hidden;
  padding-top: 56.25%;
  position: relative;
}

:deep(.editor-preview-content .editor-video-embed iframe) {
  border: 0;
  inset: 0;
  height: 100%;
  position: absolute;
  width: 100%;
}
</style>
