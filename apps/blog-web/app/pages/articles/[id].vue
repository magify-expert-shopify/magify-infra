<script setup lang="ts">
import BlogArticleActionsPanel from "~/components/articles/BlogArticleActionsPanel.vue";
import ArticleSeoChecklist from "~/components/articles/ArticleSeoChecklist.vue";
import BlogArticleEditor from "~/components/editor/BlogArticleEditor.vue";
import { blogArticleStatusLabels } from "~/constants/blog-articles";
import { searchIntentLabels } from "~/constants/enums";
import type { BlogArticleStatus } from "~/types/domain";
import type {
  KeywordAnalysisResponse,
  KeywordAnalysisSerpResult,
} from "~/types/keyword-analysis";
import type { KeywordRecord } from "~/types/keywords";
import { useBlogArticleEditor } from "~/composables/useBlogArticleEditor";
import { formatEditorHtml } from "~/utils/format-editor-html";
import { buildArticleSeoChecklist } from "~/utils/article-seo-checklist";
import { normalizeSearchText } from "~/utils/search-normalizer";

const route = useRoute();
const articleId = computed(() => String(route.params.id ?? ""));
const {
  assignBlogArticleReview,
  deleteBlogArticle,
  updateBlogArticle,
  useBlogArticle,
  useBlogArticlesList,
} =
  useBlogArticles();
const { getArticle: getShopifyArticle, getBlogs } = useShopify();
const { analyzeKeyword } = useKeywordAnalysis();
const { useKeywordsList } = useKeywords();
const { useMagifyAuthorsList } = useAuthors();
const { useProjectMembers } = useProjects();
const { useSeoCluster } = useSeoClusters();
const { getPreferredAuthorProfile } = useSettings();
const { data: article, error, status } = await useBlogArticle(articleId.value);
const { data: shopifyBlogs } = await useAsyncData(
  "shopify-blogs:article-editor",
  () => getBlogs(),
);
const { data: blogArticlesList } = await useBlogArticlesList();
const { data: keywords } = useKeywordsList();
const { data: authors } = await useMagifyAuthorsList();
const { showErrorToast, showSuccessToast } = useAppToast();
const articleProjectId = computed(() => article.value?.projectId ?? "");
const { data: projectMembers } = useProjectMembers(articleProjectId);
const { data: preferredAuthorProfile } = await useAsyncData(
  "settings:preferred-author-profile:article",
  () => getPreferredAuthorProfile(),
);
const { data: articleCluster } = article.value?.cluster?.id
  ? await useSeoCluster(article.value.cluster.id)
  : { data: ref(null) };

const isSaving = ref(false);
const isSavingScriptAssets = ref(false);
const isDeletingArticle = ref(false);
const isUpdatingAuthor = ref(false);
const isUpdatingReviewAssignment = ref(false);
const isUpdatingShopifyBlog = ref(false);
const isUpdatingStatus = ref(false);
const isPushingToShopify = ref(false);
const isTogglingShopifyVisibility = ref(false);
const isSyncingSelectedStatus = ref(false);
const activeShopifyAction = ref<
  "publish" | "publish-now" | "unpublish" | "schedule" | "unschedule" | null
>(null);
const isLoadingSerp = ref(false);
const feedbackMessage = ref("");
const isLinkModalOpen = ref(false);
const isImageModalOpen = ref(false);
const isVideoModalOpen = ref(false);
const imageModalMode = ref<"insert" | "edit">("insert");
const linkModalMode = ref<"insert" | "edit">("insert");
const savedLinkSelection = ref<{ from: number; to: number } | null>(null);
const isEditingExistingLink = ref(false);

const linkErrorMessage = ref("");
const imageErrorMessage = ref("");
const videoErrorMessage = ref("");
const predefinedLinkOptions = [
  {
    label: "SOS DEV",
    value: "/pages/support-technique-shopify",
  },
  {
    label: "REFONTE",
    value: "/pages/creation-de-site-shopify",
  },
] as const;
const selectedPredefinedLinkType = ref<"" | "offer" | "blog-article">("");
const selectedPredefinedLink = ref("");

const linkForm = reactive({
  href: "",
  title: "",
  openInNewTab: false,
});

const offerLinkOptions = [...predefinedLinkOptions];

const blogArticleLinkOptions = computed(() =>
  (blogArticlesList.value ?? [])
    .filter((blogArticle) => blogArticle.id !== article.value?.id)
    .map((blogArticle) => ({
      label:
        blogArticle.title?.trim() ||
        blogArticle.seoTitle?.trim() ||
        blogArticle.primaryKeyword?.trim() ||
        "Article sans titre",
      value:
        blogArticle.url?.trim() ||
        (blogArticle.slug?.trim() ? `/blogs/${blogArticle.slug.trim()}` : ""),
    }))
    .filter((option) => option.value)
    .sort((left, right) =>
      left.label.localeCompare(right.label, "fr", { sensitivity: "base" }),
    ),
);

const selectedPredefinedLinkOptions = computed(() => {
  if (selectedPredefinedLinkType.value === "offer") {
    return offerLinkOptions;
  }

  if (selectedPredefinedLinkType.value === "blog-article") {
    return blogArticleLinkOptions.value;
  }

  return [];
});

const reviewAssignees = computed(() =>
  (projectMembers.value ?? [])
    .map((member) => ({
      id: member.id,
      label:
        member.displayName?.trim() ||
        member.email?.trim() ||
        "Membre sans nom",
    }))
    .sort((left, right) =>
      left.label.localeCompare(right.label, "fr", { sensitivity: "base" }),
    ),
);

const imageForm = reactive({
  src: "",
  alt: "",
  caption: "",
});

const videoForm = reactive({
  html: "",
});

let feedbackMessageTimer: ReturnType<typeof setTimeout> | null = null;

const selectedAuthorId = ref("");
const selectedReviewAssigneeId = ref("");
const selectedShopifyBlogId = ref("");
const selectedStatus = ref<BlogArticleStatus>("DRAFT");
const syncedShopifyPublishedAt = ref<string | null>(null);
const activeEditorTab = ref<
  "content" | "metadata" | "maillage" | "cluster" | "serp" | "checklist"
>(
  "content",
);
const slug = ref("");
const scriptAssetUrlsText = ref("");
const primaryKeyword = ref("");
const requiredKeywords = ref("");
const seoTitle = ref("");
const seoDescription = ref("");
const videoYoutubeUrl = ref("");
const primaryKeywordSearch = ref("");
const isPrimaryKeywordSuggestionsOpen = ref(false);
const savedMetadataSignature = ref("");
const savedScriptAssetUrlsSignature = ref("");
const metadataDirtySince = ref<number | null>(null);
const metadataDirtyElapsedLabel = ref("");
let metadataDirtyTimer: ReturnType<typeof setInterval> | null = null;
const scriptAssetsDirtySince = ref<number | null>(null);
const scriptAssetsDirtyElapsedLabel = ref("");
let scriptAssetsDirtyTimer: ReturnType<typeof setInterval> | null = null;
const serpAnalysis = ref<KeywordAnalysisResponse | null>(null);
const serpErrorMessage = ref("");
const lastLoadedSerpKeyword = ref("");

const breadcrumbItems = computed(() => {
  const items = [
    {
      label: "Articles",
      to: "/articles",
    },
  ];

  const clusterHierarchy = [
    ...(articleCluster.value?.parentClusters ?? []),
    ...(articleCluster.value
      ? [
          {
            id: articleCluster.value.id,
            name: articleCluster.value.name,
            slug: articleCluster.value.slug,
          },
        ]
      : []),
  ];

  for (const cluster of clusterHierarchy) {
    items.push({
      label: cluster.name,
      to: `/clusters/${cluster.id}`,
    });
  }

  if (article.value?.title) {
    items.push({
      label: article.value.title,
    });
  }

  return items;
});

const primaryKeywordSuggestions = computed(() => {
  const query = normalizeSearchText(primaryKeywordSearch.value);
  const allKeywords = keywords.value ?? [];

  return allKeywords
    .filter((keyword) =>
      query ? normalizeSearchText(keyword.keyword).includes(query) : true,
    )
    .filter((keyword) => keyword.keyword.trim())
    .slice(0, 8);
});

const {
  title,
  editorMode,
  editorHtml,
  isColorPickerOpen,
  isTypingIndicatorActive,
  dirtySince: editorDirtySince,
  dirtyElapsedLabel: editorDirtyElapsedLabel,
  currentAsideVariant,
  currentCodeLanguage,
  currentCalloutBoxBackgroundColor,
  currentCalloutBoxBorderColor,
  currentCustomElementStructureType,
  textColor,
  backgroundColor,
  editor,
  currentBlockFormat,
  hasChanges: editorHasChanges,
  statusMessage: editorStatusMessage,
  canUndo,
  canRedo,
  isCustomElementStructureActive,
  isImageSelected,
  isNonBreakingSpaceActive,
  isKeyboardInputActive,
  isEditorReady,
  isMarkActive,
  isTextAlignActive,
  onBlockFormatChange,
  setTextAlignment,
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleBulletList,
  toggleNonBreakingSpace,
  toggleKeyboardInput,
  toggleOrderedList,
  applyTextColor,
  resetTextColor,
  applyBackgroundColor,
  resetBackgroundColor,
  onColorPickerPointerDown,
  onColorPickerBlur,
  onColorPopoverInteractOutside,
  increaseIndent,
  decreaseIndent,
  clearFormatting,
  deleteCurrentEditorElement,
  undo,
  redo,
  insertTable,
  setAsideVariant,
  setCodeLanguage,
  setCalloutBoxBackgroundColor,
  setCalloutBoxBorderColor,
  insertAside,
  insertCalloutBox,
  insertCustomElementStructure,
  insertDetailsElement,
  removeCustomElementStructure,
  setSaveHandler,
  markCurrentStateAsSaved,
  restoreSavedState,
} = useBlogArticleEditor({
  article,
  feedbackMessage,
});

function normalizeMetadataField(value: string) {
  return value.trim();
}

function normalizeLinkingText(value: string) {
  return normalizeSearchText(value).replace(/\s+/g, " ").trim();
}

