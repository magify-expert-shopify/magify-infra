<script setup lang="ts">
import { pageTypeLabels } from "~/constants/pages";
import { useAppToast } from "~/composables/useAppToast";
import { useBlogArticles } from "~/composables/useBlogArticles";
import { usePages } from "~/composables/usePages";
import { useShopify } from "~/composables/useShopify";
import type { BlogArticle } from "~/types/domain";
import type { PageListRecord } from "~/types/pages";
import type { KeywordGroupSuggestionRecord, KeywordPageType } from "~/types/keywords";
import type { ShopifyBlogArticleListItem, ShopifyPageListItem } from "~/types/shopify";
import { normalizeSearchText } from "~/utils/search-normalizer";

const props = defineProps<{
  open: boolean;
  suggestion: KeywordGroupSuggestionRecord;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  associated: [payload: { suggestionId: string; pageId: string; pageTitle: string }];
}>();

const { listPages, associateExistingPageFromSuggestionGroup } = usePages();
const { listBlogArticles } = useBlogArticles();
const { getPages, getBlogArticlesList } = useShopify();
const { showErrorToast, showSuccessToast } = useAppToast();

const searchQuery = ref("");
const selectedSource = ref<"local" | "shopify" | "blogArticle" | "shopifyArticle" | null>(null);
const selectedLocalPageId = ref("");
const selectedShopifyPageId = ref("");
const selectedBlogArticleId = ref("");
const selectedShopifyArticleId = ref("");
const allLocalPages = ref<PageListRecord[]>([]);
const allShopifyPages = ref<ShopifyPageListItem[]>([]);
const allBlogArticles = ref<BlogArticle[]>([]);
const allShopifyBlogArticles = ref<ShopifyBlogArticleListItem[]>([]);
const isLoadingLocalPages = ref(false);
const isLoadingShopifyPages = ref(false);
const isLoadingBlogArticles = ref(false);
const isLoadingShopifyBlogArticles = ref(false);
const hasLoadedSources = ref(false);
const isSubmitting = ref(false);

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit("update:open", value),
});

const templateTypes = computed(() =>
  [
    ...new Set(
      props.suggestion.keywords
        .map((keyword) => keyword.template)
        .filter(Boolean),
    ),
  ].filter((template): template is KeywordPageType => Boolean(template)),
);

const targetPageType = computed<KeywordPageType | null>(
  () => templateTypes.value[0] ?? null,
);

const search = computed(() => normalizeSearchText(searchQuery.value));

const filteredLocalPages = computed(() =>
  (allLocalPages.value ?? [])
    .filter((page) => {
      if (!search.value) {
        return true;
      }

      return normalizeSearchText(
        [page.title, page.url, page.slug ?? "", page.cluster?.name ?? ""]
          .join(" ")
          .trim(),
      ).includes(search.value);
    })
    .slice(0, 12),
);

const filteredShopifyPages = computed(() =>
  (allShopifyPages.value ?? [])
    .filter((page) => {
      if (!search.value) {
        return true;
      }

      return normalizeSearchText(
        [page.title, page.handle, `/pages/${page.handle}`].join(" ").trim(),
      ).includes(search.value);
    })
    .slice(0, 12),
);

const filteredBlogArticles = computed(() =>
  (allBlogArticles.value ?? [])
    .filter((article) => !article.pageId)
    .filter((article) => {
      if (!search.value) {
        return true;
      }

      return normalizeSearchText(
        [
          article.title,
          article.url ?? "",
          article.slug ?? "",
          article.primaryKeyword ?? "",
          article.blog?.title ?? article.blog?.name ?? "",
        ]
          .join(" ")
          .trim(),
      ).includes(search.value);
    })
    .slice(0, 12),
);

