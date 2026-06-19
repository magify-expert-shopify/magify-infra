<script setup lang="ts">
import { blogArticleStatusLabels } from "~/constants/blog-articles";
import { useAppToast } from "~/composables/useAppToast";
import { useBlogArticles } from "~/composables/useBlogArticles";
import { useProjects } from "~/composables/useProjects";
import { isShopifyUnavailableError } from "~/utils/shopify-errors";
import type { BlogArticle } from "~/types/domain";
import type { ShopifyBlogArticleListItem } from "~/types/shopify";

const { request } = useApi();
const { currentProject } = useCurrentProject();
const {
  assignBlogArticleReview,
  updateBlogArticle,
  syncBlogArticleStatusesFromShopify,
} = useBlogArticles();
const { useProjectMembers } = useProjects();
const { getBlogArticlesList } = useShopify();
const { showErrorToast, showSuccessToast } = useAppToast();

const projectId = computed(() => currentProject.value?.id ?? "");
const { data: projectMembers } = useProjectMembers(projectId);
const monthCursor = ref(getMonthStart(new Date()));
const selectedArticleId = ref<string | null>(null);
const isReviewPlanningMode = ref(false);
const scheduledDateInput = ref("");
const isSavingDate = ref(false);
const isRefreshingCalendar = ref(false);
const draggedArticleId = ref<string | null>(null);
const dragOverDayKey = ref<string | null>(null);
const isDragOverUnscheduled = ref(false);
const hideDraftArticles = ref(true);
const isTodaySchedulingModalOpen = ref(false);
const pendingTodayDropArticle = ref<CalendarArticle | null>(null);
const pendingTodayDropDayKey = ref("");
const todayScheduleTimeInput = ref("");
const isReviewAssigneeModalOpen = ref(false);
const pendingReviewDropArticle = ref<CalendarArticle | null>(null);
const pendingReviewDropDayKey = ref("");
const selectedReviewAssigneeId = ref("");

const {
  data: articles,
  error,
  status,
  refresh,
} = await useAsyncData(
  () => `blog-articles-calendar:${projectId.value || "no-project"}`,
  () =>
    request<BlogArticle[]>("/blog-articles", {
      query: {
        projectId: projectId.value,
      },
    }),
  {
    watch: [projectId],
    default: () => [],
  },
);

const {
  data: shopifyArticles,
  error: shopifyArticlesError,
  status: shopifyArticlesStatus,
  refresh: refreshShopifyArticles,
} = await useAsyncData(
  () => `shopify-blog-articles-calendar:${projectId.value || "no-project"}`,
  async () => {
    if (!projectId.value) {
      return [];
    }

    return await getBlogArticlesList({
      includePublishedAt: true,
    });
  },
  {
    watch: [projectId],
    default: () => [],
  },
);

type CalendarArticle = {
  id: string;
  title: string;
  status: BlogArticle["status"];
  plannedFor?: string | null;
  reviewDueAt?: string | null;
  reviewCompletedAt?: string | null;
  reviewOutcome?: "APPROVED" | "REJECTED" | null;
  publishedAt?: string | null;
  url?: string | null;
  authorName?: string | null;
  authorAvatarUrl?: string | null;
  reviewSupabaseUserId?: string | null;
  reviewSupabaseUserEmail?: string | null;
  reviewSupabaseUserName?: string | null;
  source: "local" | "shopify";
  localArticleId?: string | null;
  shopifyArticleId?: string | null;
};

const breadcrumbItems = [
  {
    label: "Accueil",
    to: "/",
  },
  {
    label: "Calendrier éditorial",
  },
];

const monthLabel = computed(() =>
  new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(monthCursor.value),
);

const calendarDateFieldLabel = computed(() =>
  isReviewPlanningMode.value ? "Date de review" : "Date de parution planifiée",
);

const selectedDateDetailLabel = computed(() =>
  isReviewPlanningMode.value ? "Date de review" : "Date publiée",
);

const selectedDatePanelTitle = computed(() =>
  isReviewPlanningMode.value ? "Gestion des reviews" : "Gestion des dates",
);

const selectedDatePanelDescription = computed(() =>
  isReviewPlanningMode.value
    ? "Sélectionne un article dans le calendrier ou dans la liste des articles sans date pour planifier sa review."
    : "Sélectionne un article dans le calendrier ou dans la liste des articles sans date pour planifier sa parution.",
);

const unscheduledSectionTitle = computed(() =>
  isReviewPlanningMode.value ? "Articles sans review" : "Articles sans date",
);

const unscheduledSectionDescription = computed(() =>
  isReviewPlanningMode.value
    ? "Donne-leur une date de review pour les faire apparaître dans le calendrier."
    : "Donne-leur une date pour les faire apparaître dans le calendrier.",
);

const calendarSuccessLabel = computed(() =>
  isReviewPlanningMode.value ? "Review enregistrée" : "Date enregistrée",
);

const calendarSuccessDescription = computed(() =>
  isReviewPlanningMode.value
    ? "La date de review a bien été enregistrée."
    : "La date de parution a bien été planifiée.",
);

const calendarClearedSuccessDescription = computed(() =>
  isReviewPlanningMode.value
    ? "La date de review a bien été retirée."
    : "La date planifiée a bien été retirée.",
);