function extractTextFromHtml(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return "";
  }

  if (import.meta.client && typeof DOMParser !== "undefined") {
    return (
      new DOMParser()
        .parseFromString(normalized, "text/html")
        .body.textContent?.replace(/\s+/g, " ")
        .trim() ?? ""
    );
  }

  return normalized.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitArticleKeywords(value?: string | null) {
  return (value ?? "")
    .split(/[\n,;|]+/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function containsLinkedKeyword(content: string, keyword: string) {
  const normalizedContent = normalizeLinkingText(content);
  const normalizedKeyword = normalizeLinkingText(keyword);

  if (!normalizedContent || !normalizedKeyword) {
    return false;
  }

  const pattern = new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(normalizedKeyword)}([^a-z0-9]|$)`,
    "i",
  );

  return pattern.test(normalizedContent);
}

function normalizeScriptAssetUrlsText(value: string) {
  const seenUrls = new Set<string>();
  const normalizedUrls: string[] = [];

  for (const line of value.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || seenUrls.has(trimmedLine)) {
      continue;
    }

    seenUrls.add(trimmedLine);
    normalizedUrls.push(trimmedLine);
  }

  return normalizedUrls;
}

function formatScriptAssetUrlsText(urls?: string[] | null) {
  return (urls ?? []).map((url) => url.trim()).filter(Boolean).join("\n");
}

function buildMetadataSignature() {
  return JSON.stringify({
    slug: normalizeMetadataField(slug.value),
    primaryKeyword: normalizeMetadataField(primaryKeyword.value),
    requiredKeywords: normalizeMetadataField(requiredKeywords.value),
    seoTitle: normalizeMetadataField(seoTitle.value),
    seoDescription: normalizeMetadataField(seoDescription.value),
    videoYoutubeUrl: normalizeMetadataField(videoYoutubeUrl.value),
  });
}

function buildScriptAssetUrlsSignature() {
  return JSON.stringify(normalizeScriptAssetUrlsText(scriptAssetUrlsText.value));
}

function syncSelectedStatusSilently(nextStatus: BlogArticleStatus) {
  isSyncingSelectedStatus.value = true;
  selectedStatus.value = nextStatus;
  void nextTick(() => {
    isSyncingSelectedStatus.value = false;
  });
}

function isDateAfterToday(value?: string | null) {
  if (!value) {
    return false;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return false;
  }

  return parsedDate.getTime() > Date.now();
}

function getArticleShopifyVisibilityStatus(
  value?: Pick<BlogArticle, "status" | "plannedFor" | "publishedAt"> | null,
  options?: {
    shopifyPublished?: boolean;
    shopifyPublishedAt?: string | null;
  },
): BlogArticleStatus {
  if (options?.shopifyPublishedAt && isDateAfterToday(options.shopifyPublishedAt)) {
    return "PLANNED";
  }

  if (options?.shopifyPublished) {
    return "PUBLISHED";
  }

  if (value?.plannedFor && isDateAfterToday(value.plannedFor) && !value.publishedAt) {
    return "PLANNED";
  }

  if (value?.status === "PUBLISHED" || value?.status === "PLANNED") {
    return value.status;
  }

  return "PUSHED";
}

function getInitialSelectedStatus(
  value?: Pick<
    BlogArticle,
    "status" | "plannedFor" | "publishedAt" | "shopifyArticleId"
  > | null,
): BlogArticleStatus {
  if (!value?.shopifyArticleId?.trim()) {
    return (value?.status as BlogArticleStatus | undefined) ?? "DRAFT";
  }

  return getArticleShopifyVisibilityStatus(value, {
    shopifyPublished: Boolean(value.publishedAt),
    shopifyPublishedAt: value.publishedAt,
  });
}

async function syncPublicationStatusFromShopifyArticle(
  shopifyArticleId?: string | null,
) {
  if (!shopifyArticleId?.trim()) {
    syncedShopifyPublishedAt.value = null;
    syncSelectedStatusSilently(getInitialSelectedStatus(article.value));
    return;
  }

  try {
    const shopifyArticle = await getShopifyArticle(shopifyArticleId);
    syncedShopifyPublishedAt.value = shopifyArticle.publishedAt ?? null;
    syncSelectedStatusSilently(
      getArticleShopifyVisibilityStatus(article.value, {
        shopifyPublished: Boolean(shopifyArticle.publishedAt),
        shopifyPublishedAt: shopifyArticle.publishedAt,
      }),
    );
  } catch (error) {
    syncedShopifyPublishedAt.value = null;
    syncSelectedStatusSilently(
      (article.value?.status as BlogArticleStatus | undefined) ?? "DRAFT",
    );
    console.error(error);
  }
}

function clearMetadataDirtyTimer() {
  if (metadataDirtyTimer) {
    clearInterval(metadataDirtyTimer);
    metadataDirtyTimer = null;
  }
}

function clearScriptAssetsDirtyTimer() {
  if (scriptAssetsDirtyTimer) {
    clearInterval(scriptAssetsDirtyTimer);
    scriptAssetsDirtyTimer = null;
  }
}

function formatElapsedTime(milliseconds: number) {
  const totalSeconds = Math.max(1, Math.floor(milliseconds / 1000));

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const totalMinutes = Math.floor(totalSeconds / 60);

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  return remainingMinutes
    ? `${totalHours}h ${remainingMinutes} min`
    : `${totalHours}h`;
}

function formatSerpType(type: string) {
  if (type === "organic") {
    return "Résultat naturel";
  }

  if (type === "paid") {
    return "Annonce";
  }

  if (type === "featured_snippet") {
    return "Extrait optimisé";
  }

  if (type === "people_also_ask") {
    return "Autres questions";
  }

  if (type === "video") {
    return "Vidéo";
  }

  if (type === "images") {
    return "Images";
  }

  if (type === "local_pack") {
    return "Pack local";
  }

  return type.replaceAll("_", " ");
}

function getSerpTypeIcon(type: string) {
  if (type === "organic") {
    return "i-lucide-globe";
  }

  if (type === "paid") {
    return "i-lucide-badge-dollar-sign";
  }

  if (type === "featured_snippet") {
    return "i-lucide-sparkles";
  }

  if (type === "people_also_ask") {
    return "i-lucide-message-circle-question";
  }

  if (type === "video") {
    return "i-lucide-play-square";
  }

  if (type === "images") {
    return "i-lucide-image";
  }

  if (type === "local_pack") {
    return "i-lucide-map-pinned";
  }

  return "i-lucide-file-search";
}

function getSerpTypeColor(type: string) {
  if (type === "organic") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200";
  }

  if (type === "paid") {
    return "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200";
  }

  if (type === "featured_snippet") {
    return "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200";
  }

  if (type === "people_also_ask") {
    return "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200";
  }

  if (type === "video") {
    return "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200";
  }

  if (type === "images") {
    return "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-inset ring-fuchsia-200";
  }

  if (type === "local_pack") {
    return "bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200";
  }

  return "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200";
}

function getSerpTypeDescription(result: KeywordAnalysisSerpResult) {
  if (result.type === "paid") {
    return "Résultat sponsorisé affiché dans la SERP.";
  }

  if (result.type === "featured_snippet") {
    return "Bloc mis en avant par Google pour répondre directement à la requête.";
  }

  if (result.type === "people_also_ask") {
    return "Question complémentaire proposée par Google autour de ce sujet.";
  }

  if (result.type === "video") {
    return "Résultat vidéo affiché dans la page de résultats.";
  }

  if (result.type === "images") {
    return "Résultat issu d’un bloc visuel ou image dans la SERP.";
  }

  if (result.type === "local_pack") {
    return "Résultat local affiché dans le pack map / établissements.";
  }

  return "Résultat naturel classique de la page de recherche.";
}

function getKnownAgencySiteLabel(result: KeywordAnalysisSerpResult) {
  if (!result.knownAgencySite) {
    return "";
  }

  return `Site agence connu : ${result.knownAgencySite.name}`;
}

function isShopifyResult(url: string) {
  return url.startsWith("https://www.shopify.com/");
}

function isMagifyResult(url: string) {
  return url.startsWith("https://magify.fr/");
}

function getSerpResultCardClass(result: KeywordAnalysisSerpResult) {
  if (isMagifyResult(result.url)) {
    return "border border-emerald-300 bg-emerald-50";
  }

  if (isShopifyResult(result.url) || result.type !== "organic") {
    return "opacity-50";
  }

  return "";
}

function updateMetadataDirtyElapsedLabel() {
  if (!metadataDirtySince.value) {
    metadataDirtyElapsedLabel.value = "";
    return;
  }

  metadataDirtyElapsedLabel.value = formatElapsedTime(
    Date.now() - metadataDirtySince.value,
  );
}

function updateScriptAssetsDirtyElapsedLabel() {
  if (!scriptAssetsDirtySince.value) {
    scriptAssetsDirtyElapsedLabel.value = "";
    return;
  }

  scriptAssetsDirtyElapsedLabel.value = formatElapsedTime(
    Date.now() - scriptAssetsDirtySince.value,
  );
}

const metadataHasChanges = computed(
  () => buildMetadataSignature() !== savedMetadataSignature.value,
);

watch(metadataHasChanges, (value) => {
  if (value) {
    if (!metadataDirtySince.value) {
      metadataDirtySince.value = Date.now();
    }

    updateMetadataDirtyElapsedLabel();

    if (!metadataDirtyTimer) {
      metadataDirtyTimer = setInterval(updateMetadataDirtyElapsedLabel, 1000);
    }

    return;
  }

  metadataDirtySince.value = null;
  metadataDirtyElapsedLabel.value = "";
  clearMetadataDirtyTimer();
});

const scriptAssetUrlsHasChanges = computed(
  () => buildScriptAssetUrlsSignature() !== savedScriptAssetUrlsSignature.value,
);

watch(scriptAssetUrlsHasChanges, (value) => {
  if (value) {
    if (!scriptAssetsDirtySince.value) {
      scriptAssetsDirtySince.value = Date.now();
    }

    updateScriptAssetsDirtyElapsedLabel();

    if (!scriptAssetsDirtyTimer) {
      scriptAssetsDirtyTimer = setInterval(
        updateScriptAssetsDirtyElapsedLabel,
        1000,
      );
    }

    return;
  }

  scriptAssetsDirtySince.value = null;
  scriptAssetsDirtyElapsedLabel.value = "";
  clearScriptAssetsDirtyTimer();
});

const articleHasChanges = computed(
  () => editorHasChanges.value || metadataHasChanges.value,
);

const hasChanges = computed(
  () => articleHasChanges.value || scriptAssetUrlsHasChanges.value,
);

const combinedDirtySince = computed(() => {
  const timestamps = [
    editorDirtySince.value,
    metadataDirtySince.value,
    scriptAssetsDirtySince.value,
  ].filter((value): value is number => typeof value === "number");

  if (!timestamps.length) {
    return null;
  }

  return Math.min(...timestamps);
});

const combinedDirtyElapsedLabel = computed(() => {
  if (!combinedDirtySince.value) {
    return "";
  }

  if (
    editorDirtySince.value &&
    combinedDirtySince.value === editorDirtySince.value
  ) {
    return editorDirtyElapsedLabel.value;
  }

  if (
    metadataDirtySince.value &&
    combinedDirtySince.value === metadataDirtySince.value
  ) {
    return metadataDirtyElapsedLabel.value;
  }

  if (
    scriptAssetsDirtySince.value &&
    combinedDirtySince.value === scriptAssetsDirtySince.value
  ) {
    return scriptAssetsDirtyElapsedLabel.value;
  }

  return "";
});

const statusMessage = computed(() => {
  if (feedbackMessage.value) {
    return feedbackMessage.value;
  }

  if (isTypingIndicatorActive.value && editorHasChanges.value) {
    return "Modification en cours";
  }

  if (hasChanges.value) {
    return `Modifications non enregistrées depuis ${combinedDirtyElapsedLabel.value || "1s"}`;
  }

  return editorStatusMessage.value;
});

const publishedShopifyUrl = computed(() => article.value?.url?.trim() ?? "");

const isArticlePublishedOnShopify = computed(() => {
  const publishedAt =
    syncedShopifyPublishedAt.value ?? article.value?.publishedAt ?? null;

  if (!publishedAt || isDateAfterToday(publishedAt)) {
    return false;
  }

  return Boolean(publishedShopifyUrl.value);
});

const checklistSections = computed(() =>
  buildArticleSeoChecklist({
    title: title.value,
    slug: slug.value,
    primaryKeyword: primaryKeyword.value,
    requiredKeywords: requiredKeywords.value,
    seoTitle: seoTitle.value,
    seoDescription: seoDescription.value,
    videoYoutubeUrl: videoYoutubeUrl.value,
    html: editorHtml.value,
  }),
);

const articleLinkingContentText = computed(() =>
  extractTextFromHtml(editorHtml.value || article.value?.content || ""),
);

const linkedPageKeywordNormalizedSet = computed(() => {
  const pageId = article.value?.pageId?.trim();

  if (!pageId) {
    return new Set<string>();
  }

  return new Set(
    (keywords.value ?? [])
      .filter((keyword) => keyword.page?.id?.trim() === pageId)
      .map((keyword) => normalizeLinkingText(keyword.keyword))
      .filter((value): value is string => Boolean(value)),
  );
});

const matchedDatabaseKeywords = computed(() => {
  const contentText = articleLinkingContentText.value;
  const seenKeywords = new Map<string, KeywordRecord>();

  if (!contentText.trim()) {
    return [];
  }

  for (const keyword of keywords.value ?? []) {
    const trimmedKeyword = keyword.keyword.trim();

    if (!trimmedKeyword || !containsLinkedKeyword(contentText, trimmedKeyword)) {
      continue;
    }

    const normalizedKeyword = normalizeLinkingText(trimmedKeyword);

    if (linkedPageKeywordNormalizedSet.value.has(normalizedKeyword)) {
      continue;
    }

    if (!seenKeywords.has(normalizedKeyword)) {
      seenKeywords.set(normalizedKeyword, keyword);
    }
  }

  return [...seenKeywords.values()].sort((left, right) =>
    left.keyword.localeCompare(right.keyword, "fr", { sensitivity: "base" }),
  );
});

function buildMaillageRows(includeOnlyLinkedKeywords: boolean) {
  const contentText = articleLinkingContentText.value;
  const sourceArticleId = article.value?.id;
  const matchingKeywords = new Map<
    string,
    {
      keyword: string;
      articles: Map<
        string,
        {
          id: string;
          title: string;
          status: BlogArticleStatus;
        }
      >;
    }
  >();

  if (!sourceArticleId) {
    return [];
  }

  for (const linkedArticle of blogArticlesList.value ?? []) {
    if (linkedArticle.id === sourceArticleId) {
      continue;
    }

    const articleKeywords = [
      ...splitArticleKeywords(linkedArticle.primaryKeyword),
      ...splitArticleKeywords(linkedArticle.requiredKeywords),
    ];

    for (const keyword of articleKeywords) {
      const normalizedKeyword = normalizeLinkingText(keyword);

      if (!normalizedKeyword) {
        continue;
      }

      if (linkedPageKeywordNormalizedSet.value.has(normalizedKeyword)) {
        continue;
      }

      if (
        includeOnlyLinkedKeywords &&
        !containsLinkedKeyword(contentText, keyword)
      ) {
        continue;
      }

      const existingRow = matchingKeywords.get(normalizedKeyword);
      const articleEntry = {
        id: linkedArticle.id,
        title:
          linkedArticle.title?.trim() ||
          linkedArticle.seoTitle?.trim() ||
          keyword,
        status:
          (linkedArticle.status as BlogArticleStatus | undefined) ?? "DRAFT",
      };

      if (existingRow) {
        existingRow.articles.set(linkedArticle.id, articleEntry);
        continue;
      }

      matchingKeywords.set(normalizedKeyword, {
        keyword,
        articles: new Map([[linkedArticle.id, articleEntry]]),
      });
    }
  }

  return [...matchingKeywords.values()]
    .map((entry) => ({
      keyword: entry.keyword,
      articles: [...entry.articles.values()].sort((left, right) =>
        left.title.localeCompare(right.title, "fr", { sensitivity: "base" }),
      ),
    }))
    .sort((left, right) =>
      left.keyword.localeCompare(right.keyword, "fr", { sensitivity: "base" }),
    );
}

const maillageRows = computed(() => buildMaillageRows(true));
const pageLinkedKeywords = computed(() => {
  const pageId = article.value?.pageId?.trim();

  if (!pageId) {
    return [];
  }

  return [...(keywords.value ?? [])]
    .filter((keyword) => keyword.page?.id?.trim() === pageId)
    .sort((left, right) =>
      left.keyword.localeCompare(right.keyword, "fr", { sensitivity: "base" }),
    );
});

const editorTabs = [
  {
    label: "Contenu",
    value: "content" as const,
    icon: "i-lucide-file-text",
  },
  {
    label: "Métadonnées",
    value: "metadata" as const,
    icon: "i-lucide-tags",
  },
  {
    label: "Maillage",
    value: "maillage" as const,
    icon: "i-lucide-link",
  },
  {
    label: "Cluster",
    value: "cluster" as const,
    icon: "i-lucide-network",
  },
  {
    label: "SERP",
    value: "serp" as const,
    icon: "i-lucide-search",
  },
  {
    label: "Checklist",
    value: "checklist" as const,
    icon: "i-lucide-list-checks",
  },
];

const articlePrimaryKeyword = computed(() =>
  normalizeMetadataField(primaryKeyword.value),
);

const articleClusterName = computed(
  () =>
    articleCluster.value?.name?.trim() ||
    article.value?.cluster?.name?.trim() ||
    "",
);

function buildKeywordGroupFallbackSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const clusterPillarArticle = computed(() => {
  const pillarPage =
    articleCluster.value?.pages?.find(
      (page) => page.seoRole === "PILLAR" && page.pageType === "BLOG_ARTICLE",
    ) ??
    articleCluster.value?.pages?.find((page) => page.seoRole === "PILLAR") ??
    null;
  const pillarKeywordGroup = articleCluster.value?.pillarKeywordGroup ?? null;
  const fallbackTitle = pillarKeywordGroup?.name?.trim() || "";
  const fallbackSlugSource =
    pillarKeywordGroup?.primaryKeyword?.trim() || fallbackTitle;

  return {
    title: pillarPage?.title?.trim() || fallbackTitle,
    slug:
      pillarPage?.slug?.trim() ||
      (fallbackSlugSource
        ? buildKeywordGroupFallbackSlug(fallbackSlugSource)
        : ""),
  };
});

async function copyValueToClipboard(value: string, label: string) {
  if (!value.trim()) {
    showErrorToast(
      "Copie impossible",
      `Aucune valeur disponible pour ${label.toLowerCase()}.`,
    );
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    showSuccessToast(
      "Valeur copiée",
      `${label} a ete copie dans le presse-papiers.`,
    );
  } catch {
    showErrorToast(
      "Copie impossible",
      "Le navigateur n'a pas autorise la copie dans le presse-papiers.",
    );
  }
}

function confirmLeavingWithUnsavedChanges() {
  if (!import.meta.client || !hasChanges.value) {
    return true;
  }

  return window.confirm(
    "Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter cette page ?",
  );
}

function onWindowBeforeUnload(event: BeforeUnloadEvent) {
  if (!hasChanges.value) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
}

async function refreshRelatedData(
  updatedArticle?: {
    id?: string;
    cluster?: { id: string } | null;
  } | null,
) {
  const clusterIds = new Set<string>();
  const previousClusterId = article.value?.cluster?.id;
  const nextClusterId = updatedArticle?.cluster?.id;

  if (previousClusterId) {
    clusterIds.add(previousClusterId);
  }

  if (nextClusterId) {
    clusterIds.add(nextClusterId);
  }

  await Promise.all([
    refreshNuxtData("seo-clusters"),
    refreshNuxtData(`blog-article:${articleId.value}`),
    ...[...clusterIds].map((clusterId) =>
      refreshNuxtData(`seo-cluster:${clusterId}`),
    ),
  ]);
}

watch(
  [article, preferredAuthorProfile],
  ([value, preferredProfile]) => {
    selectedAuthorId.value =
      value?.authorId ?? preferredProfile?.authorId ?? "";
    selectedReviewAssigneeId.value = value?.reviewSupabaseUserId ?? "";
    selectedShopifyBlogId.value = value?.shopifyBlogId ?? "";
    syncSelectedStatusSilently(getInitialSelectedStatus(value));
    slug.value = value?.slug ?? "";
    scriptAssetUrlsText.value = formatScriptAssetUrlsText(
      value?.scriptAssetUrls,
    );
    primaryKeyword.value = value?.primaryKeyword ?? "";
    primaryKeywordSearch.value = value?.primaryKeyword ?? "";
    requiredKeywords.value = value?.requiredKeywords ?? "";
    seoTitle.value = value?.seoTitle ?? "";
    seoDescription.value = value?.seoDescription ?? "";
    videoYoutubeUrl.value = value?.videoYoutubeUrl ?? "";
    savedMetadataSignature.value = buildMetadataSignature();
    savedScriptAssetUrlsSignature.value = buildScriptAssetUrlsSignature();
    metadataDirtySince.value = null;
    metadataDirtyElapsedLabel.value = "";
    clearMetadataDirtyTimer();
    scriptAssetsDirtySince.value = null;
    scriptAssetsDirtyElapsedLabel.value = "";
    clearScriptAssetsDirtyTimer();
  },
  { immediate: true },
);

watch(
  () => article.value?.shopifyArticleId,
  (shopifyArticleId) => {
    void syncPublicationStatusFromShopifyArticle(shopifyArticleId);
  },
  { immediate: true },
);

function selectPrimaryKeyword(keyword: KeywordRecord) {
  primaryKeyword.value = keyword.keyword;
  primaryKeywordSearch.value = keyword.keyword;
  isPrimaryKeywordSuggestionsOpen.value = false;
}

watch(primaryKeywordSearch, (value) => {
  primaryKeyword.value = value;
});

watch(
  () => linkForm.href,
  (value) => {
    selectedPredefinedLink.value = predefinedLinkOptions.some(
      (option) => option.value === value,
    )
      ? value
      : "";
  },
);

function resetLinkForm() {
  linkForm.href = "";
  linkForm.title = "";
  linkForm.openInNewTab = false;
  linkErrorMessage.value = "";
  selectedPredefinedLinkType.value = "";
  selectedPredefinedLink.value = "";
  linkModalMode.value = "insert";
  savedLinkSelection.value = null;
  isEditingExistingLink.value = false;
}

function resetImageForm() {
  imageForm.src = "";
  imageForm.alt = "";
  imageForm.caption = "";
  imageErrorMessage.value = "";
  imageModalMode.value = "insert";
}

function getSelectedImageNodeInfo() {
  const selection = editor.value?.state.selection;

  if (!selection) {
    return null;
  }

  for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
    const node = selection.$from.node(depth);

    if (node.type.name !== "image" && node.type.name !== "figureImage") {
      continue;
    }

    return {
      type: node.type.name as "image" | "figureImage",
      position: selection.$from.before(depth),
      attrs: node.attrs as {
        src?: string | null;
        alt?: string | null;
        caption?: string | null;
      },
    };
  }

  const selectedNode = "node" in selection ? selection.node : null;

  if (
    selectedNode &&
    (selectedNode.type.name === "image" ||
      selectedNode.type.name === "figureImage")
  ) {
    return {
      type: selectedNode.type.name as "image" | "figureImage",
      position: selection.from,
      attrs: selectedNode.attrs as {
        src?: string | null;
        alt?: string | null;
        caption?: string | null;
      },
    };
  }

  return null;
}

function resetVideoForm() {
  videoForm.html = "";
  videoErrorMessage.value = "";
}

function openLinkModal() {
  if (!editor.value) {
    return;
  }

  const { from, to, empty } = editor.value.state.selection;
  const attributes = editor.value.getAttributes("link");
  const selectedText = editor.value.state.doc.textBetween(from, to, " ").trim();
  const isLinkActive = editor.value.isActive("link");

  linkForm.href = String(attributes.href ?? "");
  linkForm.title =
    selectedText ||
    String(attributes.title ?? "");
  linkForm.openInNewTab = attributes.target === "_blank";
  linkErrorMessage.value = "";
  savedLinkSelection.value = { from, to };
  isEditingExistingLink.value = isLinkActive;
  linkModalMode.value = isLinkActive ? "edit" : "insert";

  const normalizedHref = linkForm.href.trim();

  if (offerLinkOptions.some((option) => option.value === normalizedHref)) {
    selectedPredefinedLinkType.value = "offer";
    selectedPredefinedLink.value = normalizedHref;
  } else if (
    blogArticleLinkOptions.value.some((option) => option.value === normalizedHref)
  ) {
    selectedPredefinedLinkType.value = "blog-article";
    selectedPredefinedLink.value = normalizedHref;
  } else {
    selectedPredefinedLinkType.value = "";
    selectedPredefinedLink.value = "";
  }

  isLinkModalOpen.value = true;
}

function submitLink() {
  if (!editor.value) {
    return;
  }

  const href = linkForm.href.trim();

  if (!href) {
    linkErrorMessage.value = "Le lien est obligatoire.";
    return;
  }

  const attributes = {
    href,
    title: linkForm.title.trim() || null,
    target: linkForm.openInNewTab ? "_blank" : null,
    rel: linkForm.openInNewTab ? "noopener noreferrer" : null,
  };
  const selection = savedLinkSelection.value ?? {
    from: editor.value.state.selection.from,
    to: editor.value.state.selection.to,
  };
  const hasSelection = selection.from !== selection.to;
  const chain = editor.value.chain().focus();

  chain.setTextSelection(selection);

  if (isEditingExistingLink.value) {
    chain.extendMarkRange("link").setLink(attributes).run();
  } else if (hasSelection) {
    chain.setLink(attributes).run();
  } else {
    const text = linkForm.title.trim() || href;

    chain
      .insertContent(text)
      .setTextSelection({
        from: selection?.from ?? editor.value.state.selection.from,
        to: (selection?.from ?? editor.value.state.selection.from) + text.length,
      })
      .setLink(attributes)
      .run();
  }

  isLinkModalOpen.value = false;
  resetLinkForm();
}

function removeLink() {
  if (!editor.value) {
    return;
  }

  editor.value.chain().focus().extendMarkRange("link").unsetLink().run();
}

function applyPredefinedLink(value: string | null) {
  const normalizedValue = value ?? "";

  selectedPredefinedLink.value = normalizedValue;

  if (normalizedValue) {
    linkForm.href = normalizedValue;
  }
}

function applyPredefinedLinkType(value: string | null) {
  selectedPredefinedLinkType.value =
    value === "offer" || value === "blog-article" ? value : "";
  selectedPredefinedLink.value = "";
}

function openImageModal() {
  const selectedImage = getSelectedImageNodeInfo();

  resetImageForm();
  imageModalMode.value = selectedImage ? "edit" : "insert";
  imageForm.src = selectedImage?.attrs.src?.trim() ?? "";
  imageForm.alt = selectedImage?.attrs.alt?.trim() ?? "";
  imageForm.caption = selectedImage?.attrs.caption?.trim() ?? "";
  isImageModalOpen.value = true;
}

function submitImage() {
  if (!editor.value) {
    return;
  }

  const src = imageForm.src.trim();

  if (!src) {
    imageErrorMessage.value = "Le lien de l’image est obligatoire.";
    return;
  }

  const alt = imageForm.alt.trim() || null;
  const caption = imageForm.caption.trim() || null;
  const selectedImage = getSelectedImageNodeInfo();

  if (selectedImage) {
    const chain = editor.value.chain().focus();

    if (selectedImage.type === "figureImage") {
      chain
        .setNodeSelection(selectedImage.position)
        .updateAttributes("figureImage", {
          src,
          alt: alt ?? "",
          caption: caption ?? "",
        })
        .run();
    } else if (caption) {
      chain
        .setNodeSelection(selectedImage.position)
        .deleteSelection()
        .insertFigureImage({
          src,
          alt,
          caption,
        })
        .run();
    } else {
      chain
        .setNodeSelection(selectedImage.position)
        .updateAttributes("image", {
          src,
          alt,
        })
        .run();
    }
  } else if (caption) {
    editor.value
      .chain()
      .focus()
      .insertFigureImage({
        src,
        alt,
        caption,
      })
      .run();
  } else {
    editor.value
      .chain()
      .focus()
      .setImage({
        src,
        alt,
      })
      .run();
  }
  isImageModalOpen.value = false;
  resetImageForm();
}

const imageModalTitle = computed(() =>
  imageModalMode.value === "edit" ? "Modifier l’image" : "Insérer une image",
);

const imageModalSubmitLabel = computed(() =>
  imageModalMode.value === "edit" ? "Enregistrer l’image" : "Insérer l’image",
);

const linkModalTitle = computed(() =>
  linkModalMode.value === "edit" ? "Modifier un lien" : "Insérer un lien",
);

const linkModalSubmitLabel = computed(() =>
  linkModalMode.value === "edit" ? "Mettre à jour le lien" : "Insérer le lien",
);

function parseVideoEmbedHtml(html: string) {
  if (!import.meta.client) {
    return null;
  }

  const documentFragment = new DOMParser().parseFromString(html, "text/html");
  const iframe = documentFragment.querySelector("iframe");

  if (!iframe) {
    return null;
  }

  const src = iframe.getAttribute("src")?.trim() ?? "";

  if (!src) {
    return null;
  }

  return {
    src,
    title: iframe.getAttribute("title"),
    width: iframe.getAttribute("width"),
    height: iframe.getAttribute("height"),
    allow: iframe.getAttribute("allow"),
    frameborder: iframe.getAttribute("frameborder") ?? "0",
    allowfullscreen: iframe.hasAttribute("allowfullscreen"),
  };
}

function openVideoModal() {
  resetVideoForm();
  isVideoModalOpen.value = true;
}

function submitVideo() {
  const attributes = parseVideoEmbedHtml(videoForm.html.trim());

  if (!attributes) {
    videoErrorMessage.value =
      "Le code HTML doit contenir une iframe valide avec une URL.";
    return;
  }

  editor.value
    ?.chain()
    .focus()
    .insertContent({
      type: "videoEmbed",
      attrs: attributes,
    })
    .run();
  isVideoModalOpen.value = false;
  resetVideoForm();
}

async function saveArticle() {
  if (!article.value?.id || !editor.value || isSaving.value) {
    return;
  }

  isSaving.value = true;
  feedbackMessage.value = "";

  try {
    const formattedContent = formatEditorHtml(editorHtml.value);
    const updatedArticle = await updateBlogArticle(article.value.id, {
      title: title.value,
      content: formattedContent,
      slug: normalizeMetadataField(slug.value) || null,
      primaryKeyword: normalizeMetadataField(primaryKeyword.value) || null,
    requiredKeywords: normalizeMetadataField(requiredKeywords.value) || null,
    seoTitle: normalizeMetadataField(seoTitle.value) || null,
    seoDescription: normalizeMetadataField(seoDescription.value) || null,
    videoYoutubeUrl: normalizeMetadataField(videoYoutubeUrl.value) || null,
    shopifyBlogId: selectedShopifyBlogId.value || null,
  });

    article.value = updatedArticle;
    title.value = updatedArticle.title;
    editorHtml.value = formattedContent;
    markCurrentStateAsSaved(updatedArticle.title, formattedContent);
    savedMetadataSignature.value = buildMetadataSignature();
    feedbackMessage.value = "Article enregistré.";
    if (feedbackMessageTimer) {
      clearTimeout(feedbackMessageTimer);
    }
    feedbackMessageTimer = setTimeout(() => {
      if (feedbackMessage.value === "Article enregistré.") {
        feedbackMessage.value = "";
      }
      feedbackMessageTimer = null;
    }, 3000);
  } catch (error) {
    feedbackMessage.value = "Impossible d’enregistrer l’article.";
    console.error(error);
  } finally {
    isSaving.value = false;
  }
}

async function saveScriptAssets() {
  if (
    !article.value?.id ||
    isSavingScriptAssets.value ||
    !scriptAssetUrlsHasChanges.value
  ) {
    return;
  }

  isSavingScriptAssets.value = true;
  feedbackMessage.value = "";

  try {
    const updatedArticle = await updateBlogArticle(article.value.id, {
      scriptAssetUrls: normalizeScriptAssetUrlsText(scriptAssetUrlsText.value),
    });

    article.value = updatedArticle;
    scriptAssetUrlsText.value = formatScriptAssetUrlsText(
      updatedArticle.scriptAssetUrls,
    );
    savedScriptAssetUrlsSignature.value = buildScriptAssetUrlsSignature();
    feedbackMessage.value = "Scripts JS enregistrés.";

    if (feedbackMessageTimer) {
      clearTimeout(feedbackMessageTimer);
    }

    feedbackMessageTimer = setTimeout(() => {
      if (feedbackMessage.value === "Scripts JS enregistrés.") {
        feedbackMessage.value = "";
      }
      feedbackMessageTimer = null;
    }, 3000);
  } catch (error) {
    feedbackMessage.value = "Impossible d’enregistrer les scripts JS.";
    console.error(error);
  } finally {
    isSavingScriptAssets.value = false;
  }
}

async function loadPrimaryKeywordSerp(force = false) {
  const keyword = articlePrimaryKeyword.value;

  if (!keyword) {
    serpAnalysis.value = null;
    serpErrorMessage.value = "";
    lastLoadedSerpKeyword.value = "";
    return;
  }

  if (!force && lastLoadedSerpKeyword.value === keyword && serpAnalysis.value) {
    return;
  }

  isLoadingSerp.value = true;
  serpErrorMessage.value = "";

  try {
    const analysis = await analyzeKeyword(keyword);
    serpAnalysis.value = analysis;
    lastLoadedSerpKeyword.value = keyword;
  } catch (error) {
    serpAnalysis.value = null;
    serpErrorMessage.value =
      error instanceof Error
        ? error.message
        : "Impossible de charger la SERP de ce mot-clé.";
  } finally {
    isLoadingSerp.value = false;
  }
}

async function refreshPrimaryKeywordSerp() {
  if (isLoadingSerp.value || !articlePrimaryKeyword.value) {
    return;
  }

  await loadPrimaryKeywordSerp(true);
}

async function resetArticleChanges() {
  if (!article.value) {
    return;
  }

  await restoreSavedState();
  slug.value = article.value.slug ?? "";
  scriptAssetUrlsText.value = formatScriptAssetUrlsText(
    article.value.scriptAssetUrls,
  );
  primaryKeyword.value = article.value.primaryKeyword ?? "";
  primaryKeywordSearch.value = article.value.primaryKeyword ?? "";
  requiredKeywords.value = article.value.requiredKeywords ?? "";
  seoTitle.value = article.value.seoTitle ?? "";
  seoDescription.value = article.value.seoDescription ?? "";
  videoYoutubeUrl.value = article.value.videoYoutubeUrl ?? "";
  savedMetadataSignature.value = buildMetadataSignature();
  savedScriptAssetUrlsSignature.value = buildScriptAssetUrlsSignature();
  metadataDirtySince.value = null;
  metadataDirtyElapsedLabel.value = "";
  clearMetadataDirtyTimer();
  scriptAssetsDirtySince.value = null;
  scriptAssetsDirtyElapsedLabel.value = "";
  clearScriptAssetsDirtyTimer();
  feedbackMessage.value = "";
}

async function updateArticleMetadata(input: {
  title?: string;
  content?: string | null;
  slug?: string | null;
  primaryKeyword?: string | null;
  requiredKeywords?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  videoYoutubeUrl?: string | null;
  scriptAssetUrls?: string[] | null;
  authorId?: string | null;
  shopifyBlogId?: string | null;
  status?: BlogArticleStatus;
}) {
  if (!article.value?.id) {
    return null;
  }

  const updatedArticle = await updateBlogArticle(article.value.id, input);
  article.value = updatedArticle;
  await refreshRelatedData(updatedArticle);

  return updatedArticle;
}

async function onAuthorChange(nextAuthorId: string) {
  if (!article.value || isUpdatingAuthor.value || isDeletingArticle.value) {
    return;
  }

  const previousAuthorId = article.value.authorId ?? "";

  if (nextAuthorId === previousAuthorId) {
    return;
  }

  isUpdatingAuthor.value = true;

  try {
    const updatedArticle = await updateArticleMetadata({
      authorId: nextAuthorId || null,
    });

    selectedAuthorId.value = updatedArticle?.authorId ?? "";
  } catch (error) {
    selectedAuthorId.value = previousAuthorId;
    console.error(error);
  } finally {
    isUpdatingAuthor.value = false;
  }
}

async function onShopifyBlogChange(nextShopifyBlogId: string) {
  if (!article.value || isUpdatingShopifyBlog.value || isDeletingArticle.value) {
    return;
  }

  const previousShopifyBlogId = article.value.shopifyBlogId ?? "";

  if (nextShopifyBlogId === previousShopifyBlogId) {
    return;
  }

  isUpdatingShopifyBlog.value = true;

  try {
    const updatedArticle = await updateBlogArticle(article.value.id, {
      shopifyBlogId: nextShopifyBlogId || null,
    });

    selectedShopifyBlogId.value = updatedArticle?.shopifyBlogId ?? "";
    article.value.shopifyBlogId = updatedArticle?.shopifyBlogId ?? null;
  } catch (error) {
    selectedShopifyBlogId.value = previousShopifyBlogId;
    console.error(error);
  } finally {
    isUpdatingShopifyBlog.value = false;
  }
}

function onReviewAssigneeChange(nextReviewAssigneeId: string) {
  if (!article.value || isUpdatingReviewAssignment.value || isDeletingArticle.value) {
    return;
  }

  selectedReviewAssigneeId.value = nextReviewAssigneeId;
}

async function onAssignReview() {
  if (!article.value || isUpdatingReviewAssignment.value || isDeletingArticle.value) {
    return;
  }

  const reviewerId = selectedReviewAssigneeId.value.trim();

  if (!reviewerId) {
    showErrorToast("Choisis une personne à assigner en review.");
    return;
  }

  const reviewer = (projectMembers.value ?? []).find(
    (member) => member.id === reviewerId,
  );

  if (!reviewer) {
    showErrorToast("Le reviewer sélectionné n'est pas disponible sur ce projet.");
    return;
  }

  isUpdatingReviewAssignment.value = true;

  try {
    await assignBlogArticleReview(article.value.id, {
      supabaseUserId: reviewer.id,
      supabaseUserEmail: reviewer.email ?? null,
      supabaseUserName: reviewer.displayName ?? null,
    });

    await refreshNuxtData(`blog-article:${articleId.value}`);
    showSuccessToast("Review assignée avec succès.");
  } catch (error) {
    console.error(error);
  } finally {
    isUpdatingReviewAssignment.value = false;
  }
}

async function onStatusChange(nextStatus: BlogArticleStatus) {
  if (!article.value || isUpdatingStatus.value || isDeletingArticle.value) {
    return;
  }

  const previousStatus =
    (article.value.status as BlogArticleStatus | undefined) ?? "DRAFT";

  if (nextStatus === previousStatus) {
    return;
  }

  isUpdatingStatus.value = true;

  try {
    const updatedArticle = await updateArticleMetadata({
      status: nextStatus,
    });

    selectedStatus.value =
      (updatedArticle?.status as BlogArticleStatus | undefined) ?? "DRAFT";
  } catch (error) {
    selectedStatus.value = previousStatus;
    console.error(error);
  } finally {
    isUpdatingStatus.value = false;
  }
}

async function onPushToShopify() {
  if (
    !article.value ||
    isSaving.value ||
    isDeletingArticle.value ||
    isUpdatingStatus.value ||
    isPushingToShopify.value ||
    isTogglingShopifyVisibility.value
  ) {
    return;
  }

  const previousStatus =
    (article.value.status as BlogArticleStatus | undefined) ?? "DRAFT";
  const hadShopifyArticle = !!article.value.shopifyArticleId;

  isPushingToShopify.value = true;

  try {
    const formattedContent = formatEditorHtml(editorHtml.value);
    await updateArticleMetadata({
      title: title.value,
      content: formattedContent,
      scriptAssetUrls: normalizeScriptAssetUrlsText(scriptAssetUrlsText.value),
      slug: normalizeMetadataField(slug.value) || null,
      primaryKeyword: normalizeMetadataField(primaryKeyword.value) || null,
      requiredKeywords: normalizeMetadataField(requiredKeywords.value) || null,
      seoTitle: normalizeMetadataField(seoTitle.value) || null,
      seoDescription: normalizeMetadataField(seoDescription.value) || null,
      videoYoutubeUrl: normalizeMetadataField(videoYoutubeUrl.value) || null,
      authorId: selectedAuthorId.value || null,
      shopifyBlogId: selectedShopifyBlogId.value || null,
      status: "PUSHED",
    });
    feedbackMessage.value = hadShopifyArticle
      ? "Article Shopify mis à jour."
      : "Article poussé vers Shopify en masqué.";
    if (feedbackMessageTimer) {
      clearTimeout(feedbackMessageTimer);
    }
    feedbackMessageTimer = setTimeout(() => {
      if (
        feedbackMessage.value === "Article Shopify mis à jour." ||
        feedbackMessage.value === "Article poussé vers Shopify en masqué."
      ) {
        feedbackMessage.value = "";
      }
      feedbackMessageTimer = null;
    }, 3000);
  } catch (error) {
    selectedStatus.value = previousStatus;
    feedbackMessage.value = "Impossible de pousser l’article vers Shopify.";
    console.error(error);
  } finally {
    isPushingToShopify.value = false;
  }
}

async function updateShopifyVisibilityState(
  input: {
    status: BlogArticleStatus;
    plannedFor?: string | null;
  },
  options: {
    action: "publish" | "publish-now" | "unpublish" | "schedule" | "unschedule";
    successMessage: string;
    errorMessage: string;
  },
) {
  if (
    !article.value ||
    isSaving.value ||
    isDeletingArticle.value ||
    isUpdatingStatus.value ||
    isPushingToShopify.value ||
    isTogglingShopifyVisibility.value
  ) {
    return;
  }

  const previousSelectedStatus = selectedStatus.value;
  const previousStatus = article.value.status;
  const previousPlannedFor = article.value.plannedFor ?? null;
  const previousPublishedAt = article.value.publishedAt ?? null;

  isTogglingShopifyVisibility.value = true;
  activeShopifyAction.value = options.action;

  try {
    const updatedArticle = await updateBlogArticle(article.value.id, input);

    article.value.status = updatedArticle.status;
    article.value.plannedFor = updatedArticle.plannedFor ?? null;
    article.value.publishedAt = updatedArticle.publishedAt ?? null;
    article.value.url = updatedArticle.url ?? null;
    article.value.shopifyArticleId = updatedArticle.shopifyArticleId ?? null;
    article.value.shopifyBlogId = updatedArticle.shopifyBlogId ?? null;

    syncSelectedStatusSilently(getInitialSelectedStatus(updatedArticle));
    syncedShopifyPublishedAt.value = updatedArticle.publishedAt ?? null;
    feedbackMessage.value = options.successMessage;

    if (feedbackMessageTimer) {
      clearTimeout(feedbackMessageTimer);
    }

    feedbackMessageTimer = setTimeout(() => {
      if (feedbackMessage.value === options.successMessage) {
        feedbackMessage.value = "";
      }
      feedbackMessageTimer = null;
    }, 3000);
  } catch (error) {
    selectedStatus.value = previousSelectedStatus;
    article.value.status = previousStatus;
    article.value.plannedFor = previousPlannedFor;
    article.value.publishedAt = previousPublishedAt;
    feedbackMessage.value = options.errorMessage;
    console.error(error);
  } finally {
    activeShopifyAction.value = null;
    isTogglingShopifyVisibility.value = false;
  }
}

async function onPublishArticle() {
  await updateShopifyVisibilityState(
    {
      status: "PUBLISHED",
      plannedFor: null,
    },
    {
      action: "publish",
      successMessage: "Article publié sur Shopify.",
      errorMessage: "Impossible de publier l’article sur Shopify.",
    },
  );
}

async function onPublishArticleNow() {
  await updateShopifyVisibilityState(
    {
      status: "PUBLISHED",
      plannedFor: null,
    },
    {
      action: "publish-now",
      successMessage: "Article publié immédiatement sur Shopify.",
      errorMessage: "Impossible de publier immédiatement l’article sur Shopify.",
    },
  );
}

async function onUnpublishArticle() {
  await updateShopifyVisibilityState(
    {
      status: "PUSHED",
      plannedFor: null,
    },
    {
      action: "unpublish",
      successMessage: "Article dépublié sur Shopify.",
      errorMessage: "Impossible de dépublier l’article sur Shopify.",
    },
  );
}

async function onUnscheduleArticle() {
  await updateShopifyVisibilityState(
    {
      status: "PUSHED",
      plannedFor: null,
    },
    {
      action: "unschedule",
      successMessage: "Article déplanifié sur Shopify.",
      errorMessage: "Impossible de déplanifier l’article sur Shopify.",
    },
  );
}

async function onScheduleArticle(plannedFor: string) {
  await updateShopifyVisibilityState(
    {
      status: "PLANNED",
      plannedFor,
    },
    {
      action: "schedule",
      successMessage: "Article planifié sur Shopify.",
      errorMessage: "Impossible de planifier l’article sur Shopify.",
    },
  );
}

async function onDeleteArticle() {
  if (!article.value?.id || isDeletingArticle.value || !import.meta.client) {
    return;
  }

  const shouldDelete = window.confirm(
    "Voulez-vous vraiment supprimer cet article ?",
  );

  if (!shouldDelete) {
    return;
  }

  isDeletingArticle.value = true;

  try {
    const nextRoute = article.value.cluster?.id
      ? `/clusters/${article.value.cluster.id}`
      : "/clusters";

    await deleteBlogArticle(article.value.id);
    await refreshRelatedData(article.value);
    await router.push(nextRoute);
  } catch (error) {
    console.error(error);
  } finally {
    isDeletingArticle.value = false;
  }
}

watch(hasChanges, (value) => {
  if (!value || feedbackMessage.value !== "Article enregistré.") {
    return;
  }

  if (feedbackMessageTimer) {
    clearTimeout(feedbackMessageTimer);
    feedbackMessageTimer = null;
  }

  feedbackMessage.value = "";
});

onBeforeRouteLeave(() => {
  if (confirmLeavingWithUnsavedChanges()) {
    return true;
  }

  return false;
});

onMounted(() => {
  if (!import.meta.client) {
    return;
  }

  window.addEventListener("beforeunload", onWindowBeforeUnload);
});

onBeforeUnmount(() => {
  if (feedbackMessageTimer) {
    clearTimeout(feedbackMessageTimer);
  }

  clearMetadataDirtyTimer();
  clearScriptAssetsDirtyTimer();
  if (import.meta.client) {
    window.removeEventListener("beforeunload", onWindowBeforeUnload);
  }
});

setSaveHandler(saveArticle);

watch(selectedAuthorId, (value, previousValue) => {
  if (value === previousValue) {
    return;
  }

  void onAuthorChange(value);
});

watch(selectedReviewAssigneeId, (value, previousValue) => {
  if (value === previousValue) {
    return;
  }

  onReviewAssigneeChange(value);
});

watch(selectedStatus, (value, previousValue) => {
  if (isSyncingSelectedStatus.value) {
    return;
  }

  if (value === previousValue) {
    return;
  }

  void onStatusChange(value);
});

watch(
  [activeEditorTab, articlePrimaryKeyword],
  ([tab, keyword], [, previousKeyword]) => {
    if (tab !== "serp") {
      return;
    }

    if (!keyword) {
      serpAnalysis.value = null;
      serpErrorMessage.value = "";
      lastLoadedSerpKeyword.value = "";
      return;
    }

    void loadPrimaryKeywordSerp(keyword !== previousKeyword);
  },
  { immediate: true },
);

function onAsideVariantChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  setAsideVariant(target.value as typeof currentAsideVariant.value);
}

function onCodeLanguageChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  setCodeLanguage(target.value);
}
</script>

<template>
  <section class="space-y-6">
    <UBreadcrumb v-if="breadcrumbItems.length > 1" :items="breadcrumbItems" />

    <p v-if="status === 'pending'" class="text-sm text-slate-500">
      Chargement de l’article...
    </p>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :details="error.toString()"
      title="Impossible de charger cet article"
      description="Les données détaillées de l'article n'ont pas pu être récupérées."
    />

    <template v-else-if="article">
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div class="space-y-6">
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-for="tab in editorTabs"
              :key="tab.value"
              size="sm"
              color="neutral"
              :variant="activeEditorTab === tab.value ? 'solid' : 'soft'"
              @click="activeEditorTab = tab.value"
            >
              <UIcon :name="tab.icon" class="h-4 w-4" />
              {{ tab.label }}
            </UButton>

            <UButton
              v-if="isArticlePublishedOnShopify"
              size="sm"
              color="primary"
              variant="soft"
              icon="i-lucide-external-link"
              :to="publishedShopifyUrl"
              target="_blank"
            >
              Voir sur Shopify
            </UButton>
          </div>

          <template v-if="activeEditorTab === 'content'">
            <BlogArticleEditor
              v-model:title="title"
              v-model:editor-mode="editorMode"
              v-model:editor-html="editorHtml"
              v-model:script-asset-urls-text="scriptAssetUrlsText"
              v-model:is-color-picker-open="isColorPickerOpen"
              v-model:text-color="textColor"
              v-model:background-color="backgroundColor"
              :editor="editor"
              :current-block-format="currentBlockFormat"
              :editor-ready="isEditorReady()"
              :has-changes="articleHasChanges"
              :has-script-asset-changes="scriptAssetUrlsHasChanges"
              :status-message="statusMessage"
              :feedback-message="feedbackMessage"
              :is-typing-indicator-active="isTypingIndicatorActive"
              :is-saving="isSaving"
              :is-saving-script-assets="isSavingScriptAssets"
              :is-bold-active="isMarkActive('bold')"
              :is-italic-active="isMarkActive('italic')"
              :is-underline-active="isMarkActive('underline')"
              :is-align-left-active="isTextAlignActive('left')"
              :is-align-center-active="isTextAlignActive('center')"
              :is-align-right-active="isTextAlignActive('right')"
              :is-align-justify-active="isTextAlignActive('justify')"
              :is-bullet-list-active="isMarkActive('bulletList')"
              :is-ordered-list-active="isMarkActive('orderedList')"
              :is-info-aside-active="isMarkActive('calloutAside')"
              :is-callout-box-active="isMarkActive('calloutBox')"
              :is-code-block-active="isMarkActive('codeBlock')"
              :is-non-breaking-space-active="isNonBreakingSpaceActive"
              :is-keyboard-input-active="isKeyboardInputActive"
              :is-image-selected="isImageSelected"
              :is-link-active="isMarkActive('link')"
              :can-undo="canUndo"
              :can-redo="canRedo"
              :current-aside-variant="currentAsideVariant"
              :current-code-language="currentCodeLanguage"
              :current-callout-box-background-color="
                currentCalloutBoxBackgroundColor
              "
              :current-callout-box-border-color="currentCalloutBoxBorderColor"
              :current-custom-element-structure-type="
                currentCustomElementStructureType
              "
              :is-custom-element-structure-active="
                isCustomElementStructureActive
              "
              :on-block-format-change="onBlockFormatChange"
              :on-toggle-bold="() => editor?.chain().focus().toggleBold().run()"
              :on-toggle-italic="
                () => editor?.chain().focus().toggleItalic().run()
              "
              :on-toggle-underline="
                () => editor?.chain().focus().toggleUnderline().run()
              "
              :on-color-popover-interact-outside="onColorPopoverInteractOutside"
              :on-reset-text-color="resetTextColor"
              :on-color-picker-pointer-down="onColorPickerPointerDown"
              :on-color-picker-blur="onColorPickerBlur"
              :on-apply-text-color="applyTextColor"
              :on-reset-background-color="resetBackgroundColor"
              :on-apply-background-color="applyBackgroundColor"
              :on-set-text-alignment="setTextAlignment"
              :on-open-link-modal="openLinkModal"
              :on-remove-link="removeLink"
              :on-open-image-modal="openImageModal"
              :on-open-video-modal="openVideoModal"
              :on-insert-details-summary="insertDetailsElement"
              :on-insert-table="insertTable"
              :on-aside-variant-change="onAsideVariantChange"
              :on-code-language-change="onCodeLanguageChange"
              :on-insert-aside="insertAside"
              :on-insert-callout-box="insertCalloutBox"
              :on-insert-custom-element-structure="
                insertCustomElementStructure
              "
              :on-callout-box-background-color-change="
                setCalloutBoxBackgroundColor
              "
              :on-callout-box-border-color-change="setCalloutBoxBorderColor"
              :on-toggle-bullet-list="
                () => editor?.chain().focus().toggleBulletList().run()
              "
              :on-toggle-non-breaking-space="toggleNonBreakingSpace"
              :on-toggle-keyboard-input="toggleKeyboardInput"
              :on-toggle-ordered-list="
                () => editor?.chain().focus().toggleOrderedList().run()
              "
              :on-decrease-indent="decreaseIndent"
              :on-increase-indent="increaseIndent"
              :on-clear-formatting="clearFormatting"
              :on-delete-current-element="deleteCurrentEditorElement"
              :on-remove-custom-element-structure="
                removeCustomElementStructure
              "
              :on-undo="undo"
              :on-redo="redo"
              @save="saveArticle"
              @save-script-assets="saveScriptAssets"
            />
          </template>

          <template v-if="activeEditorTab === 'maillage'">
            <section class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div class="border-b border-slate-200 px-5 py-4">
                <h2 class="text-lg font-semibold text-slate-900">
                  Maillage interne
                </h2>
                <p class="mt-1 text-sm text-slate-500">
                  Mots-clés d'autres articles détectés dans le contenu de cet article.
                </p>
              </div>

              <div v-if="maillageRows.length" class="overflow-x-auto">
                <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th class="px-5 py-3">Mot-clé</th>
                      <th class="px-5 py-3">Articles associés</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-200 bg-white">
                    <tr
                      v-for="row in maillageRows"
                      :key="row.keyword"
                      class="align-top"
                    >
                      <td class="px-5 py-4 font-medium text-slate-900">
                        {{ row.keyword }}
                      </td>
                      <td class="px-5 py-4">
                        <div class="flex flex-wrap gap-2">
                          <NuxtLink
                            v-for="linkedArticle in row.articles"
                            :key="linkedArticle.id"
                            :to="`/articles/${linkedArticle.id}`"
                            class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
                          >
                            <span class="max-w-56 truncate">
                              {{ linkedArticle.title }}
                            </span>
                            <span
                              class="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                            >
                              {{
                                blogArticleStatusLabels[linkedArticle.status] ??
                                linkedArticle.status
                              }}
                            </span>
                          </NuxtLink>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div v-else class="px-5 py-6 text-sm text-slate-500">
                Aucun mot-clé d'un autre article n'a été détecté dans le contenu.
              </div>

              <div class="border-t border-slate-200 px-5 py-4">
                <h3 class="text-base font-semibold text-slate-900">
                  Mots-clés de la BDD détectés dans l'article
                </h3>
                <p class="mt-1 text-sm text-slate-500">
                  Liste des mots-clés enregistrés en base et réellement présents
                  dans le contenu de cet article.
                </p>
              </div>

              <div v-if="matchedDatabaseKeywords.length" class="overflow-x-auto">
                <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th class="px-5 py-3">Mot-clé</th>
                      <th class="px-5 py-3">Détails</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-200 bg-white">
                    <tr
                      v-for="keyword in matchedDatabaseKeywords"
                      :key="keyword.id"
                      class="align-top"
                    >
                      <td class="px-5 py-4 font-medium text-slate-900">
                        {{ keyword.keyword }}
                      </td>
                      <td class="px-5 py-4">
                        <div class="flex flex-wrap gap-2">
                          <NuxtLink
                            v-if="keyword.keywordGroup?.id && keyword.keywordGroup?.name"
                            :to="`/keyword-groups/${keyword.keywordGroup.id}`"
                            class="inline-flex items-center rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                          >
                            {{ keyword.keywordGroup.name }}
                          </NuxtLink>
                          <span
                            v-else
                            class="inline-flex items-center rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
                          >
                            Aucun groupe associé
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div v-else class="px-5 py-6 text-sm text-slate-500">
                Aucun mot-clé n'est disponible pour les autres articles.
              </div>

              <div class="border-t border-slate-200 px-5 py-4">
                <h3 class="text-base font-semibold text-slate-900">
                  Mots-clés liés à la page
                </h3>
                <p class="mt-1 text-sm text-slate-500">
                  Ces mots-clés sont rattachés à la page de l’article courant et
                  sont donc affichés à part.
                </p>
              </div>

              <div v-if="pageLinkedKeywords.length" class="overflow-x-auto">
                <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th class="px-5 py-3">Mot-clé</th>
                      <th class="px-5 py-3">Page associée</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-200 bg-white">
                    <tr
                      v-for="keyword in pageLinkedKeywords"
                      :key="keyword.id"
                      class="align-top"
                    >
                      <td class="px-5 py-4 font-medium text-slate-900">
                        {{ keyword.keyword }}
                      </td>
                      <td class="px-5 py-4">
                        <NuxtLink
                          v-if="keyword.page?.id && keyword.page?.title"
                          :to="`/pages/${keyword.page.id}`"
                          class="inline-flex items-center rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                        >
                          {{ keyword.page.title }}
                        </NuxtLink>
                        <span
                          v-else
                          class="inline-flex items-center rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
                        >
                          Page liée
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div v-else class="px-5 py-6 text-sm text-slate-500">
                Aucun mot-clé n'est lié à la page de cet article.
              </div>
            </section>
          </template>

          <template v-if="activeEditorTab === 'metadata'">
            <section
              class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div class="space-y-5">
                <div>
                  <h2 class="text-lg font-semibold text-slate-900">
                    Métadonnées
                  </h2>
                  <p class="mt-1 text-sm text-slate-500">
                    Renseigne les métadonnées SEO et les mots-clés de l’article.
                  </p>
                </div>

                <div class="grid gap-4 md:grid-cols-2">
                  <label class="block space-y-2">
                    <span class="text-sm font-medium text-slate-700">Slug</span>
                    <input
                      v-model="slug"
                      type="text"
                      placeholder="mon-slug-seo"
                      class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    />
                  </label>

                  <label class="block space-y-2">
                    <span class="text-sm font-medium text-slate-700"
                      >Mot-clé principal</span
                    >
                    <div class="relative">
                      <input
                        v-model="primaryKeywordSearch"
                        type="text"
                        placeholder="Rechercher un mot-clé"
                        class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                        @focus="isPrimaryKeywordSuggestionsOpen = true"
                        @input="isPrimaryKeywordSuggestionsOpen = true"
                        @keydown.esc="isPrimaryKeywordSuggestionsOpen = false"
                      />

                      <div
                        v-if="
                          isPrimaryKeywordSuggestionsOpen &&
                          primaryKeywordSuggestions.length
                        "
                        class="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
                      >
                        <button
                          v-for="keyword in primaryKeywordSuggestions"
                          :key="keyword.id"
                          type="button"
                          class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-sky-50 hover:text-sky-700"
                          @mousedown.prevent="selectPrimaryKeyword(keyword)"
                        >
                          <span class="min-w-0 truncate font-medium">
                            {{ keyword.keyword }}
                          </span>
                          <span
                            v-if="keyword.searchIntent"
                            class="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
                          >
                            {{ searchIntentLabels[keyword.searchIntent] }}
                          </span>
                        </button>
                      </div>
                    </div>
                  </label>
                </div>

                <label class="block space-y-2">
                  <span class="text-sm font-medium text-slate-700"
                    >Mots-clés obligatoires</span
                  >
                  <textarea
                    v-model="requiredKeywords"
                    rows="4"
                    placeholder="un mot-clé par ligne, ou séparés par des virgules"
                    class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>

                <label class="block space-y-2">
                  <span class="text-sm font-medium text-slate-700"
                    >Titre SEO</span
                  >
                  <input
                    v-model="seoTitle"
                    type="text"
                    placeholder="Titre SEO"
                    class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>

                <label class="block space-y-2">
                  <span class="text-sm font-medium text-slate-700"
                    >Description SEO</span
                  >
                  <textarea
                    v-model="seoDescription"
                    rows="4"
                    placeholder="Description SEO"
                    class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>

                <label class="block space-y-2">
                  <span class="text-sm font-medium text-slate-700"
                    >Vidéo YouTube</span
                  >
                  <input
                    v-model="videoYoutubeUrl"
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>

                <div class="flex justify-end pt-2">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-rotate-ccw"
                    :disabled="!hasChanges || isSaving"
                    @click="resetArticleChanges"
                  >
                    Annuler les modifications
                  </UButton>
                  <UButton
                    color="neutral"
                    variant="soft"
                    icon="i-lucide-save"
                    :loading="isSaving"
                    :disabled="isSaving"
                    @click="saveArticle"
                  >
                    Sauvegarder les modifications
                  </UButton>
                </div>
              </div>
            </section>
          </template>

          <template v-if="activeEditorTab === 'cluster'">
            <section
              class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div class="space-y-5">
                <div>
                  <h2 class="text-lg font-semibold text-slate-900">Cluster</h2>
                  <p class="mt-1 text-sm text-slate-500">
                    Informations du cluster associe a cet article.
                  </p>
                </div>

                <div
                  v-if="!articleClusterName"
                  class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500"
                >
                  Aucun cluster n'est associe a cet article.
                </div>

                <div v-else class="grid gap-4">
                  <div
                    class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <p
                      class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"
                    >
                      Nom du cluster
                    </p>
                    <p class="mt-2 text-base font-semibold text-slate-900">
                      {{ articleClusterName }}
                    </p>
                  </div>

                  <div
                    class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <p
                          class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"
                        >
                          Nom de l'article pilier
                        </p>
                        <p
                          class="mt-2 break-words text-base font-semibold text-slate-900"
                        >
                          {{
                            clusterPillarArticle.title ||
                            "Aucun article pilier defini"
                          }}
                        </p>
                      </div>

                      <UButton
                        color="neutral"
                        variant="soft"
                        size="sm"
                        icon="i-lucide-clipboard-copy"
                        :disabled="!clusterPillarArticle.title"
                        @click="
                          copyValueToClipboard(
                            clusterPillarArticle.title,
                            `Le nom de l'article pilier`,
                          )
                        "
                      >
                        Copier
                      </UButton>
                    </div>
                  </div>

                  <div
                    class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <p
                          class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"
                        >
                          Slug de l'article pilier
                        </p>
                        <p
                          class="mt-2 break-all font-mono text-sm text-slate-900"
                        >
                          {{
                            clusterPillarArticle.slug || "Aucun slug disponible"
                          }}
                        </p>
                      </div>

                      <UButton
                        color="neutral"
                        variant="soft"
                        size="sm"
                        icon="i-lucide-clipboard-copy"
                        :disabled="!clusterPillarArticle.slug"
                        @click="
                          copyValueToClipboard(
                            clusterPillarArticle.slug,
                            `Le slug de l'article pilier`,
                          )
                        "
                      >
                        Copier
                      </UButton>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </template>

          <template v-if="activeEditorTab === 'serp'">
            <section
              class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
            >
              <div class="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 class="text-lg font-semibold text-slate-900">
                    SERP du mot-clé principal
                  </h2>
                  <p class="mt-1 text-sm text-slate-500">
                    Resultats Google pour
                    <span class="font-medium text-slate-700">
                      {{ articlePrimaryKeyword || "ce mot-cle" }}
                    </span>
                    .
                  </p>
                </div>

                <UButton
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-refresh-cw"
                  :loading="isLoadingSerp"
                  :disabled="!articlePrimaryKeyword"
                  @click="refreshPrimaryKeywordSerp"
                >
                  Rafraîchir la SERP
                </UButton>
              </div>

              <div
                v-if="!articlePrimaryKeyword"
                class="px-5 py-6 text-sm text-slate-500"
              >
                Renseignez un mot-cle principal pour afficher la SERP.
              </div>

              <div
                v-else-if="isLoadingSerp"
                class="px-5 py-6 text-sm text-slate-500"
              >
                Chargement de la SERP...
              </div>

              <FeedbackInlineMessage
                v-else-if="serpErrorMessage"
                tone="error"
                class="m-5"
              >
                {{ serpErrorMessage }}
              </FeedbackInlineMessage>

              <div
                v-else-if="serpAnalysis?.serpResults?.length"
                class="divide-y divide-slate-200"
              >
                <article
                  v-for="result in serpAnalysis.serpResults"
                  :key="`${result.position}-${result.url}`"
                  class="space-y-2 px-5 py-4 transition"
                  :class="getSerpResultCardClass(result)"
                >
                  <div class="flex items-center gap-3">
                    <span
                      class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700"
                    >
                      {{ result.position }}
                    </span>

                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <UTooltip :text="getSerpTypeDescription(result)">
                          <UBadge
                            variant="soft"
                            :class="getSerpTypeColor(result.type)"
                          >
                            <span class="inline-flex items-center gap-1.5">
                              <UIcon
                                :name="getSerpTypeIcon(result.type)"
                                class="size-3.5"
                              />
                              {{ formatSerpType(result.type) }}
                            </span>
                          </UBadge>
                        </UTooltip>

                        <UBadge
                          v-if="result.knownAgencySite"
                          variant="soft"
                          class="bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200"
                        >
                          <span class="inline-flex items-center gap-1.5">
                            <UIcon
                              name="i-lucide-building-2"
                              class="size-3.5"
                            />
                            {{ getKnownAgencySiteLabel(result) }}
                          </span>
                        </UBadge>
                      </div>

                      <h3 class="mt-2 font-medium text-slate-900">
                        {{ result.title }}
                      </h3>

                      <a
                        v-if="result.url"
                        :href="result.url"
                        target="_blank"
                        rel="noreferrer"
                        class="break-all text-sm text-sky-700 underline underline-offset-2"
                      >
                        {{ result.url }}
                      </a>

                      <p v-else class="text-sm text-slate-400">
                        Pas d'URL directe pour ce bloc SERP.
                      </p>

                      <a
                        v-if="result.checkUrl"
                        :href="result.checkUrl"
                        target="_blank"
                        rel="noreferrer"
                        class="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
                      >
                        <UIcon name="i-lucide-external-link" class="size-3.5" />
                        Ouvrir le check_url
                      </a>
                    </div>
                  </div>

                  <p class="text-sm leading-6 text-slate-600">
                    {{ result.snippet }}
                  </p>
                </article>
              </div>

              <div v-else class="px-5 py-6 text-sm text-slate-500">
                Aucun resultat SERP disponible pour ce mot-cle.
              </div>
            </section>
          </template>

          <template v-if="activeEditorTab === 'checklist'">
            <ClientOnly>
              <ArticleSeoChecklist :sections="checklistSections" />
            </ClientOnly>
          </template>
        </div>

        <BlogArticleActionsPanel
          v-model:selected-author-id="selectedAuthorId"
          v-model:selected-review-assignee-id="selectedReviewAssigneeId"
          v-model:selected-shopify-blog-id="selectedShopifyBlogId"
          :selected-status="selectedStatus"
          :shopify-article-id="article.shopifyArticleId ?? ''"
          :scheduled-for="
            syncedShopifyPublishedAt && isDateAfterToday(syncedShopifyPublishedAt)
              ? syncedShopifyPublishedAt
              : article.plannedFor
          "
          :active-shopify-action="activeShopifyAction"
          :authors="authors ?? []"
          :review-assignees="reviewAssignees"
          :blogs="shopifyBlogs ?? []"
          :is-updating-author="isUpdatingAuthor"
          :is-updating-review-assignment="isUpdatingReviewAssignment"
          :is-updating-blog="isUpdatingShopifyBlog"
          :is-updating-status="isUpdatingStatus"
          :is-deleting-article="isDeletingArticle"
          :is-pushing-to-shopify="isPushingToShopify"
          :is-toggling-shopify-visibility="isTogglingShopifyVisibility"
          @push-to-shopify="onPushToShopify"
          @assign-review="onAssignReview"
          @publish="onPublishArticle"
          @publish-now="onPublishArticleNow"
          @unpublish="onUnpublishArticle"
          @schedule="onScheduleArticle"
          @unschedule="onUnscheduleArticle"
          @update:selected-shopify-blog-id="onShopifyBlogChange"
          @delete="onDeleteArticle"
        />
      </div>
    </template>

    <UModal
      v-model:open="isLinkModalOpen"
      :title="linkModalTitle"
      :dismissible="true"
      @update:open="(value) => !value && resetLinkForm()"
    >
      <template #body>
        <div class="space-y-4">
          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700">Lien</span>
            <input
              v-model="linkForm.href"
              type="url"
              placeholder="https://example.com"
              class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
          </label>

          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700"
              >Type de lien interne</span
            >
            <USelect
              :model-value="selectedPredefinedLinkType"
              :items="[
                { label: 'Page offre', value: 'offer' },
                { label: 'Page article de blog', value: 'blog-article' },
              ]"
              value-key="value"
              label-key="label"
              placeholder="Choisir un type"
              @update:model-value="applyPredefinedLinkType"
            />
          </label>

          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700"
              >Lien interne prédéfini</span
            >
            <USelect
              :model-value="selectedPredefinedLink"
              :items="selectedPredefinedLinkOptions"
              value-key="value"
              label-key="label"
              :placeholder="
                selectedPredefinedLinkType === 'offer'
                  ? 'Choisir une page offre'
                  : selectedPredefinedLinkType === 'blog-article'
                    ? 'Choisir un article de blog'
                    : 'Choisis d’abord un type'
              "
              :disabled="!selectedPredefinedLinkType"
              @update:model-value="applyPredefinedLink"
            />
          </label>

          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700"
              >Titre du lien</span
            >
            <input
              v-model="linkForm.title"
              type="text"
              placeholder="Texte affiché"
              class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
          </label>

          <label class="flex items-center gap-3 text-sm text-slate-700">
            <input
              v-model="linkForm.openInNewTab"
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>Ouvrir dans un nouvel onglet</span>
          </label>

          <p v-if="linkErrorMessage" class="text-sm text-red-600">
            {{ linkErrorMessage }}
          </p>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="soft"
            @click="isLinkModalOpen = false"
          >
            Annuler
          </UButton>
          <UButton @click="submitLink">{{ linkModalSubmitLabel }}</UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isImageModalOpen"
      :title="imageModalTitle"
      :dismissible="true"
      @update:open="(value) => !value && resetImageForm()"
    >
      <template #body>
        <div class="space-y-4">
          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700">Lien</span>
            <input
              v-model="imageForm.src"
              type="url"
              placeholder="https://example.com/image.jpg"
              class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
          </label>

          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700"
              >Alt de l’image</span
            >
            <input
              v-model="imageForm.alt"
              type="text"
              placeholder="Description de l’image"
              class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
          </label>

          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700">Légende</span>
            <textarea
              v-model="imageForm.caption"
              rows="3"
              placeholder="Légende associée à l’image"
              class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
          </label>

          <p v-if="imageErrorMessage" class="text-sm text-red-600">
            {{ imageErrorMessage }}
          </p>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="soft"
            @click="isImageModalOpen = false"
          >
            Annuler
          </UButton>
          <UButton @click="submitImage">{{ imageModalSubmitLabel }}</UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isVideoModalOpen"
      title="Insérer une vidéo"
      :dismissible="true"
      @update:open="(value) => !value && resetVideoForm()"
    >
      <template #body>
        <div class="space-y-4">
          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700"
              >Code HTML à insérer</span
            >
            <textarea
              v-model="videoForm.html"
              rows="8"
              placeholder='<iframe src="..." title="..." allowfullscreen></iframe>'
              class="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
          </label>

          <p class="text-sm text-slate-500">
            Les embeds vidéo sont extraits depuis une iframe contenue dans ce
            HTML.
          </p>

          <p v-if="videoErrorMessage" class="text-sm text-red-600">
            {{ videoErrorMessage }}
          </p>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="soft"
            @click="isVideoModalOpen = false"
          >
            Annuler
          </UButton>
          <UButton @click="submitVideo">Insérer la vidéo</UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>

