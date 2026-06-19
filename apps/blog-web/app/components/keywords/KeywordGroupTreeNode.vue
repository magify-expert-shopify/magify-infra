<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { KeywordGroupTreeRecord } from "~/types/keywords";
import { normalizeSearchText } from "~/utils/search-normalizer";

defineOptions({
  name: "KeywordGroupTreeNode",
});

const props = defineProps<{
  node: KeywordGroupTreeRecord;
  level?: number;
  draggedGroupId?: string | null;
  dropTargetGroupId?: string | null;
  convertingGroupId?: string | null;
  updatingFavoriteGroupId?: string | null;
  forcedExpandedDepth?: number | null;
  renderParentGroupId?: string | null;
  displayMode?: "vertical" | "compact";
}>();

const emit = defineEmits<{
  dragStart: [groupId: string];
  dragEnd: [];
  dragOver: [event: DragEvent];
  dragEnterGroup: [groupId: string];
  dragLeaveGroup: [groupId: string];
  dropGroup: [groupId: string];
  detachGroup: [groupId: string, parentGroupId: string | null];
  moveGroup: [groupId: string, parentGroupId: string | null];
  convertToCluster: [groupId: string];
  toggleFavorite: [groupId: string];
}>();

const treeLevel = computed(() => Math.max(1, props.level ?? 1));

const hierarchyToneClasses = computed(() => {
  if (treeLevel.value === 1) {
    return "border-amber-200 bg-amber-100 text-amber-800";
  }

  if (treeLevel.value === 2) {
    return "border-sky-200 bg-sky-100 text-sky-800";
  }

  if (treeLevel.value === 3) {
    return "border-rose-200 bg-rose-100 text-rose-800";
  }

  if (treeLevel.value === 4) {
    return "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  if (treeLevel.value === 5) {
    return "border-violet-200 bg-violet-100 text-violet-800";
  }

  if (treeLevel.value === 6) {
    return "border-cyan-200 bg-cyan-100 text-cyan-800";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
});

const nameToneClasses = computed(() => {
  if (treeLevel.value === 1) {
    return "text-lg";
  }

  if (treeLevel.value === 2) {
    return "text-base";
  }

  if (treeLevel.value === 3) {
    return "text-sm";
  }

  if (treeLevel.value === 4) {
    return "text-sm";
  }

  if (treeLevel.value === 5) {
    return "text-xs";
  }

  if (treeLevel.value === 6) {
    return "text-xs";
  }

  return "text-xs";
});

function handleDragStart(event: DragEvent) {
  if (event.target !== event.currentTarget) {
    return;
  }

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", props.node.id);
  }

  emit("dragStart", props.node.id);
}

const primaryKeywordSlug = computed(() => {
  const value = props.node.primaryKeyword?.trim();

  if (!value) {
    return "";
  }

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
});

const normalizedPrimaryKeyword = computed(
  () => normalizeSearchText(props.node.primaryKeyword),
);

const canDetachCurrentParent = computed(() =>
  Boolean(props.renderParentGroupId ?? props.node.renderParentGroupId),
);

const hasForcedExpansionDepth = computed(
  () => typeof props.forcedExpandedDepth === "number",
);

const isChildrenExpanded = ref(false);
const isVerticalLayout = computed(
  () => (props.displayMode ?? "vertical") === "vertical",
);

function getDefaultChildrenVisibility() {
  if (!props.node.children.length) {
    return false;
  }

  if (hasForcedExpansionDepth.value) {
    return treeLevel.value < (props.forcedExpandedDepth ?? treeLevel.value);
  }

  return true;
}

watch(
  () => props.forcedExpandedDepth,
  () => {
    isChildrenExpanded.value = getDefaultChildrenVisibility();
  },
  { immediate: true },
);

const shouldShowChildren = computed(() => {
  if (!props.node.children.length) {
    return false;
  }

  return isChildrenExpanded.value;
});

function isPrimaryKeyword(keyword: string) {
  return normalizeSearchText(keyword) === normalizedPrimaryKeyword.value;
}

function toggleChildrenVisibility() {
  if (!props.node.children.length) {
    return;
  }

  isChildrenExpanded.value = !isChildrenExpanded.value;
}
</script>

