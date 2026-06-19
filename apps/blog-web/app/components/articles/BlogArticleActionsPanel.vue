<script setup lang="ts">
import type { Author, BlogArticleStatus } from "~/types/domain";
import type { ShopifyBlogListItem } from "~/types/shopify";

const props = defineProps<{
  selectedAuthorId: string;
  selectedReviewAssigneeId: string;
  selectedShopifyBlogId: string;
  selectedStatus: BlogArticleStatus;
  shopifyArticleId: string;
  scheduledFor?: string | null;
  activeShopifyAction?: "publish" | "publish-now" | "unpublish" | "schedule" | "unschedule" | null;
  authors: Author[];
  reviewAssignees: Array<{
    id: string;
    label: string;
  }>;
  blogs: ShopifyBlogListItem[];
  isUpdatingAuthor: boolean;
  isUpdatingReviewAssignment: boolean;
  isUpdatingBlog: boolean;
  isUpdatingStatus: boolean;
  isDeletingArticle: boolean;
  isPushingToShopify: boolean;
  isTogglingShopifyVisibility: boolean;
}>();

const emit = defineEmits<{
  "update:selectedAuthorId": [value: string];
  "update:selectedReviewAssigneeId": [value: string];
  "update:selectedShopifyBlogId": [value: string];
  pushToShopify: [];
  assignReview: [];
  publish: [];
  publishNow: [];
  unpublish: [];
  schedule: [value: string];
  unschedule: [];
  delete: [];
}>();

const authorModel = computed({
  get: () => props.selectedAuthorId,
  set: (value: string) => emit("update:selectedAuthorId", value),
});

const reviewAssigneeModel = computed({
  get: () => props.selectedReviewAssigneeId,
  set: (value: string) => emit("update:selectedReviewAssigneeId", value),
});

const shopifyBlogModel = computed({
  get: () => props.selectedShopifyBlogId,
  set: (value: string) => emit("update:selectedShopifyBlogId", value),
});

const hasShopifyArticle = computed(() => !!props.shopifyArticleId.trim());
const scheduleDate = ref("");

const pushButtonLabel = computed(() =>
  hasShopifyArticle.value ? "Mettre à jour Shopify" : "Envoyer vers Shopify",
);

function getDaysUntil(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const targetDate = new Date(parsedDate);
  targetDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffInMs = targetDate.getTime() - today.getTime();

  if (diffInMs < 0) {
    return null;
  }

  return Math.round(diffInMs / 86_400_000);
}

const plannedPublicationDelayLabel = computed(() => {
  const daysUntil = getDaysUntil(props.scheduledFor);

  if (daysUntil === null) {
    return "";
  }

  if (daysUntil === 0) {
    return " Publication aujourd'hui.";
  }

  if (daysUntil === 1) {
    return " Publication dans 1 jour.";
  }

  return ` Publication dans ${daysUntil} jours.`;
});

function toInputDate(value?: string | null) {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().slice(0, 10);
}

watch(
  () => props.scheduledFor,
  (value) => {
    scheduleDate.value = toInputDate(value);
  },
  { immediate: true },
);

const isShopifyActionDisabled = computed(
  () =>
    props.isDeletingArticle ||
    props.isUpdatingBlog ||
    props.isUpdatingAuthor ||
    props.isUpdatingReviewAssignment ||
    props.isUpdatingStatus ||
    props.isPushingToShopify ||
    props.isTogglingShopifyVisibility,
);

const canAssignReview = computed(
  () =>
    reviewAssigneeModel.value.trim().length > 0 &&
    !props.isDeletingArticle &&
    !props.isUpdatingReviewAssignment,
);

const canSchedule = computed(
  () =>
    hasShopifyArticle.value &&
    !isShopifyActionDisabled.value &&
    scheduleDate.value.trim().length > 0,
);
</script>

