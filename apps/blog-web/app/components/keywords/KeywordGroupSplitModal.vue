<script setup lang="ts">
import type { KeywordGroupRecord, KeywordRecord } from "~/types/keywords";

type SplitSide = "left" | "right";

type SplitGroupDraft = {
  name: string;
  description: string;
  keywordIds: string[];
  primaryKeyword: string | null;
};

const props = defineProps<{
  open: boolean;
  group: KeywordGroupRecord | null;
  isSubmitting?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  submit: [
    payload: {
      left: SplitGroupDraft;
      right: SplitGroupDraft;
    },
  ];
}>();

const leftName = ref("");
const leftDescription = ref("");
const rightName = ref("");
const rightDescription = ref("");
const leftKeywords = ref<KeywordRecord[]>([]);
const rightKeywords = ref<KeywordRecord[]>([]);
const draggedKeywordId = ref<string | null>(null);
const draggedFromSide = ref<SplitSide | null>(null);
const activeDropSide = ref<SplitSide | null>(null);

function buildPrimaryKeyword(
  keywords: KeywordRecord[],
  preferredKeyword: string | null | undefined,
) {
  const normalizedPreferredKeyword = preferredKeyword?.trim().toLowerCase() ?? "";

  if (normalizedPreferredKeyword) {
    const match = keywords.find(
      (keyword) => keyword.keyword.trim().toLowerCase() === normalizedPreferredKeyword,
    );

    if (match) {
      return match.keyword;
    }
  }

  return keywords[0]?.keyword ?? null;
}

function resetState() {
  const group = props.group;

  if (!group) {
    leftName.value = "";
    leftDescription.value = "";
    rightName.value = "";
    rightDescription.value = "";
    leftKeywords.value = [];
    rightKeywords.value = [];
    return;
  }

  leftName.value = group.name;
  leftDescription.value = group.description ?? "";
  rightName.value = `${group.name} 2`;
  rightDescription.value = "";
  leftKeywords.value = [...group.keywords];
  rightKeywords.value = [];
}

watch(
  () => [props.open, props.group?.id],
  ([open]) => {
    if (open) {
      resetState();
    }
  },
  { immediate: true },
);

const totalKeywordsCount = computed(
  () => leftKeywords.value.length + rightKeywords.value.length,
);

const canSubmit = computed(
  () =>
    leftName.value.trim().length > 0 &&
    rightName.value.trim().length > 0 &&
    leftKeywords.value.length > 0 &&
    rightKeywords.value.length > 0 &&
    totalKeywordsCount.value > 1,
);

function closeModal() {
  emit("update:open", false);
}

function moveKeyword(
  keywordId: string,
  targetSide: SplitSide,
  targetIndex?: number,
) {
  const sourceSide =
    leftKeywords.value.some((keyword) => keyword.id === keywordId) ? "left" : "right";
  const sourceList =
    sourceSide === "left" ? leftKeywords.value : rightKeywords.value;
  const destinationList =
    targetSide === "left" ? leftKeywords.value : rightKeywords.value;
  const sourceIndex = sourceList.findIndex((keyword) => keyword.id === keywordId);

  if (sourceIndex === -1) {
    return;
  }

  const [keyword] = sourceList.splice(sourceIndex, 1);

  if (!keyword) {
    return;
  }

  const rawIndex =
    typeof targetIndex === "number" ? targetIndex : destinationList.length;
  const safeIndex = Math.max(0, Math.min(rawIndex, destinationList.length));

  destinationList.splice(safeIndex, 0, keyword);
}

function handleDragStart(keywordId: string, side: SplitSide) {
  draggedKeywordId.value = keywordId;
  draggedFromSide.value = side;
}

function handleDrop(targetSide: SplitSide, targetIndex?: number) {
  if (!draggedKeywordId.value) {
    return;
  }

  moveKeyword(draggedKeywordId.value, targetSide, targetIndex);
  activeDropSide.value = null;
  draggedKeywordId.value = null;
  draggedFromSide.value = null;
}

function clearDragState() {
  activeDropSide.value = null;
  draggedKeywordId.value = null;
  draggedFromSide.value = null;
}

function submitSplit() {
  if (!props.group || !canSubmit.value) {
    return;
  }

  emit("submit", {
    left: {
      name: leftName.value.trim(),
      description: leftDescription.value.trim(),
      keywordIds: leftKeywords.value.map((keyword) => keyword.id),
      primaryKeyword: buildPrimaryKeyword(
        leftKeywords.value,
        props.group.primaryKeyword,
      ),
    },
    right: {
      name: rightName.value.trim(),
      description: rightDescription.value.trim(),
      keywordIds: rightKeywords.value.map((keyword) => keyword.id),
      primaryKeyword: buildPrimaryKeyword(
        rightKeywords.value,
        props.group.primaryKeyword,
      ),
    },
  });
}
</script>