<style scoped>
:deep(.ProseMirror p.is-editor-empty:first-child::before) {
  color: #94a3b8;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

:deep(.ProseMirror) {
  line-height: 1.8;
  padding-left: 3.5rem;
}

:deep(.editor-preview-content) {
  line-height: 1.75;
}

:deep(.ProseMirror .details-element),
:deep(.editor-preview-content .details-element) {
  border: 1px solid #cbd5e1;
  border-radius: 1rem;
  margin: 1.25rem 0;
  padding: 1rem 1.1rem;
}

:deep(.ProseMirror .details-element__summary),
:deep(.editor-preview-content .details-element__summary) {
  cursor: pointer;
  font-weight: 700;
  color: #0f172a;
}

:deep(.ProseMirror .details-element__content),
:deep(.editor-preview-content .details-element__content) {
  color: #334155;
  margin-top: 0.75rem;
}

:deep(.ProseMirror .editor-figure-image),
:deep(.editor-preview-content .editor-figure-image) {
  margin: 1.25rem 0;
}

:deep(.ProseMirror .editor-figure-image__img),
:deep(.editor-preview-content .editor-figure-image__img) {
  display: block;
  height: auto;
  width: 100%;
}

:deep(.ProseMirror .editor-figure-image__caption),
:deep(.editor-preview-content .editor-figure-image__caption) {
  color: #64748b;
  font-size: 0.875rem;
  line-height: 1.6;
  margin-top: 0.5rem;
  text-align: center;
}

:deep(.shopify-content a) {
  color: var(--color-primary-600);
  text-decoration: underline;
}

:deep(.ProseMirror h1) {
  font-size: 2.25rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.1;
  margin: 2rem 0 1rem;
  position: relative;
}

:deep(.ProseMirror h1)::before {
  color: #94a3b8;
  content: "H1";
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 0.75rem;
  font-weight: 700;
  left: -3rem;
  letter-spacing: 0.08em;
  position: absolute;
  text-transform: uppercase;
  top: 0.35rem;
}

:deep(.editor-preview-content h1) {
  font-size: 2.25rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.1;
  margin: 2rem 0 1rem;
}

:deep(.shopify-content h2),
:deep(.shopify-content .h2) {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  margin-top: 2rem;
}

:deep(.ProseMirror h2) {
  font-size: 1.875rem;
  font-weight: 750;
  letter-spacing: -0.03em;
  line-height: 1.15;
  margin: 1.75rem 0 0.9rem;
  position: relative;
}

:deep(.ProseMirror h2)::before {
  color: #94a3b8;
  content: "H2";
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 0.75rem;
  font-weight: 700;
  left: -3rem;
  letter-spacing: 0.08em;
  position: absolute;
  text-transform: uppercase;
  top: 0.25rem;
}

:deep(.editor-preview-content h2) {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  margin-top: 2rem;
}

:deep(.shopify-content h3),
:deep(.shopify-content .h3) {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  margin-top: 2rem;
}

:deep(.ProseMirror h3) {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.2;
  margin: 1.5rem 0 0.8rem;
  position: relative;
}

:deep(.ProseMirror h3)::before {
  color: #94a3b8;
  content: "H3";
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 0.75rem;
  font-weight: 700;
  left: -3rem;
  letter-spacing: 0.08em;
  position: absolute;
  text-transform: uppercase;
  top: 0.15rem;
}

:deep(.editor-preview-content h3) {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  margin-top: 2rem;
}

:deep(.shopify-content h4),
:deep(.shopify-content .h4) {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 1rem;
  margin-top: 2rem;
}

:deep(.ProseMirror h4) {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.25;
  margin: 1.35rem 0 0.75rem;
  position: relative;
}

:deep(.ProseMirror h4)::before {
  color: #94a3b8;
  content: "H4";
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 0.75rem;
  font-weight: 700;
  left: -3rem;
  letter-spacing: 0.08em;
  position: absolute;
  text-transform: uppercase;
  top: 0.05rem;
}

:deep(.editor-preview-content h4) {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 1rem;
  margin-top: 2rem;
}

:deep(.ProseMirror h5) {
  font-size: 1.125rem;
  font-weight: 650;
  line-height: 1.3;
  margin: 1.2rem 0 0.7rem;
  position: relative;
}

:deep(.ProseMirror h5)::before {
  color: #94a3b8;
  content: "H5";
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 0.75rem;
  font-weight: 700;
  left: -3rem;
  letter-spacing: 0.08em;
  position: absolute;
  text-transform: uppercase;
  top: 0;
}

:deep(.editor-preview-content h5) {
  font-size: 1.125rem;
  font-weight: 650;
  margin: 1.2rem 0 0.7rem;
}

:deep(.ProseMirror h6) {
  font-size: 1rem;
  font-weight: 650;
  letter-spacing: 0.01em;
  line-height: 1.35;
  margin: 1.1rem 0 0.65rem;
  position: relative;
}

:deep(.ProseMirror h6)::before {
  color: #94a3b8;
  content: "H6";
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 0.75rem;
  font-weight: 700;
  left: -3rem;
  letter-spacing: 0.08em;
  position: absolute;
  text-transform: uppercase;
  top: -0.05rem;
}

:deep(.editor-preview-content h6) {
  font-size: 1rem;
  font-weight: 650;
  letter-spacing: 0.01em;
  margin: 1.1rem 0 0.65rem;
}

:deep(.shopify-content p) {
  /*color: color-mix(in srgb, currentColor 85%, transparent);*/
  line-height: 1.75;
}

:deep(.shopify-content strong) {
  color: inherit;
  font-weight: 600;
}

:deep(.shopify-content em) {
  font-style: italic;
}

:deep(.shopify-content u) {
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.15em;
}

:deep(.shopify-content :is(p, ul)) {
  margin-block-end: 1rem;
  margin-block-start: 1rem;
}

:deep(.ProseMirror blockquote) {
  border-left: 4px solid #cbd5e1;
  color: #475569;
  margin: 1.5rem 0;
  padding-left: 1rem;
}

:deep(.editor-preview-content blockquote) {
  background-color: color-mix(in srgb, var(--color-primary-600) 6%, white);
  border-color: color-mix(in srgb, var(--color-primary-600) 30%, transparent);
  border-left-width: 4px;
  color: color-mix(in srgb, currentColor 80%, transparent);
  font-style: italic;
  margin: 1.5rem 0;
  padding: 1rem 1.25rem;
}

:deep(.shopify-content blockquote) {
  background-color: color-mix(in srgb, var(--color-primary-600) 6%, white);
  border-color: color-mix(in srgb, var(--color-primary-600) 30%, transparent);
  border-left-width: 4px;
  color: color-mix(in srgb, currentColor 80%, transparent);
  font-style: italic;
  margin: 1.5rem 0;
  padding: 1rem 1.25rem;
}

:deep(.shopify-content blockquote p) {
  margin: 0;
}

:deep(.ProseMirror pre) {
  background: #0f172a;
  border-radius: 1rem;
  color: #e2e8f0;
  margin: 1.5rem 0;
  overflow-x: auto;
  padding: 1rem 1.25rem;
}

:deep(.editor-preview-content pre) {
  background: rgb(10 10 10);
  border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
  border-radius: 1rem;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  color: white;
  margin: 1.5rem 0;
  overflow-x: auto;
  padding: 1rem 1.25rem;
}

:deep(.shopify-content pre) {
  background: rgb(10 10 10);
  border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
  border-radius: 1rem;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  color: white;
  font-size: 0.875rem;
  line-height: 1.5rem;
  margin: 1.5rem 0;
  overflow-x: auto;
  padding: 1rem 1.25rem;
}

:deep(.ProseMirror pre code) {
  background: transparent;
  color: inherit;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 0.95rem;
  padding: 0;
}

:deep(.editor-preview-content pre code) {
  background: transparent;
  color: inherit;
  display: block;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 0.95rem;
  padding: 0;
}

:deep(.shopify-content pre code) {
  display: block;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
}

:deep(.shopify-content :is(code):not(pre code)) {
  background: color-mix(in srgb, currentColor 8%, transparent);
  border-radius: 0.375rem;
  color: inherit;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 0.95em;
  padding: 0.125rem 0.375rem;
}

:deep(.ProseMirror .editor-callout-aside),
:deep(.editor-preview-content .editor-callout-aside),
:deep(.ProseMirror .editor-info-aside),
:deep(.editor-preview-content .editor-info-aside) {
  border-radius: 1rem;
  margin: 1.5rem 0;
  padding: 1rem 1.25rem;
}

:deep(.shopify-content .editor-callout-aside) {
  border-radius: 0.5rem;
  border-width: 1px;
  margin: 1.5rem 0;
  padding: 1rem 1.25rem;
}

:deep(.ProseMirror .editor-callout-aside--info),
:deep(.editor-preview-content .editor-callout-aside--info),
:deep(.ProseMirror .editor-info-aside),
:deep(.editor-preview-content .editor-info-aside) {
  background: #eff6ff;
  border: 1px solid #93c5fd;
  border-left: 4px solid #2563eb;
  color: #1e3a8a;
}

:deep(.shopify-content .editor-callout-aside--info) {
  background-color: rgb(240 249 255);
  border-color: rgb(186 230 253);
  color: rgb(8 47 73);
}

:deep(.ProseMirror .editor-callout-aside--warning),
:deep(.editor-preview-content .editor-callout-aside--warning) {
  background: #fff7ed;
  border: 1px solid #fdba74;
  border-left: 4px solid #ea580c;
  color: #9a3412;
}

:deep(.shopify-content .editor-callout-aside--warning) {
  background-color: rgb(254 242 242);
  border-color: rgb(254 202 202);
  color: rgb(69 10 10);
}

:deep(.ProseMirror .editor-callout-aside--success),
:deep(.editor-preview-content .editor-callout-aside--success) {
  background: #ecfdf5;
  border: 1px solid #86efac;
  border-left: 4px solid #16a34a;
  color: #166534;
}

:deep(.shopify-content .editor-callout-aside--success) {
  background-color: rgb(236 253 245);
  border-color: rgb(167 243 208);
  color: rgb(2 44 34);
}

:deep(.ProseMirror .editor-callout-aside--tip),
:deep(.editor-preview-content .editor-callout-aside--tip) {
  background: #f5f3ff;
  border: 1px solid #c4b5fd;
  border-left: 4px solid #7c3aed;
  color: #5b21b6;
}

:deep(.shopify-content .editor-callout-aside--tip) {
  background-color: rgb(245 243 255);
  border-color: rgb(221 214 254);
  color: rgb(46 16 101);
}

:deep(.ProseMirror .editor-callout-aside p),
:deep(.editor-preview-content .editor-callout-aside p),
:deep(.ProseMirror .editor-info-aside p),
:deep(.editor-preview-content .editor-info-aside p) {
  margin: 0;
}

:deep(.shopify-content .editor-callout-aside p) {
  margin: 0;
}

:deep(.ProseMirror .editor-callout-box),
:deep(.editor-preview-content .editor-callout-box) {
  background: var(--editor-callout-box-background-color, #f8fafc);
  border-left: 5px solid var(--editor-callout-box-border-color, #cbd5e1);
  margin: 1.5rem 0;
  padding: 1rem 1.25rem;
}

:deep(.shopify-content .editor-callout-box) {
  background: var(--editor-callout-box-background-color, #f8fafc);
  border-left: 5px solid var(--editor-callout-box-border-color, #cbd5e1);
  margin: 1.5rem 0;
  padding: 1rem 1.25rem;
}

:deep(.ProseMirror .editor-callout-box p),
:deep(.editor-preview-content .editor-callout-box p),
:deep(.shopify-content .editor-callout-box p) {
  margin: 0;
}

:deep(.ProseMirror ul),
:deep(.ProseMirror ol) {
  padding-left: 1.5rem;
}

:deep(.editor-preview-content ul),
:deep(.editor-preview-content ol) {
  padding-left: 1.5rem;
}

:deep(.ProseMirror ul) {
  list-style: disc;
}

:deep(.editor-preview-content ul) {
  list-style: disc;
}

:deep(.ProseMirror ol) {
  list-style: decimal;
}

:deep(.editor-preview-content ol) {
  list-style: decimal;
}

:deep(.ProseMirror li) {
  margin: 0.25rem 0;
}

:deep(.editor-preview-content li) {
  margin: 0.25rem 0;
}

:deep(.ProseMirror .editor-table),
:deep(.ProseMirror table) {
  border-collapse: collapse;
  margin: 1.5rem 0;
  table-layout: fixed;
  width: 100%;
}

:deep(.editor-preview-content .editor-table),
:deep(.editor-preview-content table) {
  border-collapse: collapse;
  margin: 1.5rem 0;
  table-layout: fixed;
  width: 100%;
}

:deep(.ProseMirror table td),
:deep(.ProseMirror table th) {
  border: 1px solid #cbd5e1;
  min-width: 120px;
  padding: 0.75rem;
  vertical-align: top;
}

:deep(.editor-preview-content table td),
:deep(.editor-preview-content table th) {
  border: 1px solid #cbd5e1;
  min-width: 120px;
  padding: 0.75rem;
  vertical-align: top;
}

:deep(.ProseMirror table th) {
  background: #f8fafc;
  font-weight: 600;
}

:deep(.editor-preview-content table th) {
  background: #f8fafc;
  font-weight: 600;
}

:deep(.ProseMirror .selectedCell:after) {
  background: rgba(14, 165, 233, 0.12);
  content: "";
  inset: 0;
  pointer-events: none;
  position: absolute;
}

:deep(.ProseMirror table td),
:deep(.ProseMirror table th) {
  position: relative;
}

:deep(.ProseMirror .editor-video-embed) {
  margin: 1.5rem 0;
}

:deep(.editor-preview-content .editor-video-embed) {
  margin: 1.5rem 0;
}

:deep(.ProseMirror .editor-video-embed iframe) {
  aspect-ratio: 16 / 9;
  border: 0;
  border-radius: 1rem;
  display: block;
  width: 100%;
}

:deep(.editor-preview-content .editor-video-embed iframe) {
  aspect-ratio: 16 / 9;
  border: 0;
  border-radius: 1rem;
  display: block;
  width: 100%;
}

.typing-dots {
  display: inline-flex;
  gap: 0.05rem;
  margin-left: 0.1rem;
}

.typing-dots span {
  display: inline-block;
  opacity: 0.45;
  transform: translateY(0);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.typing-dots.is-active span {
  animation: typing-dot-caterpillar 0.9s ease-in-out infinite;
  opacity: 0.95;
}

.typing-dots.is-active span:nth-child(2) {
  animation-delay: 0.12s;
}

.typing-dots.is-active span:nth-child(3) {
  animation-delay: 0.24s;
}

@keyframes typing-dot-caterpillar {
  0%,
  100% {
    opacity: 0.45;
    transform: translateY(0);
  }

  30% {
    opacity: 1;
    transform: translateY(-0.2rem);
  }

  55% {
    opacity: 0.85;
    transform: translateY(0.05rem);
  }
}
</style>