const filteredShopifyBlogArticles = computed(() =>
  (allShopifyBlogArticles.value ?? [])
    .filter((article) => !article.associatedBlogArticle?.pageId)
    .filter((article) => {
      if (!search.value) {
        return true;
      }

      return normalizeSearchText(
        [
          article.title,
          article.handle,
          article.blog?.title ?? "",
          article.blog?.handle ?? "",
          article.associatedBlogArticle?.title ?? "",
        ]
          .join(" ")
          .trim(),
      ).includes(search.value);
    })
    .slice(0, 12),
);

const selectedLocalPage = computed(
  () =>
    allLocalPages.value.find((page) => page.id === selectedLocalPageId.value) ??
    null,
);

const selectedShopifyPage = computed(
  () =>
    allShopifyPages.value.find((page) => page.id === selectedShopifyPageId.value) ??
    null,
);

const selectedBlogArticle = computed(
  () =>
    allBlogArticles.value.find(
      (article) => article.id === selectedBlogArticleId.value,
    ) ?? null,
);

const selectedShopifyBlogArticle = computed(
  () =>
    allShopifyBlogArticles.value.find(
      (article) => article.id === selectedShopifyArticleId.value,
    ) ?? null,
);

async function ensureSourcesLoaded() {
  if (hasLoadedSources.value) {
    return;
  }

  try {
    isLoadingLocalPages.value = true;
    isLoadingShopifyPages.value = true;
    isLoadingBlogArticles.value = true;
    isLoadingShopifyBlogArticles.value = true;
    const [localPages, shopifyPages, blogArticles, shopifyBlogArticles] = await Promise.all([
      listPages(),
      getPages(),
      listBlogArticles(),
      getBlogArticlesList({ includeAssociatedBlogArticle: true }),
    ]);
    allLocalPages.value = localPages;
    allShopifyPages.value = shopifyPages;
    allBlogArticles.value = blogArticles;
    allShopifyBlogArticles.value = shopifyBlogArticles;
    hasLoadedSources.value = true;
  } finally {
    isLoadingLocalPages.value = false;
    isLoadingShopifyPages.value = false;
    isLoadingBlogArticles.value = false;
    isLoadingShopifyBlogArticles.value = false;
  }
}

function resetSelectionState() {
  searchQuery.value = "";
  selectedSource.value = null;
  selectedLocalPageId.value = "";
  selectedShopifyPageId.value = "";
  selectedBlogArticleId.value = "";
  selectedShopifyArticleId.value = "";
}

function closeModal() {
  openModel.value = false;
}

function selectLocalPage(page: PageListRecord) {
  selectedSource.value = "local";
  selectedLocalPageId.value = page.id;
  selectedShopifyPageId.value = "";
  selectedBlogArticleId.value = "";
  selectedShopifyArticleId.value = "";
}

function selectShopifyPage(page: ShopifyPageListItem) {
  selectedSource.value = "shopify";
  selectedShopifyPageId.value = page.id;
  selectedLocalPageId.value = "";
  selectedBlogArticleId.value = "";
  selectedShopifyArticleId.value = "";
}

function selectBlogArticle(article: BlogArticle) {
  selectedSource.value = "blogArticle";
  selectedBlogArticleId.value = article.id;
  selectedLocalPageId.value = "";
  selectedShopifyPageId.value = "";
  selectedShopifyArticleId.value = "";
}

function selectShopifyBlogArticle(article: ShopifyBlogArticleListItem) {
  selectedSource.value = "shopifyArticle";
  selectedShopifyArticleId.value = article.id;
  selectedLocalPageId.value = "";
  selectedShopifyPageId.value = "";
  selectedBlogArticleId.value = "";
}

function isLocalPageSelected(pageId: string) {
  return selectedSource.value === "local" && selectedLocalPageId.value === pageId;
}

function isShopifyPageSelected(pageId: string) {
  return (
    selectedSource.value === "shopify" && selectedShopifyPageId.value === pageId
  );
}

function isBlogArticleSelected(articleId: string) {
  return (
    selectedSource.value === "blogArticle" &&
    selectedBlogArticleId.value === articleId
  );
}

function isShopifyBlogArticleSelected(articleId: string) {
  return (
    selectedSource.value === "shopifyArticle" &&
    selectedShopifyArticleId.value === articleId
  );
}

