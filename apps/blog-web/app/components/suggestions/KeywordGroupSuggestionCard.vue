<script setup lang="ts">
import { pageTypeLabels } from "~/constants/pages";
import { useAppToast } from "~/composables/useAppToast";
import { useKeywords } from "~/composables/useKeywords";
import { usePages } from "~/composables/usePages";
import KeywordGroupSuggestionAssociatePageModal from "~/components/suggestions/KeywordGroupSuggestionAssociatePageModal.vue";
import type { KeywordGroupSuggestionRecord } from "~/types/keywords";
import {
  getKeywordDifficultyLabel,
  getKeywordDifficultyToneClass,
} from "~/utils/keyword-difficulty";
import { normalizeSearchText } from "~/utils/search-normalizer";

defineOptions({
  inheritAttrs: false,
});

const attrs = useAttrs();

const props = defineProps<{
  suggestion: KeywordGroupSuggestionRecord;
  sprintClusterId?: string | null;
  currentUserId?: string | null;
}>();

const emit = defineEmits<{
  assigned: [suggestion: KeywordGroupSuggestionRecord];
  associated: [payload: { suggestionId: string; pageId: string; pageTitle: string }];
}>();

const { assignKeywordGroupToCurrentUser, clearKeywordGroupAssignment } =
  useKeywords();
const { createBlankPageFromSuggestionGroup } = usePages();
const { showErrorToast, showSuccessToast } = useAppToast();
const isUpdatingAssignment = ref(false);
const isCreatingBlankPage = ref(false);
const isAssociateModalOpen = ref(false);

const templateTypes = computed(() =>
  [
    ...new Set(
      props.suggestion.keywords
        .map((keyword) => keyword.template)
        .filter(Boolean),
    ),
  ].filter((template): template is NonNullable<typeof template> =>
    Boolean(template),
  ),
);

const createPageHref = computed(() =>
  templateTypes.value.length
    ? `/pages/add?groupId=${encodeURIComponent(props.suggestion.id)}`
    : "",
);

const primaryKeywordRecord = computed(() => {
  const primaryKeyword = normalizeSearchText(props.suggestion.primaryKeyword);

  if (!primaryKeyword) {
    return null;
  }

  return (
    props.suggestion.keywords.find(
      (keyword) => normalizeSearchText(keyword.keyword) === primaryKeyword,
    ) ?? null
  );
});

const primaryKeywordDifficulty = computed(
  () => primaryKeywordRecord.value?.difficulty ?? null,
);

const isSprintCluster = computed(() => {
  const sprintClusterId = props.sprintClusterId?.trim();
  const suggestionClusterId = props.suggestion.seoClusterId?.trim();

  return Boolean(
    sprintClusterId &&
      suggestionClusterId &&
      sprintClusterId === suggestionClusterId,
  );
});

const isAssignedToCurrentUser = computed(() => {
  const currentUserId = props.currentUserId?.trim();
  const assigneeId = props.suggestion.assignedSupabaseUserId?.trim();

  return Boolean(
    currentUserId && assigneeId && currentUserId === assigneeId,
  );
});

const assignmentToneClass = computed(() => {
  if (isSprintCluster.value) {
    return "border-primary/50 ring-1 ring-primary/10";
  }

  if (isAssignedToCurrentUser.value) {
    return "border-emerald-300 ring-1 ring-emerald-100";
  }

  if (props.suggestion.assignedSupabaseUserId) {
    return "border-amber-300 ring-1 ring-amber-100";
  }

  return "border-slate-200";
});

const assignedBadgeLabel = computed(() => {
  if (!props.suggestion.assignedSupabaseUserId) {
    return null;
  }

  if (isAssignedToCurrentUser.value) {
    return "Assigné à vous";
  }

  return (
    props.suggestion.assignedSupabaseUserName ||
    props.suggestion.assignedSupabaseUserEmail ||
    "Assigné"
  );
});

const assignmentActionLabel = computed(() => {
  if (isAssignedToCurrentUser.value) {
    return "Me retirer";
  }

  return props.suggestion.assignedSupabaseUserId
    ? "Me l'assigner"
    : "M'assigner";
});

const assignmentActionIcon = computed(() =>
  isAssignedToCurrentUser.value ? "i-lucide-user-x" : "i-lucide-user-plus",
);

function isPrimaryKeyword(keyword: string) {
  return (
    normalizeSearchText(props.suggestion.primaryKeyword) ===
    normalizeSearchText(keyword)
  );
}

async function handleAssignmentToggle() {
  if (isUpdatingAssignment.value) {
    return;
  }

  try {
    isUpdatingAssignment.value = true;

    const updatedGroup = isAssignedToCurrentUser.value
      ? await clearKeywordGroupAssignment(props.suggestion.id)
      : await assignKeywordGroupToCurrentUser(props.suggestion.id);

    emit("assigned", {
      ...props.suggestion,
      ...updatedGroup,
    });
  } catch (error) {
    console.error("[KeywordGroupSuggestionCard] assignment failed", error);
  } finally {
    isUpdatingAssignment.value = false;
  }
}