<template>
  <aside class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="h-full flex flex-col space-y-5">
      <div class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <p class="text-sm font-medium text-slate-700">Shopify</p>

        <label class="block space-y-2">
          <span class="text-sm font-medium text-slate-700">Blog Shopify</span>
          <select
            v-model="shopifyBlogModel"
            :disabled="isDeletingArticle || isUpdatingAuthor || isUpdatingStatus || isPushingToShopify || isTogglingShopifyVisibility"
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            <option value="">Blog par défaut</option>
            <option v-for="blog in blogs" :key="blog.id" :value="blog.id">
              {{ blog.title || blog.name || blog.baseUrl }}
            </option>
          </select>
        </label>

        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-upload"
          class="w-full justify-center"
          :loading="isPushingToShopify"
          :disabled="isDeletingArticle || isUpdatingBlog || isUpdatingAuthor || isUpdatingStatus || isPushingToShopify || isTogglingShopifyVisibility"
          @click="emit('pushToShopify')"
        >
          {{ isPushingToShopify ? `${pushButtonLabel}...` : pushButtonLabel }}
        </UButton>

        <div v-if="selectedStatus === 'PUBLISHED'" class="space-y-2">
          <UButton
            color="primary"
            variant="soft"
            icon="i-lucide-eye-off"
            class="w-full justify-center"
            :loading="activeShopifyAction === 'unpublish' && isTogglingShopifyVisibility"
            :disabled="isShopifyActionDisabled"
            @click="emit('unpublish')"
          >
            Dépublier
          </UButton>
        </div>

        <div v-else-if="selectedStatus === 'PLANNED'" class="space-y-2">
          <UButton
            color="primary"
            variant="soft"
            icon="i-lucide-rocket"
            class="w-full justify-center"
            :loading="activeShopifyAction === 'publish-now' && isTogglingShopifyVisibility"
            :disabled="isShopifyActionDisabled"
            @click="emit('publishNow')"
          >
            Publier maintenant
          </UButton>

          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-calendar-x-2"
            class="w-full justify-center"
            :loading="activeShopifyAction === 'unschedule' && isTogglingShopifyVisibility"
            :disabled="isShopifyActionDisabled"
            @click="emit('unschedule')"
          >
            Déplanifier
          </UButton>
        </div>

        <div v-else class="space-y-3">
          <UButton
            color="primary"
            variant="soft"
            icon="i-lucide-eye"
            class="w-full justify-center"
            :loading="activeShopifyAction === 'publish' && isTogglingShopifyVisibility"
            :disabled="!hasShopifyArticle || isShopifyActionDisabled"
            @click="emit('publish')"
          >
            Publier
          </UButton>

          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700">
              Date de planification
            </span>
            <input
              v-model="scheduleDate"
              type="date"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              :disabled="!hasShopifyArticle || isShopifyActionDisabled"
            />
          </label>

          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-calendar-plus-2"
            class="w-full justify-center"
            :loading="activeShopifyAction === 'schedule' && isTogglingShopifyVisibility"
            :disabled="!canSchedule"
            @click="emit('schedule', scheduleDate)"
          >
            Planifier
          </UButton>
        </div>

        <p class="text-xs leading-5 text-slate-500">
          <template v-if="hasShopifyArticle">
            {{
              selectedStatus === "PUBLISHED"
                ? "Visible sur Shopify."
                : selectedStatus === "PLANNED"
                  ? `Planifié sur Shopify.${plannedPublicationDelayLabel}`
                  : "Présent sur Shopify mais masqué."
            }}
          </template>
          <template v-else>
            L’article doit d’abord être pushé avant de pouvoir être publié.
          </template>
        </p>
      </div>

      <!-- <label class="block space-y-2">
        <span class="text-sm font-medium text-slate-700">Statut</span>
        <select
          v-model="statusModel"
          :disabled="isUpdatingStatus || isDeletingArticle"
          class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          <option
            v-for="option in blogArticleStatusOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label> -->

      <label class="block space-y-2">
        <span class="text-sm font-medium text-slate-700">Publié sous</span>
        <select
          v-model="authorModel"
          :disabled="isUpdatingAuthor || isUpdatingBlog || isDeletingArticle"
          class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          <option value="">Aucun auteur</option>
          <option v-for="author in authors" :key="author.id" :value="author.id">
            {{ author.displayName || author.name }}
          </option>
        </select>
      </label>

      <div class="space-y-2">
        <label class="block space-y-2">
          <span class="text-sm font-medium text-slate-700">En review</span>
          <select
            v-model="reviewAssigneeModel"
            :disabled="isDeletingArticle || isUpdatingReviewAssignment"
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            <option value="">Aucune personne</option>
            <option v-for="member in reviewAssignees" :key="member.id" :value="member.id">
              {{ member.label }}
            </option>
          </select>
        </label>

        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-user-check"
          class="w-full justify-center"
          :loading="isUpdatingReviewAssignment"
          :disabled="!canAssignReview"
          @click="emit('assignReview')"
        >
          Assigner en review
        </UButton>
      </div>

      <div class="mt-auto border-t border-slate-200 pt-5">
        <UButton
          color="error"
          variant="soft"
          icon="i-lucide-trash-2"
          class="w-full justify-center"
          :loading="isDeletingArticle"
          :disabled="
            isDeletingArticle ||
            isUpdatingAuthor ||
            isUpdatingReviewAssignment ||
            isUpdatingStatus
          "
          @click="emit('delete')"
        >
          Supprimer l'article
        </UButton>
      </div>
    </div>
  </aside>
</template>