async function handleAssociate() {
  if (isSubmitting.value || !targetPageType.value) {
    return;
  }

  if (selectedSource.value === "local" && selectedLocalPage.value) {
    try {
      isSubmitting.value = true;
      const page = await associateExistingPageFromSuggestionGroup(
        props.suggestion.id,
        {
          pageType: targetPageType.value,
          pageId: selectedLocalPage.value.id,
        },
      );

      showSuccessToast(
        "Page associée",
        `${selectedLocalPage.value.title} est maintenant liée à cette suggestion.`,
      );
      emit("associated", {
        suggestionId: props.suggestion.id,
        pageId: page.id,
        pageTitle: page.title,
      });
      closeModal();
    } catch (error) {
      showErrorToast(
        "Impossible d’associer la page",
        error instanceof Error
          ? error.message
          : "Une erreur inattendue est survenue.",
      );
    } finally {
      isSubmitting.value = false;
    }

    return;
  }

  if (selectedSource.value === "shopify" && selectedShopifyPage.value) {
    try {
      isSubmitting.value = true;
      const page = await associateExistingPageFromSuggestionGroup(
        props.suggestion.id,
        {
          pageType: targetPageType.value,
          shopifyPageId: selectedShopifyPage.value.id,
          title: selectedShopifyPage.value.title,
          handle: selectedShopifyPage.value.handle,
        },
      );

      showSuccessToast(
        "Page Shopify associée",
        `${selectedShopifyPage.value.title} est maintenant liée à cette suggestion.`,
      );
      emit("associated", {
        suggestionId: props.suggestion.id,
        pageId: page.id,
        pageTitle: page.title,
      });
      closeModal();
    } catch (error) {
      showErrorToast(
        "Impossible d’associer la page Shopify",
        error instanceof Error
          ? error.message
          : "Une erreur inattendue est survenue.",
      );
    } finally {
      isSubmitting.value = false;
    }

    return;
  }

  if (selectedSource.value === "blogArticle" && selectedBlogArticle.value) {
    try {
      isSubmitting.value = true;
      const page = await associateExistingPageFromSuggestionGroup(
        props.suggestion.id,
        {
          pageType: targetPageType.value,
          blogArticleId: selectedBlogArticle.value.id,
        },
      );

      showSuccessToast(
        "Article associé",
        `Une page a été créée et liée à ${selectedBlogArticle.value.title}.`,
      );
      emit("associated", {
        suggestionId: props.suggestion.id,
        pageId: page.id,
        pageTitle: page.title,
      });
      closeModal();
    } catch (error) {
      showErrorToast(
        "Impossible d’associer l’article",
        error instanceof Error
          ? error.message
          : "Une erreur inattendue est survenue.",
      );
    } finally {
      isSubmitting.value = false;
    }

    return;
  }

  if (
    selectedSource.value === "shopifyArticle" &&
    selectedShopifyBlogArticle.value
  ) {
    try {
      isSubmitting.value = true;
      const page = await associateExistingPageFromSuggestionGroup(
        props.suggestion.id,
        {
          pageType: targetPageType.value,
          shopifyArticleId: selectedShopifyBlogArticle.value.id,
        },
      );

      showSuccessToast(
        "Article Shopify associé",
        `Une page a été créée et liée à ${selectedShopifyBlogArticle.value.title}.`,
      );
      emit("associated", {
        suggestionId: props.suggestion.id,
        pageId: page.id,
        pageTitle: page.title,
      });
      closeModal();
    } catch (error) {
      showErrorToast(
        "Impossible d’associer l’article Shopify",
        error instanceof Error
          ? error.message
          : "Une erreur inattendue est survenue.",
      );
    } finally {
      isSubmitting.value = false;
    }
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      void ensureSourcesLoaded();
      return;
    }

    resetSelectionState();
  },
);
</script>

