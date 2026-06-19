<script setup lang="ts">
import DashboardPagesInReviewSection from "~/components/dashboard/DashboardPagesInReviewSection.vue";
import {
  filterPagesInReview,
  filterPagesInReviewAssignedToUser,
} from "~/utils/page-review";
import type { PageListRecord } from "~/types/pages";

const { listPages } = usePages();
const { user } = useSupabaseAuth();

const {
  data: pages,
  error,
  status,
  refresh,
} = await useAsyncData("pages:review:list", () => listPages(), {
  default: () => [],
});

const currentUserId = computed(() => user.value?.id ?? null);
const showOnlyMyReviews = ref(true);

const pendingReviewPages = computed(() =>
  filterPagesInReview(pages.value ?? []),
);

const assignedReviewPages = computed(() =>
  filterPagesInReviewAssignedToUser(pages.value ?? [], currentUserId.value),
);

const reviewPages = computed(() =>
  showOnlyMyReviews.value ? assignedReviewPages.value : pendingReviewPages.value,
);

const breadcrumbItems = [
  {
    label: "Accueil",
    to: "/",
  },
  {
    label: "Reviews",
  },
];

const hasPages = computed(() => reviewPages.value.length > 0);

function isPageDraft(page: PageListRecord) {
  return page.status === "DRAFT";
}

const draftPagesCount = computed(
  () => reviewPages.value.filter((page) => isPageDraft(page)).length,
);

const pagesLabel = computed(() =>
  showOnlyMyReviews.value ? "Reviews assignées" : "Pages visibles",
);

const emptyDescription = computed(() =>
  showOnlyMyReviews.value
    ? "Dès qu’une page te sera attribuée en review, elle apparaîtra ici."
    : "Aucune page de review n’est disponible pour le moment.",
);
</script>

<template>
  <section class="space-y-6">
    <UBreadcrumb :items="breadcrumbItems" class="text-slate-500" />

    <header class="space-y-3">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
        Review
      </p>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="space-y-2">
          <h1 class="text-3xl font-semibold text-slate-900">
            Pages en review
          </h1>
          <p class="max-w-3xl text-sm leading-6 text-slate-500">
            Retrouve ici les pages dont la review t'a été assignée avant
            publication ou validation finale.
          </p>
        </div>

        <label
          class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm"
        >
          <span class="font-medium">Mes reviews seulement</span>
          <USwitch v-model="showOnlyMyReviews" />
        </label>
      </div>
    </header>

    <p v-if="status === 'pending' && !hasPages" class="text-sm text-slate-500">
      Chargement des pages en review...
    </p>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :details="error.toString()"
      title="Impossible de charger les pages"
      description="La liste des pages en review n’a pas pu être récupérée."
      action-label="Réessayer"
      @action="refresh()"
    />

    <template v-else>
      <div class="grid gap-4 md:grid-cols-3">
        <article class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-sm text-slate-500">{{ pagesLabel }}</p>
          <p class="mt-2 text-3xl font-semibold text-slate-900">
            {{ reviewPages.length }}
          </p>
        </article>

        <article class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-sm text-slate-500">Brouillons</p>
          <p class="mt-2 text-3xl font-semibold text-slate-900">
            {{ draftPagesCount }}
          </p>
        </article>

        <article class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-sm text-slate-500">Total chargé</p>
          <p class="mt-2 text-3xl font-semibold text-slate-900">
            {{ pages?.length ?? 0 }}
          </p>
        </article>
      </div>

      <DashboardPagesInReviewSection
        :pages="reviewPages"
        :empty-title="'Aucune review ne t’est assignée'"
        :empty-description="emptyDescription"
      />
    </template>
  </section>
</template>