<template>
  <article
    class="flex flex-col"
    draggable="true"
    @dragstart.stop="handleDragStart"
    @dragend="$emit('dragEnd')"
    @dragenter.stop.prevent="$emit('dragEnterGroup', props.node.id)"
    @dragover.stop.prevent="
      $emit('dragEnterGroup', props.node.id);
      $emit('dragOver', $event);
    "
    @dragleave.stop.prevent="$emit('dragLeaveGroup', props.node.id)"
    @drop.stop.prevent="$emit('dropGroup', props.node.id)"
  >
    <div
      class="flex flex-col gap-4"
      :class="[
        isVerticalLayout
          ? 'lg:items-stretch max-w-60 self-center'
          : 'lg:flex-row lg:items-start lg:justify-between',
        props.draggedGroupId === props.node.id ? 'opacity-60' : 'opacity-100',
      ]"
    >
      <div
        class="min-w-0 flex-1 flex rounded-2xl border p-4 transition"
        :class="[
          props.dropTargetGroupId === props.node.id &&
          props.draggedGroupId !== props.node.id
            ? 'border-sky-300 bg-sky-50 ring-4 ring-sky-100'
            : 'border-slate-200 bg-slate-50',
        ]"
      >
        <div
          class="flex cursor-pointer select-none gap-2"
          role="button"
          tabindex="0"
          :title="
            shouldShowChildren ? 'Masquer les enfants' : 'Afficher les enfants'
          "
          :class="isVerticalLayout ? 'flex-col' : 'items-center'"
          @click.stop="toggleChildrenVisibility"
          @keydown.enter.prevent.stop="toggleChildrenVisibility"
          @keydown.space.prevent.stop="toggleChildrenVisibility"
        >
          <div class="flex items-center gap-2">
            <UIcon
              name="i-lucide-grip-vertical"
              class="shrink-0 h-4 w-4 text-slate-400"
            />
            <UBadge variant="soft" :class="hierarchyToneClasses">
              N{{ treeLevel }}
            </UBadge>
            <h2
              class="font-semibold text-slate-900"
              :class="[isVerticalLayout ? '' : 'shrink-0', nameToneClasses]"
            >
              {{ props.node.name }}
            </h2>
          </div>
          <p
            v-if="props.node.description"
            class="max-w-full truncate text-sm text-slate-500"
          >
            {{ props.node.description }}
          </p>
        </div>

        <div class="ml-auto flex items-center justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            class="group/favorite"
            :loading="props.updatingFavoriteGroupId === props.node.id"
            :title="
              props.node.isFavorite
                ? 'Retirer des favoris'
                : 'Ajouter aux favoris'
            "
            @click.stop="$emit('toggleFavorite', props.node.id)"
          >
            <UIcon
              name="i-lucide-star"
              class="h-4 w-4 transition"
              :class="
                props.node.isFavorite
                  ? 'fill-amber-500 text-amber-500'
                  : 'text-amber-600/40 opacity-80 group-hover/favorite:text-amber-600 group-hover/favorite:opacity-100'
              "
            />
          </UButton>
          <UButton
            v-if="canDetachCurrentParent"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-unlink"
            :title="
              props.node.parentGroups?.length > 1
                ? 'Retirer ce parent'
                : 'Rendre orphelin'
            "
            @click.stop="
              $emit(
                'detachGroup',
                props.node.id,
                props.renderParentGroupId ??
                  props.node.renderParentGroupId ??
                  null,
              )
            "
          />
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-folder-input"
            title="Déplacer vers un autre parent"
            @click.stop="
              $emit(
                'moveGroup',
                props.node.id,
                props.renderParentGroupId ??
                  props.node.renderParentGroupId ??
                  null,
              )
            "
          />
        </div>

        <!-- <div
          v-if="isVerticalLayout && props.node.keywords?.length"
          class="mt-4 flex flex-wrap gap-2"
        >
          <span
            v-for="keyword in props.node.keywords"
            :key="keyword.id"
            class="inline-flex rounded-full border px-3 py-1 text-xs font-medium"
            :class="
              isPrimaryKeyword(keyword.keyword)
                ? 'border-amber-300 bg-amber-100 text-amber-800 shadow-sm'
                : 'border-sky-200 bg-sky-50 text-sky-700'
            "
          >
            {{ keyword.keyword }}
          </span>
        </div> -->
      </div>

      <!-- <div class="flex min-w-0 flex-wrap items-start justify-start gap-2 lg:max-w-[24rem] lg:justify-end">
        <span
          v-for="keyword in props.node.keywords"
          :key="keyword.id"
          class="inline-flex rounded-full border px-3 py-1 text-xs font-medium"
          :class="
            isPrimaryKeyword(keyword.keyword)
              ? 'border-amber-300 bg-amber-100 text-amber-800 shadow-sm'
              : 'border-sky-200 bg-sky-50 text-sky-700'
          "
        >
          {{ keyword.keyword }}
        </span>
      </div> -->

      <!-- <div class="flex flex-col items-start gap-2">
        <NuxtLink
          v-if="props.node.seoCluster"
          :to="`/clusters/${props.node.seoCluster.id}`"
          class="text-sm font-medium text-emerald-700 underline underline-offset-4"
        >
          Ouvrir le cluster
        </NuxtLink>

        <UButton
          v-else
          icon="i-lucide-folder-tree"
          :loading="props.convertingGroupId === props.node.id"
          class="whitespace-nowrap"
          @click="$emit('convertToCluster', props.node.id)"
        >
          Transformer en cluster
        </UButton>
      </div> -->
    </div>

    <div
      v-if="shouldShowChildren"
      :class="
        isVerticalLayout
          ? 'mt-4 flex gap-4 border-slate-200 pl-8'
          : 'mt-4 space-y-3 border-slate-200 pl-8'
      "
    >
      <div
        v-for="child in props.node.children"
        :key="child.id"
        :class="isVerticalLayout ? 'shrink-0' : ''"
      >
        <KeywordGroupTreeNode
          :node="child"
          :level="treeLevel + 1"
          :dragged-group-id="props.draggedGroupId"
          :drop-target-group-id="props.dropTargetGroupId"
          :converting-group-id="props.convertingGroupId"
          :updating-favorite-group-id="props.updatingFavoriteGroupId"
          :display-mode="props.displayMode"
          :forced-expanded-depth="props.forcedExpandedDepth"
          :render-parent-group-id="props.node.id"
          @drag-start="$emit('dragStart', $event)"
          @drag-end="$emit('dragEnd')"
          @drag-over="$emit('dragOver', $event)"
          @drag-enter-group="$emit('dragEnterGroup', $event)"
          @drag-leave-group="$emit('dragLeaveGroup', $event)"
          @drop-group="$emit('dropGroup', $event)"
          @toggle-favorite="$emit('toggleFavorite', $event)"
          @detach-group="
            (groupId, parentGroupId) =>
              $emit('detachGroup', groupId, parentGroupId)
          "
          @convert-to-cluster="$emit('convertToCluster', $event)"
        />
      </div>
    </div>
  </article>
</template>