<template>
  <UModal
    v-model:open="openModel"
    :title="`Associer une page existante`"
    :ui="{ content: 'sm:max-w-7xl' }"
    :dismissible="!isSubmitting"
  >
    <template #body>
      <div class="space-y-4">
        <div class="space-y-1">
          <p class="text-sm font-medium text-slate-900">
            {{ suggestion.name }}
          </p>
          <p class="text-sm text-slate-500">
            La page sélectionnée sera associée aux mots-clés éditoriaux de ce groupe
            <span v-if="targetPageType" class="font-medium text-slate-700">
              ({{ pageTypeLabels[targetPageType] }})
            </span>.
          </p>
        </div>

        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          size="lg"
          placeholder="Rechercher une page, un article local ou un article Shopify..."
        />

        <div class="grid gap-4 xl:grid-cols-2 2xl:grid-cols-5">
          <section class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div class="space-y-1">
              <div class="flex items-center justify-between gap-3">
                <h3 class="text-sm font-semibold text-slate-900">
                  Dans la base
                </h3>
                <UBadge color="neutral" variant="soft">
                  {{ allLocalPages.length }}
                </UBadge>
              </div>
              <p class="text-xs text-slate-500">
                Pages déjà présentes dans l’application.
              </p>
            </div>

            <div
              class="max-h-80 space-y-2 overflow-y-auto pr-1"
            >
              <p v-if="isLoadingLocalPages" class="text-sm text-slate-500">
                Chargement des pages...
              </p>

              <button
                v-for="page in filteredLocalPages"
                :key="page.id"
                type="button"
                class="w-full rounded-2xl border px-3 py-3 text-left transition"
                :class="
                  isLocalPageSelected(page.id)
                    ? 'border-sky-300 bg-sky-50 ring-1 ring-sky-200'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                "
                @click="selectLocalPage(page)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="space-y-1">
                    <p class="text-sm font-medium text-slate-900">
                      {{ page.title }}
                    </p>
                    <p class="text-xs text-slate-500">
                      {{ page.url }}
                    </p>
                  </div>
                  <UBadge color="neutral" variant="soft">
                    {{ pageTypeLabels[page.pageType] }}
                  </UBadge>
                </div>
              </button>

              <p
                v-if="!isLoadingLocalPages && !filteredLocalPages.length"
                class="text-sm text-slate-500"
              >
                Aucune page locale ne correspond à la recherche.
              </p>
            </div>
          </section>

          <section class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 2xl:col-span-2">
            <div class="space-y-1">
              <div class="flex items-center justify-between gap-3">
                <h3 class="text-sm font-semibold text-slate-900">
                  Pages du site Shopify
                </h3>
                <UBadge color="info" variant="soft">
                  {{ allShopifyPages.length }}
                </UBadge>
              </div>
              <p class="text-xs text-slate-500">
                Pages détectées sur la boutique Shopify, importées localement si besoin.
              </p>
            </div>

            <div class="max-h-80 space-y-2 overflow-y-auto pr-1">
              <p v-if="isLoadingShopifyPages" class="text-sm text-slate-500">
                Chargement des pages Shopify...
              </p>

              <button
                v-for="page in filteredShopifyPages"
                :key="page.id"
                type="button"
                class="w-full rounded-2xl border px-3 py-3 text-left transition"
                :class="
                  isShopifyPageSelected(page.id)
                    ? 'border-sky-300 bg-sky-50 ring-1 ring-sky-200'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                "
                @click="selectShopifyPage(page)"
              >
                <div class="space-y-1">
                  <p class="text-sm font-medium text-slate-900">
                    {{ page.title }}
                  </p>
                  <p class="text-xs text-slate-500">
                    /pages/{{ page.handle }}
                  </p>
                </div>
              </button>

              <p
                v-if="!isLoadingShopifyPages && !filteredShopifyPages.length"
                class="text-sm text-slate-500"
              >
                Aucune page Shopify ne correspond à la recherche.
              </p>
            </div>
          </section>

          <section class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div class="space-y-1">
              <div class="flex items-center justify-between gap-3">
                <h3 class="text-sm font-semibold text-slate-900">
                  Articles de blog locaux
                </h3>
                <UBadge color="warning" variant="soft">
                  {{ filteredBlogArticles.length }}
                </UBadge>
              </div>
              <p class="text-xs text-slate-500">
                Articles locaux sans page liée. Une page sera créée puis associée automatiquement.
              </p>
            </div>

            <div class="max-h-80 space-y-2 overflow-y-auto pr-1">
              <p v-if="isLoadingBlogArticles" class="text-sm text-slate-500">
                Chargement des articles...
              </p>

              <button
                v-for="article in filteredBlogArticles"
                :key="article.id"
                type="button"
                class="w-full rounded-2xl border px-3 py-3 text-left transition"
                :class="
                  isBlogArticleSelected(article.id)
                    ? 'border-sky-300 bg-sky-50 ring-1 ring-sky-200'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                "
                @click="selectBlogArticle(article)"
              >
                <div class="space-y-1">
                  <p class="text-sm font-medium text-slate-900">
                    {{ article.title }}
                  </p>
                  <p class="text-xs text-slate-500">
                    {{ article.url || `/${article.slug || article.id}` }}
                  </p>
                  <p
                    v-if="article.blog?.title || article.blog?.name || article.primaryKeyword"
                    class="text-xs text-slate-500"
                  >
                    {{ article.blog?.title || article.blog?.name || article.primaryKeyword }}
                  </p>
                </div>
              </button>

              <p
                v-if="!isLoadingBlogArticles && !filteredBlogArticles.length"
                class="text-sm text-slate-500"
              >
                Aucun article sans page ne correspond à la recherche.
              </p>
            </div>
          </section>

          <section class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div class="space-y-1">
              <div class="flex items-center justify-between gap-3">
                <h3 class="text-sm font-semibold text-slate-900">
                  Articles Shopify
                </h3>
                <UBadge color="info" variant="soft">
                  {{ filteredShopifyBlogArticles.length }}
                </UBadge>
              </div>
              <p class="text-xs text-slate-500">
                Articles Shopify sans page liée localement. La page sera créée puis l’article local sera associé automatiquement.
              </p>
            </div>

            <div class="max-h-80 space-y-2 overflow-y-auto pr-1">
              <p v-if="isLoadingShopifyBlogArticles" class="text-sm text-slate-500">
                Chargement des articles Shopify...
              </p>

              <button
                v-for="article in filteredShopifyBlogArticles"
                :key="article.id"
                type="button"
                class="w-full rounded-2xl border px-3 py-3 text-left transition"
                :class="
                  isShopifyBlogArticleSelected(article.id)
                    ? 'border-sky-300 bg-sky-50 ring-1 ring-sky-200'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                "
                @click="selectShopifyBlogArticle(article)"
              >
                <div class="space-y-1">
                  <p class="text-sm font-medium text-slate-900">
                    {{ article.title }}
                  </p>
                  <p class="text-xs text-slate-500">
                    {{ article.blog?.title || article.blog?.handle }}
                  </p>
                  <p
                    v-if="article.associatedBlogArticle?.title"
                    class="text-xs text-slate-500"
                  >
                    Article local: {{ article.associatedBlogArticle.title }}
                  </p>
                </div>
              </button>

              <p
                v-if="!isLoadingShopifyBlogArticles && !filteredShopifyBlogArticles.length"
                class="text-sm text-slate-500"
              >
                Aucun article Shopify sans page ne correspond à la recherche.
              </p>
            </div>
          </section>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          color="neutral"
          variant="soft"
          :disabled="isSubmitting"
          @click="closeModal"
        >
          Annuler
        </UButton>
        <UButton
          color="primary"
          icon="i-lucide-link"
          :loading="isSubmitting"
          :disabled="!selectedSource || !targetPageType"
          @click="handleAssociate"
        >
          Associer la page
        </UButton>
      </div>
    </template>
  </UModal>
</template>