<template>
  <UModal
    :open="open"
    :ui="{ content: 'sm:max-w-7xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
        <div class="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div class="space-y-1">
            <h2 class="text-xl font-semibold text-slate-900">
              Splitter le groupe de mots-clés
            </h2>
            <p class="max-w-3xl text-sm leading-6 text-slate-500">
              Réorganise les mots-clés entre deux groupes, puis enregistre le split.
            </p>
          </div>

          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-x"
            @click="closeModal"
          />
        </div>

        <div class="mt-6 grid gap-6 xl:grid-cols-2">
          <section class="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
            <div class="space-y-4">
              <div class="grid gap-4">
                <label class="block space-y-2">
                  <span class="text-sm font-medium text-slate-700">
                    Nom du groupe 1
                  </span>
                  <UInput v-model="leftName" class="w-full" />
                </label>

                <label class="block space-y-2">
                  <span class="text-sm font-medium text-slate-700">
                    Description du groupe 1
                  </span>
                  <UTextarea
                    v-model="leftDescription"
                    :rows="4"
                    autoresize
                    class="w-full"
                  />
                </label>
              </div>

              <div
                class="rounded-3xl border border-dashed bg-white p-4 transition"
                :class="
                  activeDropSide === 'left'
                    ? 'border-sky-300 bg-sky-50'
                    : 'border-slate-200'
                "
                @dragover.prevent="activeDropSide = 'left'"
                @dragleave="activeDropSide = null"
                @drop.prevent="handleDrop('left')"
              >
                <div class="mb-3 flex items-center justify-between gap-3">
                  <h3 class="font-medium text-slate-900">Mots-clés du groupe 1</h3>
                  <UBadge color="neutral" variant="soft">
                    {{ leftKeywords.length }}
                  </UBadge>
                </div>

                <div v-if="leftKeywords.length" class="space-y-2">
                  <div
                    v-for="(keyword, index) in leftKeywords"
                    :key="keyword.id"
                    draggable="true"
                    class="cursor-move rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-slate-300"
                    @dragstart="handleDragStart(keyword.id, 'left')"
                    @dragend="clearDragState"
                    @dragover.prevent="activeDropSide = 'left'"
                    @drop.prevent="handleDrop('left', index)"
                  >
                    <div class="flex items-center justify-between gap-3">
                      <div class="min-w-0">
                        <p class="truncate font-medium text-slate-900">
                          {{ keyword.keyword }}
                        </p>
                        <p class="text-xs text-slate-500">
                          Vol. {{ keyword.volume ?? "-" }} · Diff.
                          {{ keyword.difficulty ?? "-" }}
                        </p>
                      </div>

                      <UIcon
                        name="i-lucide-grip-vertical"
                        class="h-4 w-4 shrink-0 text-slate-400"
                      />
                    </div>
                  </div>
                </div>

                <p v-else class="text-sm text-slate-500">
                  Dépose au moins un mot-clé ici.
                </p>
              </div>
            </div>
          </section>

          <section class="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
            <div class="space-y-4">
              <div class="grid gap-4">
                <label class="block space-y-2">
                  <span class="text-sm font-medium text-slate-700">
                    Nom du groupe 2
                  </span>
                  <UInput v-model="rightName" class="w-full" />
                </label>

                <label class="block space-y-2">
                  <span class="text-sm font-medium text-slate-700">
                    Description du groupe 2
                  </span>
                  <UTextarea
                    v-model="rightDescription"
                    :rows="4"
                    autoresize
                    class="w-full"
                  />
                </label>
              </div>

              <div
                class="rounded-3xl border border-dashed bg-white p-4 transition"
                :class="
                  activeDropSide === 'right'
                    ? 'border-sky-300 bg-sky-50'
                    : 'border-slate-200'
                "
                @dragover.prevent="activeDropSide = 'right'"
                @dragleave="activeDropSide = null"
                @drop.prevent="handleDrop('right')"
              >
                <div class="mb-3 flex items-center justify-between gap-3">
                  <h3 class="font-medium text-slate-900">Mots-clés du groupe 2</h3>
                  <UBadge color="neutral" variant="soft">
                    {{ rightKeywords.length }}
                  </UBadge>
                </div>

                <div v-if="rightKeywords.length" class="space-y-2">
                  <div
                    v-for="(keyword, index) in rightKeywords"
                    :key="keyword.id"
                    draggable="true"
                    class="cursor-move rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-slate-300"
                    @dragstart="handleDragStart(keyword.id, 'right')"
                    @dragend="clearDragState"
                    @dragover.prevent="activeDropSide = 'right'"
                    @drop.prevent="handleDrop('right', index)"
                  >
                    <div class="flex items-center justify-between gap-3">
                      <div class="min-w-0">
                        <p class="truncate font-medium text-slate-900">
                          {{ keyword.keyword }}
                        </p>
                        <p class="text-xs text-slate-500">
                          Vol. {{ keyword.volume ?? "-" }} · Diff.
                          {{ keyword.difficulty ?? "-" }}
                        </p>
                      </div>

                      <UIcon
                        name="i-lucide-grip-vertical"
                        class="h-4 w-4 shrink-0 text-slate-400"
                      />
                    </div>
                  </div>
                </div>

                <p v-else class="text-sm text-slate-500">
                  Glisse des mots-clés ici pour créer le second groupe.
                </p>
              </div>
            </div>
          </section>
        </div>

        <div class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
          <p class="text-sm text-slate-500">
            Chaque groupe doit avoir un nom et au moins un mot-clé.
          </p>

          <div class="flex flex-wrap items-center gap-3">
            <UButton color="neutral" variant="soft" @click="closeModal">
              Annuler
            </UButton>

            <UButton
              color="primary"
              icon="i-lucide-split"
              :loading="isSubmitting"
              :disabled="!canSubmit"
              @click="submitSplit"
            >
              Splitter le groupe
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