const calendarArticles = computed<CalendarArticle[]>(() => {
  const localArticles = (articles.value ?? []).map((article) =>
    mapLocalArticleToCalendarArticle(article),
  );
  const linkedShopifyIds = new Set(
    localArticles
      .map((article) => article.shopifyArticleId?.trim())
      .filter((value): value is string => Boolean(value)),
  );
  const publishedShopifyArticles = (shopifyArticles.value ?? [])
    .filter((article) => article.publishedAt)
    .filter((article) => !linkedShopifyIds.has(article.id))
    .map((article) => mapShopifyArticleToCalendarArticle(article));

  return [...localArticles, ...publishedShopifyArticles];
});

const visibleCalendarArticles = computed(() =>
  calendarArticles.value.filter((article) =>
    hideDraftArticles.value ? article.status !== "DRAFT" : true,
  ),
);

const calendarDays = computed(() => {
  const startOfMonth = getMonthStart(monthCursor.value);
  const startOffset = (startOfMonth.getDay() + 6) % 7;
  const gridStart = addDays(startOfMonth, -startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    const key = toDateKey(date);
    const dayArticles = visibleCalendarArticles.value.filter((article) => {
      const articleDate = getArticleCalendarDate(article);

      return articleDate ? toDateKey(articleDate) === key : false;
    });

    return {
      date,
      key,
      isCurrentMonth: date.getMonth() === monthCursor.value.getMonth(),
      isToday: key === toDateKey(new Date()),
      articles: dayArticles,
    };
  });
});

const unscheduledArticles = computed(() =>
  visibleCalendarArticles.value.filter((article) =>
    isReviewPlanningMode.value
      ? !article.reviewDueAt && article.source !== "shopify"
      : !article.plannedFor && !article.publishedAt && article.source !== "shopify",
  ),
);

const selectedArticle = computed(() =>
  calendarArticles.value.find((article) => article.id === selectedArticleId.value) ??
  null,
);

const isSelectedArticleEditable = computed(
  () => selectedArticle.value?.source === "local" && Boolean(selectedArticle.value.localArticleId),
);

const showShopifyArticlesWarning = computed(
  () => shopifyArticlesError.value && !isShopifyUnavailableError(shopifyArticlesError.value),
);

const reviewAssigneeCandidates = computed(() => projectMembers.value ?? []);

watch(
  [selectedArticle, isReviewPlanningMode],
  ([article]) => {
    if (article?.source === "local") {
      scheduledDateInput.value = isReviewPlanningMode.value
        ? toInputDate(article.reviewDueAt)
        : toInputDate(article.plannedFor);
      return;
    }

    scheduledDateInput.value = "";
  },
  { immediate: true },
);

watch(
  visibleCalendarArticles,
  (value) => {
    if (!selectedArticleId.value) {
      return;
    }

    if (!(value ?? []).some((article) => article.id === selectedArticleId.value)) {
      selectedArticleId.value = null;
    }
  },
  { deep: true },
);

function getMonthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1, 12, 0, 0, 0);
}