async function handleCreateBlankPage() {
  if (isCreatingBlankPage.value || !templateTypes.value.length) {
    return;
  }

  try {
    isCreatingBlankPage.value = true;
    const page = await createBlankPageFromSuggestionGroup(props.suggestion.id, {
      pageType: templateTypes.value[0] ?? null,
    });

    showSuccessToast(
      "Page vide créée",
      `${page.title} a été créée sans rédaction IA.`,
    );

    await navigateTo(`/pages/${page.id}`);
  } catch (error) {
    showErrorToast(
      "Impossible de créer la page vide",
      error instanceof Error
        ? error.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    isCreatingBlankPage.value = false;
  }
}

</script>

<template>
  <article
    class="flex rounded-2xl border bg-white p-5 shadow-sm transition"
    :class="assignmentToneClass"
    v-bind="attrs"
  >
    <div
      class="flex flex-col gap-3 xl:flex-row md:items-start md:justify-between"
    >
      <div class="space-y-1">
        <div class="flex flex-wrap items-center gap-2">
          <NuxtLink
            :to="`/keyword-groups/${suggestion.id}`"
            class="text-lg font-semibold text-slate-900 underline decoration-transparent underline-offset-4 transition hover:decoration-slate-300"
          >
            {{ suggestion.name }}
          </NuxtLink>

          <UBadge
            v-if="primaryKeywordDifficulty !== null"
            variant="soft"
            :class="
              getKeywordDifficultyToneClass(primaryKeywordDifficulty)
            "
          >
            {{ getKeywordDifficultyLabel(primaryKeywordDifficulty) }}
          </UBadge>

          <UBadge
            v-if="assignedBadgeLabel"
            :color="isAssignedToCurrentUser ? 'primary' : 'neutral'"
            variant="soft"
          >
            <UIcon name="i-lucide-user-round" class="h-3.5 w-3.5" />
            {{ assignedBadgeLabel }}
          </UBadge>
        </div>

        <div
          v-if="templateTypes.length"
          class="flex flex-wrap items-center gap-2"
        >
          <UBadge
            v-for="template in templateTypes"
            :key="template"
            color="info"
            variant="soft"
          >
            {{ pageTypeLabels[template] }}
          </UBadge>
        </div>

        <p v-if="suggestion.description" class="text-sm text-slate-500">
          {{ suggestion.description }}
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <NuxtLink
          v-if="templateTypes.length"
          :to="createPageHref"
          class="whitespace-nowrap inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90"
        >
          <UIcon name="i-lucide-file-plus-2" class="shrink-0 h-4 w-4" />
          Créer la page
        </NuxtLink>

        <UButton
          v-if="templateTypes.length"
          color="neutral"
          variant="soft"
          icon="i-lucide-link"
          class="whitespace-nowrap"
          @click="isAssociateModalOpen = true"
        >
          Associer à une page
        </UButton>

        <UButton
          v-else
          color="neutral"
          variant="soft"
          icon="i-lucide-link"
          disabled
          class="whitespace-nowrap"
        >
          Associer à une page
        </UButton>

        <UButton
          v-if="templateTypes.length"
          color="neutral"
          variant="soft"
          icon="i-lucide-file-plus"
          :loading="isCreatingBlankPage"
          class="whitespace-nowrap"
          @click="handleCreateBlankPage"
        >
          Créer la page vide
        </UButton>

        <UButton
          v-else
          color="primary"
          variant="soft"
          icon="i-lucide-file-plus-2"
          disabled
          class="whitespace-nowrap"
        >
          Créer la page
        </UButton>

        <UButton
          v-if="!templateTypes.length"
          color="neutral"
          variant="soft"
          icon="i-lucide-file-plus"
          disabled
          class="whitespace-nowrap"
        >
          Créer la page vide
        </UButton>

        <UButton
          color="neutral"
          variant="soft"
          :icon="assignmentActionIcon"
          :loading="isUpdatingAssignment"
          class="whitespace-nowrap"
          @click="handleAssignmentToggle"
        >
          {{ assignmentActionLabel }}
        </UButton>
      </div>
    </div>

    <!-- <div class="mt-4 min-h-0 flex-1">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Mots-clés
      </p>

      <ul class="mt-2 max-h-[18rem] space-y-1 overflow-y-auto pr-2 text-sm text-slate-700">
        <li
          v-for="keyword in suggestion.keywords"
          :key="keyword.id"
          class="flex flex-wrap items-center gap-2"
        >
          <NuxtLink
            :to="`/keywords/research?q=${encodeURIComponent(keyword.keyword)}&autorun=0`"
            class="font-medium text-slate-900 underline decoration-transparent underline-offset-4 transition hover:decoration-slate-300"
          >
            {{ keyword.keyword }}
          </NuxtLink>

          <UBadge
            v-if="isPrimaryKeyword(keyword.keyword)"
            color="warning"
            variant="soft"
            size="sm"
          >
            Mot-clé principal
          </UBadge>
        </li>
      </ul>
    </div> -->

  </article>

  <KeywordGroupSuggestionAssociatePageModal
    v-model:open="isAssociateModalOpen"
    :suggestion="suggestion"
    @associated="emit('associated', $event)"
  />
</template>