function addDays(value: Date, days: number) {
  const nextDate = new Date(value);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function toDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toInputDate(value?: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function toDateTimeLocalInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getSuggestedTodayPublicationDate() {
  const nextDate = new Date();
  nextDate.setHours(nextDate.getHours() + 1, nextDate.getMinutes(), 0, 0);

  return nextDate;
}

function getSuggestedTodayPublicationTime() {
  return toDateTimeLocalInput(getSuggestedTodayPublicationDate()).slice(11, 16);
}

function isTodayDayKey(dayKey: string) {
  return dayKey === toDateKey(new Date());
}

function buildTodayScheduledDateTime(dayKey: string, timeValue: string) {
  const normalizedTime = timeValue.trim();

  if (!normalizedTime) {
    return "";
  }

  return `${dayKey}T${normalizedTime}`;
}

function openTodaySchedulingModal(article: CalendarArticle, dayKey: string) {
  pendingTodayDropArticle.value = article;
  pendingTodayDropDayKey.value = dayKey;
  todayScheduleTimeInput.value = getSuggestedTodayPublicationTime();
  isTodaySchedulingModalOpen.value = true;
}

function closeTodaySchedulingModal() {
  isTodaySchedulingModalOpen.value = false;
  pendingTodayDropArticle.value = null;
  pendingTodayDropDayKey.value = "";
  todayScheduleTimeInput.value = "";
}

function openReviewAssigneeModal(article: CalendarArticle, dayKey: string) {
  pendingReviewDropArticle.value = article;
  pendingReviewDropDayKey.value = dayKey;
  selectedReviewAssigneeId.value = article.reviewSupabaseUserId?.trim() ?? "";
  isReviewAssigneeModalOpen.value = true;
}

function closeReviewAssigneeModal() {
  isReviewAssigneeModalOpen.value = false;
  pendingReviewDropArticle.value = null;
  pendingReviewDropDayKey.value = "";
  selectedReviewAssigneeId.value = "";
}

function getProjectMemberLabel(member: {
  id: string;
  displayName?: string | null;
  email?: string | null;
}) {
  return member.displayName?.trim() || member.email?.trim() || member.id;
}

function getProjectMemberInitials(member: {
  id: string;
  displayName?: string | null;
  email?: string | null;
}) {
  const label = getProjectMemberLabel(member);
  const source = label.includes("@") ? label.split("@")[0] || label : label;
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");

  return initials.join("") || "?";
}

function getBlogArticleAuthorName(article: BlogArticle) {
  const displayName = article.author?.displayName?.trim();

  if (displayName) {
    return displayName;
  }

  const joinedName = [article.author?.firstName, article.author?.lastName]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .trim();

  if (joinedName) {
    return joinedName;
  }

  return article.author?.name?.trim() || null;
}

function mapLocalArticleToCalendarArticle(article: BlogArticle): CalendarArticle {
  return {
    id: `local:${article.id}`,
    title: article.title,
    status: article.status ?? "DRAFT",
    plannedFor: article.plannedFor,
    reviewDueAt: article.reviewDueAt,
    reviewCompletedAt: article.reviewCompletedAt,
    reviewOutcome: article.reviewOutcome ?? null,
    publishedAt: article.publishedAt,
    url: article.url ?? null,
    authorName: getBlogArticleAuthorName(article),
    authorAvatarUrl: article.author?.avatarUrl ?? null,
    reviewSupabaseUserId: article.reviewSupabaseUserId ?? null,
    reviewSupabaseUserEmail: article.reviewSupabaseUserEmail ?? null,
    reviewSupabaseUserName: article.reviewSupabaseUserName ?? null,
    source: "local",
    localArticleId: article.id,
    shopifyArticleId: article.shopifyArticleId ?? null,
  };
}

function mapShopifyArticleToCalendarArticle(
  article: ShopifyBlogArticleListItem,
): CalendarArticle {
  return {
    id: `shopify:${article.id}`,
    title: article.title,
    status: "PUBLISHED",
    publishedAt: article.publishedAt,
    reviewDueAt: null,
    reviewCompletedAt: null,
    reviewOutcome: null,
    url: article.url ?? null,
    authorName: null,
    authorAvatarUrl: null,
    reviewSupabaseUserId: null,
    reviewSupabaseUserEmail: null,
    reviewSupabaseUserName: null,
    source: "shopify",
    shopifyArticleId: article.id,
  };
}

function applyUpdatedLocalArticle(updatedArticle: BlogArticle) {
  const currentArticles = articles.value ?? [];
  const articleIndex = currentArticles.findIndex(
    (article) => article.id === updatedArticle.id,
  );

  if (articleIndex === -1) {
    articles.value = [...currentArticles, updatedArticle];
    return;
  }

  articles.value = currentArticles.map((article, index) =>
    index === articleIndex ? updatedArticle : article,
  );
}

function getAuthorInitials(article: CalendarArticle) {
  const name = article.authorName?.trim();

  if (!name) {
    return "?";
  }

  const parts = name.split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");

  return initials.join("") || "?";
}

function getReviewerDisplayName(article: CalendarArticle) {
  return (
    article.reviewSupabaseUserName?.trim() ||
    article.reviewSupabaseUserEmail?.trim() ||
    article.reviewSupabaseUserId?.trim() ||
    null
  );
}

function getReviewerInitials(article: CalendarArticle) {
  const name = getReviewerDisplayName(article);

  if (!name) {
    return "?";
  }

  const normalizedName = name.includes("@") ? name.split("@")[0] || name : name;
  const parts = normalizedName.split(/[\s._-]+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");

  return initials.join("") || "?";
}

function getCardAvatarTitle(article: CalendarArticle) {
  if (isReviewPlanningMode.value) {
    const reviewerName = getReviewerDisplayName(article);

    return reviewerName ? `Reviewer: ${reviewerName}` : null;
  }

  return article.authorName?.trim() || "Auteur";
}

function shouldShowCardAvatar(article: CalendarArticle) {
  if (isReviewPlanningMode.value) {
    return Boolean(getReviewerDisplayName(article));
  }

  return Boolean(article.authorName || article.authorAvatarUrl);
}

function getArticleCalendarDate(article: CalendarArticle) {
  const rawValue = isReviewPlanningMode.value
    ? article.reviewDueAt
    : article.plannedFor || article.publishedAt;

  if (!rawValue) {
    return null;
  }

  const parsedDate = new Date(rawValue);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function getArticleCalendarLabel(article: CalendarArticle) {
  if (isReviewPlanningMode.value) {
    return article.reviewDueAt ? "Review prévue" : "Sans date";
  }

  if (article.plannedFor) {
    return "Planifié";
  }

  if (article.publishedAt) {
    return "Publié";
  }

  return "Sans date";
}

function getArticleStatusLabel(article: CalendarArticle) {
  if (article.source === "shopify" && !article.localArticleId) {
    return "Publié sur Shopify";
  }

  return blogArticleStatusLabels[article.status ?? "DRAFT"];
}

function getCardToneClasses(article: CalendarArticle) {
  if (!article.reviewCompletedAt) {
    return "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white";
  }

  if (article.reviewOutcome === "APPROVED") {
    return "border-emerald-300 bg-emerald-50/80 hover:border-emerald-400 hover:bg-emerald-50";
  }

  if (article.reviewOutcome === "REJECTED") {
    return "border-rose-300 bg-rose-50/80 hover:border-rose-400 hover:bg-rose-50";
  }

  return "border-amber-300 bg-amber-50/80 hover:border-amber-400 hover:bg-amber-50";
}

function getSelectedArticleLink(article: CalendarArticle) {
  if (article.source === "local" && article.localArticleId) {
    return `/articles/${article.localArticleId}`;
  }

  if (article.shopifyArticleId) {
    return `/shopify/articles/${encodeURIComponent(article.shopifyArticleId)}`;
  }

  return "/articles";
}

function getSelectedArticleLinkLabel(article: CalendarArticle) {
  return article.source === "local" ? "Ouvrir l’article" : "Voir sur Shopify";
}

function selectArticle(article: CalendarArticle) {
  selectedArticleId.value = article.id;
}

function clearSelectedArticle() {
  selectedArticleId.value = null;
}

function isArticleDraggable(article: CalendarArticle) {
  return article.source === "local" && Boolean(article.localArticleId);
}

function handleArticleDragStart(article: CalendarArticle, event: DragEvent) {
  if (!isArticleDraggable(article)) {
    return;
  }

  draggedArticleId.value = article.id;

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.dropEffect = "move";
    event.dataTransfer.setData("text/plain", article.id);
  }
}

function handleArticleDragEnd() {
  draggedArticleId.value = null;
  dragOverDayKey.value = null;
  isDragOverUnscheduled.value = false;
}

function handleDayDragOver(dayKey: string, event: DragEvent) {
  if (!draggedArticleId.value) {
    return;
  }

  event.preventDefault();
  dragOverDayKey.value = dayKey;
}

function handleDayDragLeave(dayKey: string, event: DragEvent) {
  const nextTarget = event.relatedTarget;

  if (
    nextTarget instanceof Node &&
    event.currentTarget instanceof Node &&
    event.currentTarget.contains(nextTarget)
  ) {
    return;
  }

  if (dragOverDayKey.value === dayKey) {
    dragOverDayKey.value = null;
  }
}

function handleDayClick(event: MouseEvent) {
  const target = event.target;

  if (target instanceof Element && target.closest("button")) {
    return;
  }

  clearSelectedArticle();
}

async function handleDayDrop(dayKey: string, event: DragEvent) {
  event.preventDefault();

  const articleId = draggedArticleId.value;

  draggedArticleId.value = null;
  dragOverDayKey.value = null;
  isDragOverUnscheduled.value = false;

  if (!articleId) {
    return;
  }

  const article = calendarArticles.value.find((entry) => entry.id === articleId);

  if (!article?.localArticleId) {
    return;
  }

  const currentDateValue = isReviewPlanningMode.value
    ? article.reviewDueAt
    : article.plannedFor;

  const hasReviewer = Boolean(article.reviewSupabaseUserId?.trim());

  if (
    toInputDate(currentDateValue) === dayKey &&
    (!isReviewPlanningMode.value || hasReviewer)
  ) {
    return;
  }

  if (isReviewPlanningMode.value) {
    if (!hasReviewer) {
      openReviewAssigneeModal(article, dayKey);
      return;
    }

    try {
      isSavingDate.value = true;
      const updatedArticle = await assignBlogArticleReview(article.localArticleId, {
        reviewDueAt: dayKey,
      });

      applyUpdatedLocalArticle(updatedArticle);
      selectedArticleId.value = `local:${updatedArticle.id}`;
      scheduledDateInput.value = dayKey;
      showSuccessToast(
        "Review planifiée",
        "La date de review a bien été enregistrée.",
      );
    } catch (saveError) {
      showErrorToast(
        "Impossible de planifier la review",
        saveError instanceof Error
          ? saveError.message
          : "Une erreur inattendue est survenue.",
      );
    } finally {
      isSavingDate.value = false;
    }

    return;
  }

  if (isTodayDayKey(dayKey)) {
    openTodaySchedulingModal(article, dayKey);
    return;
  }

  try {
    isSavingDate.value = true;
    const updatedArticle = await updateBlogArticle(article.localArticleId, {
      plannedFor: dayKey,
    });

    applyUpdatedLocalArticle(updatedArticle);
    selectedArticleId.value = `local:${updatedArticle.id}`;
    scheduledDateInput.value = dayKey;
    showSuccessToast(
      "Date planifiée",
      "L’article a bien été déplacé dans le calendrier.",
    );
  } catch (saveError) {
    showErrorToast(
      "Impossible de planifier l’article",
      saveError instanceof Error
        ? saveError.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    isSavingDate.value = false;
  }
}

async function publishDroppedArticleNow() {
  const article = pendingTodayDropArticle.value;

  if (!article?.localArticleId) {
    return;
  }

  try {
    isSavingDate.value = true;
    const updatedArticle = await updateBlogArticle(article.localArticleId, {
      status: "PUBLISHED",
      plannedFor: null,
    });

    applyUpdatedLocalArticle(updatedArticle);
    selectedArticleId.value = `local:${updatedArticle.id}`;
    scheduledDateInput.value = "";
    closeTodaySchedulingModal();
    showSuccessToast(
      "Article publié",
      "L’article a bien été publié immédiatement sur Shopify.",
    );
  } catch (saveError) {
    showErrorToast(
      "Impossible de publier l’article",
      saveError instanceof Error
        ? saveError.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    isSavingDate.value = false;
  }
}

async function scheduleDroppedArticleForToday() {
  const article = pendingTodayDropArticle.value;
  const dayKey = pendingTodayDropDayKey.value;
  const plannedFor = buildTodayScheduledDateTime(dayKey, todayScheduleTimeInput.value);

  if (!article?.localArticleId || !plannedFor) {
    return;
  }

  try {
    isSavingDate.value = true;
    const updatedArticle = await updateBlogArticle(article.localArticleId, {
      status: "PLANNED",
      plannedFor,
    });

    applyUpdatedLocalArticle(updatedArticle);
    selectedArticleId.value = `local:${updatedArticle.id}`;
    scheduledDateInput.value = dayKey;
    closeTodaySchedulingModal();
    showSuccessToast(
      "Publication planifiée",
      "L’article sera publié plus tard aujourd’hui sur Shopify.",
    );
  } catch (saveError) {
    showErrorToast(
      "Impossible de planifier l’article",
      saveError instanceof Error
        ? saveError.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    isSavingDate.value = false;
  }
}

function handleUnscheduledDragOver(event: DragEvent) {
  if (!draggedArticleId.value) {
    return;
  }

  event.preventDefault();
  dragOverDayKey.value = null;
  isDragOverUnscheduled.value = true;
}

function handleUnscheduledDragLeave(event: DragEvent) {
  const nextTarget = event.relatedTarget;

  if (
    nextTarget instanceof Node &&
    event.currentTarget instanceof Node &&
    event.currentTarget.contains(nextTarget)
  ) {
    return;
  }

  isDragOverUnscheduled.value = false;
}

async function handleUnscheduledDrop(event: DragEvent) {
  event.preventDefault();

  const articleId = draggedArticleId.value;

  draggedArticleId.value = null;
  dragOverDayKey.value = null;
  isDragOverUnscheduled.value = false;

  if (!articleId) {
    return;
  }

  const article = calendarArticles.value.find((entry) => entry.id === articleId);

  if (!article?.localArticleId) {
    return;
  }

  const currentDateValue = isReviewPlanningMode.value
    ? article.reviewDueAt
    : article.plannedFor;

  if (!currentDateValue) {
    return;
  }

  try {
    isSavingDate.value = true;
    const updatedArticle = await updateBlogArticle(
      article.localArticleId,
      isReviewPlanningMode.value
        ? { reviewDueAt: null }
        : { plannedFor: null },
    );

    applyUpdatedLocalArticle(updatedArticle);
    selectedArticleId.value = `local:${updatedArticle.id}`;
    scheduledDateInput.value = "";
    showSuccessToast(
      isReviewPlanningMode.value ? "Review retirée" : "Date retirée",
      isReviewPlanningMode.value
        ? "La date de review a bien été retirée."
        : "L’article a bien été déplacé dans les articles sans date.",
    );
  } catch (saveError) {
    showErrorToast(
      isReviewPlanningMode.value
        ? "Impossible de retirer la review"
        : "Impossible de retirer la date",
      saveError instanceof Error
        ? saveError.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    isSavingDate.value = false;
  }
}

function goToPreviousMonth() {
  monthCursor.value = new Date(
    monthCursor.value.getFullYear(),
    monthCursor.value.getMonth() - 1,
    1,
    12,
    0,
    0,
    0,
  );
}

function goToNextMonth() {
  monthCursor.value = new Date(
    monthCursor.value.getFullYear(),
    monthCursor.value.getMonth() + 1,
    1,
    12,
    0,
    0,
    0,
  );
}

function goToCurrentMonth() {
  monthCursor.value = getMonthStart(new Date());
}

async function saveSelectedDate() {
  if (!selectedArticle.value || !selectedArticle.value.localArticleId) {
    return;
  }

  try {
    isSavingDate.value = true;
    const updatedArticle = await updateBlogArticle(
      selectedArticle.value.localArticleId,
      isReviewPlanningMode.value
        ? { reviewDueAt: scheduledDateInput.value || null }
        : { plannedFor: scheduledDateInput.value || null },
    );

    applyUpdatedLocalArticle(updatedArticle);
    selectedArticleId.value = `local:${updatedArticle.id}`;
    showSuccessToast(
      calendarSuccessLabel.value,
      scheduledDateInput.value
        ? calendarSuccessDescription.value
        : calendarClearedSuccessDescription.value,
    );
  } catch (saveError) {
    showErrorToast(
      isReviewPlanningMode.value
        ? "Impossible d’enregistrer la review"
        : "Impossible d’enregistrer la date",
      saveError instanceof Error
        ? saveError.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    isSavingDate.value = false;
  }
}

async function refreshCalendar() {
  try {
    isRefreshingCalendar.value = true;
    if (projectId.value) {
      await syncBlogArticleStatusesFromShopify(projectId.value);
    }
    await Promise.allSettled([refresh(), refreshShopifyArticles()]);
  } finally {
    isRefreshingCalendar.value = false;
  }
}

async function confirmReviewAssigneeSelection() {
  const article = pendingReviewDropArticle.value;
  const dayKey = pendingReviewDropDayKey.value;
  const reviewerId = selectedReviewAssigneeId.value.trim();

  if (!article?.localArticleId || !dayKey) {
    return;
  }

  if (!reviewerId) {
    showErrorToast("Choisis un reviewer pour cette review.");
    return;
  }

  const reviewer = reviewAssigneeCandidates.value.find(
    (member) => member.id === reviewerId,
  );

  if (!reviewer) {
    showErrorToast("Le reviewer sélectionné n’est pas disponible sur ce projet.");
    return;
  }

  try {
    isSavingDate.value = true;
    const updatedArticle = await assignBlogArticleReview(article.localArticleId, {
      supabaseUserId: reviewer.id,
      supabaseUserEmail: reviewer.email ?? null,
      supabaseUserName: reviewer.displayName ?? null,
      reviewDueAt: dayKey,
    });

    applyUpdatedLocalArticle(updatedArticle);
    selectedArticleId.value = `local:${updatedArticle.id}`;
    scheduledDateInput.value = dayKey;
    closeReviewAssigneeModal();
    showSuccessToast(
      "Review planifiée",
      "Le reviewer a bien été assigné et la date de review enregistrée.",
    );
  } catch (saveError) {
    showErrorToast(
      "Impossible de planifier la review",
      saveError instanceof Error
        ? saveError.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    isSavingDate.value = false;
  }
}
</script>

<template>
  <section class="space-y-6">
    <UBreadcrumb :items="breadcrumbItems" class="text-slate-500" />

    <header
      class="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between"
    >
      <div class="space-y-1">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Rédaction
        </p>
        <h1 class="text-2xl font-semibold text-slate-900">
          Calendrier éditorial des articles
        </h1>
        <p class="text-sm text-slate-500">
          Planifie et ajuste les dates de parution des articles du projet courant.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div
          class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
        >
          <span class="text-sm font-medium text-slate-700">
            Publication
          </span>
          <USwitch v-model="isReviewPlanningMode" />
          <span class="text-sm font-medium text-slate-700">
            Reviews
          </span>
        </div>

        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-refresh-cw"
          :loading="isRefreshingCalendar"
          @click="refreshCalendar"
        >
          <!-- Rafraîchir -->
        </UButton>

        <div
          class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
        >
          <USwitch v-model="hideDraftArticles" />
          <span class="text-sm font-medium text-slate-700">
            Cacher les brouillons
          </span>
        </div>

        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-chevron-left"
          @click="goToPreviousMonth"
        >
          Mois précédent
        </UButton>

        <div class="min-w-44 text-center text-sm font-semibold text-slate-900">
          {{ monthLabel }}
        </div>

        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-calendar"
          @click="goToCurrentMonth"
        >
          Mois actuel
        </UButton>

        <UButton
          color="neutral"
          variant="soft"
          trailing-icon="i-lucide-chevron-right"
          @click="goToNextMonth"
        >
          Mois suivant
        </UButton>
      </div>
    </header>

    <UModal
      :open="isTodaySchedulingModalOpen"
      :ui="{ content: 'sm:max-w-lg' }"
      @update:open="
        $event
          ? (isTodaySchedulingModalOpen = true)
          : closeTodaySchedulingModal()
      "
    >
      <template #content>
        <div class="rounded-3xl bg-white p-6 shadow-xl">
          <div class="space-y-1">
            <h2 class="text-xl font-semibold text-slate-900">
              Publication aujourd’hui
            </h2>
            <p class="text-sm leading-6 text-slate-500">
              Pour
              <span class="font-medium text-slate-700">
                {{ pendingTodayDropArticle?.title }}
              </span>,
              choisis si tu veux publier maintenant ou définir une heure pour plus tard aujourd’hui.
            </p>
          </div>

          <div class="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label class="block space-y-2">
              <span class="text-sm font-medium text-slate-700">
                Heure proposée
              </span>
              <input
                v-model="todayScheduleTimeInput"
                type="time"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-400"
              >
            </label>
            <p class="mt-2 text-xs text-slate-500">
              L’heure proposée est automatiquement réglée à une heure après l’instant actuel.
            </p>
          </div>

          <div class="mt-6 flex flex-wrap justify-end gap-3">
            <UButton
              color="neutral"
              variant="soft"
              :disabled="isSavingDate"
              @click="closeTodaySchedulingModal"
            >
              Annuler
            </UButton>

            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-clock-3"
              :loading="isSavingDate"
              :disabled="!todayScheduleTimeInput"
              @click="scheduleDroppedArticleForToday"
            >
              Publier à cette heure
            </UButton>

            <UButton
              color="primary"
              icon="i-lucide-send"
              :loading="isSavingDate"
              @click="publishDroppedArticleNow"
            >
              Publier maintenant
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      :open="isReviewAssigneeModalOpen"
      :ui="{ content: 'sm:max-w-lg' }"
      @update:open="
        $event ? (isReviewAssigneeModalOpen = true) : closeReviewAssigneeModal()
      "
    >
      <template #content>
        <div class="rounded-3xl bg-white p-6 shadow-xl">
          <div class="space-y-1">
            <h2 class="text-xl font-semibold text-slate-900">
              Choisir un reviewer
            </h2>
            <p class="text-sm leading-6 text-slate-500">
              Pour
              <span class="font-medium text-slate-700">
                {{ pendingReviewDropArticle?.title }}
              </span>,
              sélectionne la personne qui doit recevoir cette review.
            </p>
          </div>

          <div class="mt-5 space-y-2">
            <button
              v-for="member in reviewAssigneeCandidates"
              :key="member.id"
              type="button"
              class="flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition"
              :class="
                selectedReviewAssigneeId === member.id
                  ? 'border-sky-300 bg-sky-50'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              "
              @click="selectedReviewAssigneeId = member.id"
            >
              <span
                class="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-xs font-semibold text-slate-700"
              >
                {{ getProjectMemberInitials(member) }}
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-slate-900">
                  {{ getProjectMemberLabel(member) }}
                </span>
                <span class="block truncate text-xs text-slate-500">
                  {{ member.role || "Membre du projet" }}
                </span>
              </span>
            </button>

            <p
              v-if="!reviewAssigneeCandidates.length"
              class="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-500"
            >
              Aucun membre du projet n’est disponible pour l’instant.
            </p>
          </div>

          <div class="mt-6 flex flex-wrap justify-end gap-3">
            <UButton
              color="neutral"
              variant="soft"
              :disabled="isSavingDate"
              @click="closeReviewAssigneeModal"
            >
              Annuler
            </UButton>

            <UButton
              color="primary"
              icon="i-lucide-user-check"
              :loading="isSavingDate"
              :disabled="!selectedReviewAssigneeId || !reviewAssigneeCandidates.length"
              @click="confirmReviewAssigneeSelection"
            >
              Assigner et planifier
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <p
      v-if="status === 'pending' || shopifyArticlesStatus === 'pending'"
      class="text-sm text-slate-500"
    >
      Chargement du calendrier...
    </p>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :details="error.toString()"
      title="Impossible de charger le calendrier"
      description="Les articles du projet courant n'ont pas pu être récupérés."
      action-label="Réessayer"
      @action="refreshCalendar"
    />

    <div v-else class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div>
        <FeedbackRichMessage
          v-if="showShopifyArticlesWarning"
          class="mb-6"
          tone="warning"
          :details="shopifyArticlesError?.toString()"
          title="Articles Shopify partiellement indisponibles"
          description="Le calendrier affiche les articles de la base, mais tous les articles publiés sur Shopify n'ont pas pu être récupérés."
          action-label="Réessayer"
          @action="refreshShopifyArticles"
        />

        <section class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div class="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            <div
              v-for="dayLabel in ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']"
              :key="dayLabel"
              class="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              {{ dayLabel }}
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-7">
            <div
              v-for="day in calendarDays"
              :key="day.key"
              class="min-h-40 border-b border-r border-slate-200 p-3 last:border-r-0 sm:[&:nth-child(7n)]:border-r-0"
              :class="
                [
                  day.isCurrentMonth
                    ? 'bg-white'
                    : 'bg-slate-50/70 text-slate-400',
                  dragOverDayKey === day.key
                    ? 'bg-sky-50 ring-2 ring-inset ring-sky-300'
                    : '',
                ]
              "
              @click="handleDayClick"
              @dragover="handleDayDragOver(day.key, $event)"
              @dragleave="handleDayDragLeave(day.key, $event)"
              @drop="handleDayDrop(day.key, $event)"
            >
              <div class="mb-3 flex items-center justify-between">
                <span
                  class="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
                  :class="
                    day.isToday
                      ? 'bg-sky-600 text-white'
                      : day.isCurrentMonth
                        ? 'text-slate-900'
                        : 'text-slate-400'
                  "
                >
                  {{ day.date.getDate() }}
                </span>

                <span
                  v-if="day.articles.length"
                  class="text-xs font-medium text-slate-400"
                >
                  {{ day.articles.length }}
                </span>
              </div>

              <div class="space-y-2">
                <button
                  v-for="article in day.articles"
                  :key="article.id"
                  type="button"
                  class="relative block w-full rounded-2xl border px-3 py-2 pr-12 text-left transition"
                  :class="
                    [
                      getCardToneClasses(article),
                      selectedArticleId === article.id
                        ? 'ring-2 ring-sky-300 ring-offset-1'
                        : '',
                      draggedArticleId === article.id
                        ? 'opacity-60 ring-2 ring-sky-200 transition-none'
                        : '',
                    ]
                  "
                  :draggable="isArticleDraggable(article)"
                  @click="selectArticle(article)"
                  @dragstart="handleArticleDragStart(article, $event)"
                  @dragend="handleArticleDragEnd"
                >
                  <span class="line-clamp-2 block text-sm font-medium text-slate-900">
                    {{ article.title }}
                  </span>
                  <span class="mt-1 block text-xs text-slate-500">
                    {{ getArticleStatusLabel(article) }}
                  </span>

                  <span
                    v-if="shouldShowCardAvatar(article)"
                    class="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white bg-slate-200 text-[10px] font-semibold text-slate-700 shadow-sm"
                    :title="getCardAvatarTitle(article) || undefined"
                  >
                    <img
                      v-if="!isReviewPlanningMode && article.authorAvatarUrl"
                      :src="article.authorAvatarUrl"
                      :alt="article.authorName || 'Auteur'"
                      class="h-full w-full object-cover"
                    >
                    <span v-else-if="isReviewPlanningMode">{{
                      getReviewerInitials(article)
                    }}</span>
                    <span v-else>{{ getAuthorInitials(article) }}</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside class="space-y-4">
        <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div v-if="selectedArticle" class="space-y-5">
            <div class="space-y-1">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Article sélectionné
              </p>
              <h2 class="text-lg font-semibold text-slate-900">
                {{ selectedArticle.title }}
              </h2>
              <p class="text-sm text-slate-500">
                {{ getArticleCalendarLabel(selectedArticle) }}
              </p>
            </div>

            <dl class="space-y-3 text-sm">
              <div class="space-y-1">
                <dt class="font-medium text-slate-700">Statut</dt>
                <dd class="text-slate-600">
                  {{ getArticleStatusLabel(selectedArticle) }}
                </dd>
              </div>

              <div class="space-y-1">
                <dt class="font-medium text-slate-700">
                  {{ selectedDateDetailLabel }}
                </dt>
                <dd class="text-slate-600">
                  {{
                    isReviewPlanningMode
                      ? selectedArticle.reviewDueAt
                        ? toInputDate(selectedArticle.reviewDueAt)
                        : "-"
                      : selectedArticle.publishedAt
                        ? toInputDate(selectedArticle.publishedAt)
                        : "-"
                  }}
                </dd>
              </div>
            </dl>

            <label v-if="isSelectedArticleEditable" class="block space-y-2">
              <span class="text-sm font-medium text-slate-700">
                {{ calendarDateFieldLabel }}
              </span>
              <input
                v-model="scheduledDateInput"
                type="date"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-400"
              >
            </label>

            <p
              v-else
              class="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-500"
            >
              {{
                isReviewPlanningMode
                  ? "La planification des reviews n’est modifiable que pour les articles enregistrés dans la base."
                  : "Cet article vient uniquement de Shopify. Il est visible dans le calendrier, mais la planification n’est modifiable que pour les articles enregistrés dans la base."
              }}
            </p>

            <div class="flex flex-wrap gap-3">
              <UButton
                v-if="isSelectedArticleEditable"
                color="primary"
                variant="solid"
                icon="i-lucide-save"
                :loading="isSavingDate"
                @click="saveSelectedDate"
              >
                {{ isReviewPlanningMode ? "Enregistrer la review" : "Enregistrer la date" }}
              </UButton>

              <UButton
                v-if="isSelectedArticleEditable"
                color="neutral"
                variant="soft"
                icon="i-lucide-eraser"
                :disabled="!scheduledDateInput"
                @click="scheduledDateInput = ''"
              >
                Effacer
              </UButton>

              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-arrow-right"
                :to="getSelectedArticleLink(selectedArticle)"
              >
                {{ getSelectedArticleLinkLabel(selectedArticle) }}
              </UButton>
            </div>
          </div>

          <div v-else class="space-y-2">
            <h2 class="text-lg font-semibold text-slate-900">
              {{ selectedDatePanelTitle }}
            </h2>
            <p class="text-sm leading-6 text-slate-500">
              {{ selectedDatePanelDescription }}
            </p>
          </div>
        </section>

        <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="mb-4 space-y-1">
            <h2 class="text-lg font-semibold text-slate-900">
              {{ unscheduledSectionTitle }}
            </h2>
            <p class="text-sm text-slate-500">
              {{ unscheduledSectionDescription }}
            </p>
          </div>

          <div
            class="rounded-2xl border border-dashed p-2 transition"
            :class="
              isDragOverUnscheduled
                ? 'border-sky-300 bg-sky-50'
                : 'border-transparent bg-transparent'
            "
            @dragover="handleUnscheduledDragOver"
            @dragleave="handleUnscheduledDragLeave($event)"
            @drop="handleUnscheduledDrop"
          >
            <div
              v-if="unscheduledArticles.length"
              class="max-h-96 space-y-3 overflow-y-auto pr-1 overscroll-contain"
            >
              <div
                v-for="article in unscheduledArticles"
                :key="article.id"
                role="button"
                tabindex="0"
                class="group w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-left transition select-none"
                :class="
                  [
                    isArticleDraggable(article)
                      ? 'cursor-grab hover:border-slate-400 hover:bg-white active:cursor-grabbing'
                      : 'cursor-default opacity-90',
                    draggedArticleId === article.id
                      ? 'opacity-60 ring-2 ring-sky-200 transition-none'
                      : '',
                  ]
                "
                :draggable="isArticleDraggable(article)"
                @click="selectArticle(article)"
                @dragstart="handleArticleDragStart(article, $event)"
                @dragend="handleArticleDragEnd"
                @keydown.enter.prevent="selectArticle(article)"
                @keydown.space.prevent="selectArticle(article)"
              >
                <span class="flex items-start gap-3">
                  <UIcon
                    v-if="isArticleDraggable(article)"
                    name="i-lucide-grip-vertical"
                    class="mt-0.5 h-4 w-4 shrink-0 text-slate-400 opacity-70 transition group-hover:opacity-100"
                    aria-hidden="true"
                  />
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-medium text-slate-900">
                      {{ article.title }}
                    </span>
                    <span class="mt-1 block text-xs text-slate-500">
                      {{ getArticleStatusLabel(article) }}
                    </span>
                  </span>
                </span>
              </div>
            </div>

            <p v-else class="text-sm text-slate-500">
              Tous les articles ont déjà une date planifiée ou publiée.
            </p>
          </div>
        </section>
      </aside>
    </div>
  </section>
</template>
