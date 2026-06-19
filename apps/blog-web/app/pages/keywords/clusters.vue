<script setup lang="ts">
import KeywordGroupTreeNode from "~/components/keywords/KeywordGroupTreeNode.vue";
import type {
  KeywordGroupRecord,
  KeywordGroupTreeRecord,
} from "~/types/keywords";
import { normalizeSearchText } from "~/utils/search-normalizer";

const {
  convertKeywordGroupToCluster,
  listKeywordGroups,
  setKeywordGroupFavorite,
  updateKeywordGroup,
} = useKeywords();
const { showErrorToast, showSuccessToast, showWarningToast } = useAppToast();

const {
  data: groups,
  status,
  error,
  refresh,
} = await useAsyncData("keywords:clusters:groups", () => listKeywordGroups());

const convertingGroupId = ref<string | null>(null);
const updatingFavoriteGroupId = ref<string | null>(null);
const draggedGroupId = ref<string | null>(null);
const dropTargetGroupId = ref<string | null>(null);
const rootDropDepth = ref(0);
const isRootDropZoneActive = ref(false);
const isRefreshingGroups = ref(false);
const isReparentModalOpen = ref(false);
const reparentSourceGroupId = ref<string | null>(null);
const reparentSourceParentGroupId = ref<string | null>(null);
const reparentTargetParentGroupId = ref<string | null>(null);
const reparentParentSearch = ref("");
const isReparentingGroup = ref(false);
const treeScrollContainer = ref<HTMLElement | null>(null);
const accordionDepth = ref<number>(3);
const accordionDepthOptions = [2, 3, 4, 5, 6] as const;
const groupTreeFilter = ref("");
const onlyFavorites = ref(false);
const displayMode = ref<"vertical" | "compact">("compact");
const breadcrumbItems = [
  {
    label: "Mots-clés",
    to: "/keywords/list",
  },
  {
    label: "Regrouper par théme",
  },
];

const groupsById = computed(() => {
  const map = new Map<string, KeywordGroupRecord>();

  for (const group of groups.value ?? []) {
    map.set(group.id, group);
  }

  return map;
});

function getResolvedParentGroupIds(group: KeywordGroupRecord) {
  const parentGroupIds = [
    ...(group.parentGroups?.map((parentGroup) => parentGroup.id) ?? []),
  ]
    .map((parentGroupId) => parentGroupId.trim())
    .filter(Boolean);

  return [...new Set(parentGroupIds)];
}

const parentGroupIdsById = computed(() => {
  const map = new Map<string, string[]>();

  for (const group of groups.value ?? []) {
    map.set(group.id, getResolvedParentGroupIds(group));
  }

  return map;
});

const childGroupIdsById = computed(() => {
  const map = new Map<string, string[]>();

  for (const group of groups.value ?? []) {
    map.set(group.id, []);
  }

  for (const [groupId, parentGroupIds] of parentGroupIdsById.value.entries()) {
    for (const parentGroupId of parentGroupIds) {
      const children = map.get(parentGroupId) ?? [];

      if (!children.includes(groupId)) {
        children.push(groupId);
      }

      map.set(parentGroupId, children);
    }
  }

  return map;
});

const reparentableGroups = computed(() => {
  const sourceGroupId = reparentSourceGroupId.value;

  if (!sourceGroupId) {
    return [];
  }

  const search = normalizeSearchText(reparentParentSearch.value);

  return [...groupsById.value.values()]
    .filter((group) => group.id !== sourceGroupId)
    .filter((group) => canMoveGroup(sourceGroupId, group.id))
    .filter((group) => {
      if (!search) {
        return true;
      }

      return [
        group.name,
        group.description ?? "",
        group.primaryKeyword ?? "",
      ]
        .join(" ")
        .includes(search);
    })
    .sort((left, right) => left.name.localeCompare(right.name));
});

const groupTree = computed<KeywordGroupTreeRecord[]>(() => {
  const sortByName = (leftId: string, rightId: string) => {
    const leftName =
      groupsById.value.get(leftId)?.name.trim().toLowerCase() ?? "";
    const rightName =
      groupsById.value.get(rightId)?.name.trim().toLowerCase() ?? "";

    return leftName.localeCompare(rightName);
  };

  const buildNode = (
    groupId: string,
    renderParentGroupId: string | null,
    lineage = new Set<string>(),
  ): KeywordGroupTreeRecord | null => {
    const sourceGroup = groupsById.value.get(groupId);

    if (!sourceGroup || lineage.has(groupId)) {
      return null;
    }

    const nextLineage = new Set(lineage);
    nextLineage.add(groupId);

    const childIds = [...(childGroupIdsById.value.get(groupId) ?? [])].sort(
      sortByName,
    );
    const children = childIds
      .map((childId) => buildNode(childId, groupId, nextLineage))
      .filter((child): child is KeywordGroupTreeRecord => Boolean(child));

    return {
      ...sourceGroup,
      renderParentGroupId,
      children,
    };
  };

  const rootIds = [...groupsById.value.values()]
    .filter((group) => !(parentGroupIdsById.value.get(group.id) ?? []).length)
    .map((group) => group.id)
    .sort(sortByName);

  return rootIds
    .map((groupId) => buildNode(groupId, null))
    .filter((group): group is KeywordGroupTreeRecord => Boolean(group));
});

function normalizeFilterValue(value: string) {
  return normalizeSearchText(value);
}

function matchesGroupFilter(
  group: KeywordGroupTreeRecord,
  filterValue: string,
) {
  if (!filterValue) {
    return true;
  }

  const haystacks = [
    group.name,
    group.primaryKeyword ?? "",
    ...(group.keywords?.map((keyword) => keyword.keyword) ?? []),
  ].join(" ");

  return normalizeSearchText(haystacks).includes(filterValue);
}

function matchesFavoriteFilter(group: KeywordGroupTreeRecord) {
  return group.isFavorite ?? false;
}

function cloneFilteredTree(
  nodes: KeywordGroupTreeRecord[],
  filterValue: string,
  favoritesOnly: boolean,
): KeywordGroupTreeRecord[] {
  const filteredNodes: KeywordGroupTreeRecord[] = [];

  for (const node of nodes) {
    const filteredChildren = cloneFilteredTree(
      node.children,
      filterValue,
      favoritesOnly,
    );
    const isDirectTextMatch = filterValue
      ? matchesGroupFilter(node, filterValue)
      : true;
    const isDirectFavoriteMatch = favoritesOnly
      ? matchesFavoriteFilter(node)
      : true;

    if (
      (isDirectTextMatch && isDirectFavoriteMatch) ||
      filteredChildren.length
    ) {
      filteredNodes.push({
        ...node,
        children: filteredChildren,
      });
    }
  }

  return filteredNodes;
}

const filteredGroupTree = computed(() => {
  const filterValue = normalizeFilterValue(groupTreeFilter.value);

  return cloneFilteredTree(groupTree.value, filterValue, onlyFavorites.value);
});

const rootGroups = computed(() => filteredGroupTree.value);
const hasLoadedGroups = computed(() => !!groups.value?.length);
const isInitialLoading = computed(
  () => status.value === "pending" && !hasLoadedGroups.value,
);
const shouldShowErrorState = computed(
  () => !!error.value && !hasLoadedGroups.value,
);

function resetRootDropZoneState() {
  rootDropDepth.value = 0;
  isRootDropZoneActive.value = false;
}

function formatKeywordGroupTreeForClipboard(
  nodes: KeywordGroupTreeRecord[],
  prefix = "",
): string {
  const normalizeTreeText = (value: string) =>
    value
      .replaceAll(/\s*\n+\s*/g, " ")
      .replaceAll(/\s{2,}/g, " ")
      .trim();

  return nodes
    .map((node, index) => {
      const isLastNode = index === nodes.length - 1;
      const connector = isLastNode ? "└── " : "├── ";
      const nextPrefix = `${prefix}${isLastNode ? "    " : "│   "}`;
      const primaryKeywordLabel = node.primaryKeyword?.trim()
        ? ` (${node.primaryKeyword.trim()})`
        : "";
      const descriptionLabel = node.description?.trim()
        ? ` - ${normalizeTreeText(node.description)}`
        : "";
      const children = node.children.length
        ? `\n${formatKeywordGroupTreeForClipboard(node.children, nextPrefix)}`
        : "";

      return `${prefix}${connector}${node.name}${primaryKeywordLabel}${descriptionLabel}${children}`;
    })
    .join("\n");
}

async function copyKeywordGroupTreeToClipboard() {
  if (!rootGroups.value.length) {
    showWarningToast(
      "Arborescence vide",
      "Aucun groupe n'est disponible à copier.",
    );
    return;
  }

  const treeText = formatKeywordGroupTreeForClipboard(rootGroups.value);

  try {
    await navigator.clipboard.writeText(treeText);
    showSuccessToast(
      "Arborescence copiée",
      "Le rendu texte de l'arbre des groupes a été copié dans le presse-papiers.",
    );
  } catch (error) {
    console.error("[Clusters] tree copy failed", error);
    showErrorToast(
      "Copie impossible",
      "Le navigateur n'a pas autorisé l'accès au presse-papiers.",
    );
  }
}

function handleDragStart(groupId: string) {
  draggedGroupId.value = groupId;
}

function handleDragEnd() {
  draggedGroupId.value = null;
  dropTargetGroupId.value = null;
  resetRootDropZoneState();
}

function handleDragEnterGroup(groupId: string) {
  if (!draggedGroupId.value) {
    return;
  }

  if (!canMoveGroup(draggedGroupId.value, groupId)) {
    return;
  }

  dropTargetGroupId.value = groupId;
}

function handleDragLeaveGroup(groupId: string) {
  if (dropTargetGroupId.value === groupId) {
    dropTargetGroupId.value = null;
  }
}

function handleTreeDragOver(event: DragEvent) {
  if (!draggedGroupId.value || !treeScrollContainer.value) {
    return;
  }

  const container = treeScrollContainer.value;
  const rect = container.getBoundingClientRect();
  const threshold = 72;
  const scrollStep = 24;

  if (event.clientY < rect.top + threshold) {
    container.scrollTop = Math.max(0, container.scrollTop - scrollStep);
  } else if (event.clientY > rect.bottom - threshold) {
    container.scrollTop += scrollStep;
  }
}

function handleRootDragEnter() {
  if (!draggedGroupId.value) {
    return;
  }

  rootDropDepth.value += 1;
  isRootDropZoneActive.value = true;
}

function handleRootDragLeave() {
  rootDropDepth.value = Math.max(0, rootDropDepth.value - 1);

  if (!rootDropDepth.value) {
    isRootDropZoneActive.value = false;
  }
}

async function moveGroup(groupId: string, parentGroupIds: string[]) {
  if (convertingGroupId.value) {
    return;
  }

  const normalizedParentGroupIds = [
    ...new Set(
      parentGroupIds
        .map((parentGroupId) => parentGroupId.trim())
        .filter(Boolean),
    ),
  ];

  if (normalizedParentGroupIds.length > 3) {
    showWarningToast(
      "Trop de parents",
      "Un groupe peut avoir au maximum 3 parents.",
    );
    return;
  }

  if (
    normalizedParentGroupIds.some(
      (parentGroupId) => !canMoveGroup(groupId, parentGroupId),
    )
  ) {
    showWarningToast(
      "Déplacement impossible",
      "Un groupe ne peut pas être déplacé dans lui-même ou dans un de ses descendants.",
    );
    return;
  }

  convertingGroupId.value = groupId;

  try {
    isRefreshingGroups.value = true;
    await updateKeywordGroup(groupId, {
      parentGroupIds: normalizedParentGroupIds,
    });
    await refresh();
    showSuccessToast(
      normalizedParentGroupIds.length
        ? "Groupe déplacé"
        : "Groupe remonté à la racine",
      "La hiérarchie a été mise à jour.",
    );
  } catch (err) {
    showErrorToast(
      "Impossible de déplacer le groupe",
      err instanceof Error
        ? err.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    convertingGroupId.value = null;
    isRefreshingGroups.value = false;
  }
}

function canMoveGroup(groupId: string, targetParentId: string | null) {
  if (!targetParentId) {
    return true;
  }

  if (groupId === targetParentId) {
    return false;
  }

  const visited = new Set<string>();
  const stack = [...(childGroupIdsById.value.get(groupId) ?? [])];

  while (stack.length) {
    const cursor = stack.pop();

    if (!cursor || visited.has(cursor)) {
      continue;
    }

    if (cursor === targetParentId) {
      return false;
    }

    visited.add(cursor);
    stack.push(...(childGroupIdsById.value.get(cursor) ?? []));
  }

  return true;
}

async function toggleGroupFavorite(groupId: string) {
  if (updatingFavoriteGroupId.value) {
    return;
  }

  const group = groupsById.value.get(groupId);

  if (!group) {
    return;
  }

  updatingFavoriteGroupId.value = groupId;

  try {
    const updatedGroup = await setKeywordGroupFavorite(
      groupId,
      !group.isFavorite,
    );

    groups.value =
      groups.value?.map((item) =>
        item.id === updatedGroup.id
          ? { ...item, isFavorite: updatedGroup.isFavorite }
          : item,
      ) ?? groups.value;
  } catch (error) {
    showErrorToast("Impossible de mettre à jour le favori du groupe.", error);
  } finally {
    updatingFavoriteGroupId.value = null;
  }
}

async function handleConvertGroup(groupId: string) {
  if (convertingGroupId.value) {
    return;
  }

  convertingGroupId.value = groupId;

  try {
    isRefreshingGroups.value = true;
    await convertKeywordGroupToCluster(groupId);
    await refresh();
    await refreshNuxtData("seo-clusters");
  } finally {
    convertingGroupId.value = null;
    isRefreshingGroups.value = false;
  }
}

async function handleRefresh() {
  if (isRefreshingGroups.value) {
    return;
  }

  isRefreshingGroups.value = true;

  try {
    await refresh();
  } finally {
    isRefreshingGroups.value = false;
  }
}

async function handleDropOnGroup(targetGroupId: string) {
  if (!draggedGroupId.value) {
    return;
  }

  const sourceGroupId = draggedGroupId.value;
  draggedGroupId.value = null;
  dropTargetGroupId.value = null;
  resetRootDropZoneState();

  const sourceParentGroupIds =
    parentGroupIdsById.value.get(sourceGroupId) ?? [];
  const nextParentGroupIds = [...sourceParentGroupIds, targetGroupId].filter(
    (parentGroupId, index, items) => items.indexOf(parentGroupId) === index,
  );

  if (
    nextParentGroupIds.some(
      (parentGroupId) => !canMoveGroup(sourceGroupId, parentGroupId),
    )
  ) {
    return;
  }

  await moveGroup(sourceGroupId, nextParentGroupIds);
}

async function handleDropOnRoot() {
  if (!draggedGroupId.value) {
    return;
  }

  const sourceGroupId = draggedGroupId.value;
  draggedGroupId.value = null;
  dropTargetGroupId.value = null;
  resetRootDropZoneState();

  await moveGroup(sourceGroupId, []);
}

async function handleDetachGroupFromParent(
  groupId: string,
  parentGroupId: string | null,
) {
  if (!parentGroupId) {
    return;
  }

  const currentParentGroupIds = parentGroupIdsById.value.get(groupId) ?? [];
  const nextParentGroupIds = currentParentGroupIds.filter(
    (existingParentGroupId) => existingParentGroupId !== parentGroupId,
  );

  await moveGroup(groupId, nextParentGroupIds);
}

function openReparentGroupModal(
  groupId: string,
  currentParentGroupId: string | null,
) {
  reparentSourceGroupId.value = groupId;
  reparentSourceParentGroupId.value = currentParentGroupId;
  reparentTargetParentGroupId.value = null;
  reparentParentSearch.value = "";
  isReparentModalOpen.value = true;
}

function closeReparentGroupModal() {
  isReparentModalOpen.value = false;
  reparentSourceGroupId.value = null;
  reparentSourceParentGroupId.value = null;
  reparentTargetParentGroupId.value = null;
  reparentParentSearch.value = "";
}

async function confirmReparentGroup() {
  const sourceGroupId = reparentSourceGroupId.value;
  const targetParentGroupId = reparentTargetParentGroupId.value;

  if (!sourceGroupId || !targetParentGroupId || isReparentingGroup.value) {
    return;
  }

  const currentParentGroupIds =
    parentGroupIdsById.value.get(sourceGroupId) ?? [];
  const nextParentGroupIds = currentParentGroupIds.filter(
    (parentGroupId) => parentGroupId !== reparentSourceParentGroupId.value,
  );

  if (!nextParentGroupIds.includes(targetParentGroupId)) {
    nextParentGroupIds.push(targetParentGroupId);
  }

  isReparentingGroup.value = true;

  try {
    await moveGroup(sourceGroupId, nextParentGroupIds);
    closeReparentGroupModal();
  } finally {
    isReparentingGroup.value = false;
  }
}
</script>

<template>
  <section class="space-y-6">
    <UBreadcrumb :items="breadcrumbItems" class="text-slate-500" />

    <UModal
      :open="isReparentModalOpen"
      :ui="{ content: 'sm:max-w-2xl' }"
      @update:open="isReparentModalOpen = $event"
    >
      <template #content>
        <div class="rounded-3xl bg-white p-6 shadow-xl">
          <div class="flex items-start justify-between gap-4">
            <div class="space-y-1">
              <h2 class="text-xl font-semibold text-slate-900">
                Choisir un nouveau parent
              </h2>
              <p class="text-sm text-slate-500">
                Le groupe sera retiré uniquement du parent courant, puis
                ajouté à ce nouveau parent.
              </p>
            </div>

            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              @click="closeReparentGroupModal"
            />
          </div>

          <div class="mt-5 space-y-4">
            <UInput
              v-model="reparentParentSearch"
              icon="i-lucide-search"
              placeholder="Rechercher un parent..."
            />

            <div class="max-h-[26rem] overflow-y-auto pr-1">
              <div class="grid gap-2">
                <button
                  v-for="group in reparentableGroups"
                  :key="group.id"
                  type="button"
                  class="rounded-2xl border px-4 py-3 text-left transition"
                  :class="
                    reparentTargetParentGroupId === group.id
                      ? 'border-sky-300 bg-sky-50 ring-4 ring-sky-100'
                      : 'border-slate-200 bg-slate-50 hover:border-sky-200 hover:bg-sky-50'
                  "
                  @click="reparentTargetParentGroupId = group.id"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <p class="truncate font-medium text-slate-900">
                        {{ group.name }}
                      </p>
                      <p
                        v-if="group.description"
                        class="truncate text-xs text-slate-500"
                      >
                        {{ group.description }}
                      </p>
                    </div>

                    <UBadge color="neutral" variant="soft">
                      {{
                        group.primaryKeyword
                          ? group.primaryKeyword
                          : "Sans mot-clé principal"
                      }}
                    </UBadge>
                  </div>
                </button>

                <div
                  v-if="!reparentableGroups.length"
                  class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500"
                >
                  Aucun parent compatible trouvé.
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <UButton
                color="neutral"
                variant="soft"
                @click="closeReparentGroupModal"
              >
                Annuler
              </UButton>
              <UButton
                color="primary"
                icon="i-lucide-folder-input"
                :loading="isReparentingGroup"
                :disabled="!reparentTargetParentGroupId"
                @click="confirmReparentGroup"
              >
                Déplacer le groupe
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- <header class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900">
        Regrouper les mots-clés
      </h1>
      <p class="text-sm text-slate-500">
        Transformez un groupe de mots-clés en `SeoCluster` quand son contour est
        suffisamment clair.
      </p>
    </header> -->

    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex gap-3">
        <UInput
          v-model="groupTreeFilter"
          icon="i-lucide-search"
          size="sm"
          class="w-full md:w-80"
          placeholder="Filtrer les cards..."
        />
        <div class="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm">
          <USwitch v-model="onlyFavorites" color="primary" />
          <div class="space-y-0.5">
            <p class="text-sm font-medium text-slate-900">
              Favoris uniquement
            </p>
            <p class="text-xs text-slate-500">
              Affiche les groupes favoris et leurs ascendants.
            </p>
          </div>
        </div>
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-copy"
          :disabled="!rootGroups.length"
          @click="copyKeywordGroupTreeToClipboard"
        >
          Copier l’arbre
        </UButton>
        <div class="hidden items-center gap-3 md:flex">
          <div
            class="inline-flex overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-1 shadow-sm"
          >
            <button
              type="button"
              class="min-w-28 rounded-xl px-4 py-2 text-sm font-medium transition"
              :class="
                displayMode === 'vertical'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              "
              @click="displayMode = 'vertical'"
            >
              Arbre horizontal
            </button>
            <button
              type="button"
              class="min-w-24 rounded-xl px-4 py-2 text-sm font-medium transition"
              :class="
                displayMode === 'compact'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              "
              @click="displayMode = 'compact'"
            >
              Arbre vertical
            </button>
          </div>

          <div
            class="inline-flex overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-1 shadow-sm"
          >
            <button
              v-for="depth in accordionDepthOptions"
              :key="depth"
              type="button"
              class="min-w-14 rounded-xl px-4 py-2 text-sm font-medium transition"
              :class="
                accordionDepth === depth
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              "
              @click="accordionDepth = depth"
            >
              N{{ depth }}
            </button>
          </div>
        </div>
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-rotate-ccw"
          :loading="isRefreshingGroups"
          @click="handleRefresh"
        >
          <!-- Rafraîchir -->
        </UButton>
      </div>

      <p v-if="isInitialLoading" class="mt-5 text-sm text-slate-500">
        Chargement des groupes...
      </p>

      <FeedbackRichMessage
        v-else-if="shouldShowErrorState"
        tone="error"
        class="mt-5"
        title="Impossible de charger les groupes"
        description="Les groupes de mots-clés n'ont pas pu être récupérés."
        action-label="Réessayer"
        @action="refresh"
      />

      <div
        v-else-if="!groupTree.length"
        class="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500"
      >
        Aucun groupe disponible pour le moment.
      </div>

      <div
        v-else
        ref="treeScrollContainer"
        class="mt-5 max-h-[60rem] space-y-3 overflow-x-auto overflow-y-auto overscroll-contain pr-1"
        @dragover.prevent="handleTreeDragOver"
      >
        <div
          class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
        >
          Mode d’affichage :
          <span class="font-medium text-slate-900">
            {{
              displayMode === "vertical"
                ? "Arbre vertical du haut vers le bas"
                : "Affichage compact"
            }}
          </span>
        </div>

        <div
          v-if="groupTreeFilter.trim()"
          class="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700"
        >
          Filtre actif pour
          <span class="font-medium">{{ groupTreeFilter }}</span
          >. Les ascendants nécessaires sont affichés automatiquement.
        </div>

        <div
          v-if="onlyFavorites"
          class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
        >
          Filtre favori actif. Les ascendants nécessaires sont affichés
          automatiquement.
        </div>

        <div
          v-if="(groupTreeFilter.trim() || onlyFavorites) && !rootGroups.length"
          class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500"
        >
          Aucun groupe ne correspond à ce filtre.
        </div>

        <!-- <div
          v-if="isRefreshingGroups && hasLoadedGroups"
          class="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700"
        >
          Mise à jour des relations en cours...
        </div> -->

        <!-- <div
          class="sticky top-0 z-20 rounded-2xl border border-dashed px-4 py-4 backdrop-blur transition"
          :class="
            isRootDropZoneActive
              ? 'border-sky-300 bg-sky-50/95 ring-4 ring-sky-100'
              : 'border-slate-200 bg-white/95'
          "
          @dragenter.stop.prevent="handleRootDragEnter"
          @dragover.prevent="isRootDropZoneActive = true"
          @dragleave.stop.prevent="handleRootDragLeave"
          @drop.stop.prevent="handleDropOnRoot"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="space-y-1">
              <p class="text-sm font-medium text-slate-900">
                Dépose ici un groupe pour le remettre à la racine
              </p>
              <p class="text-xs text-slate-500">
                Les groupes racine sont les niveaux les plus hauts de
                l’arborescence.
              </p>
            </div>

            <UBadge color="neutral" variant="soft">
              {{ rootGroups.length }}
            </UBadge>
          </div>
        </div> -->

        <template v-if="!groupTreeFilter.trim() || rootGroups.length">
          <div
            :class="
              displayMode === 'vertical'
                ? 'flex min-w-max flex-nowrap items-start gap-4'
                : 'space-y-32'
            "
          >
            <div
              v-for="group in rootGroups"
              :key="group.id"
              :class="displayMode === 'vertical' ? 'shrink-0' : ''"
            >
              <KeywordGroupTreeNode
                :node="group"
                :level="1"
                :dragged-group-id="draggedGroupId"
                :drop-target-group-id="dropTargetGroupId"
                :converting-group-id="convertingGroupId"
                :updating-favorite-group-id="updatingFavoriteGroupId"
                :display-mode="displayMode"
                :forced-expanded-depth="
                  groupTreeFilter.trim() ? null : accordionDepth
                "
                @drag-start="handleDragStart"
                @drag-end="handleDragEnd"
                @drag-over="handleTreeDragOver"
                @drag-enter-group="handleDragEnterGroup"
                @drag-leave-group="handleDragLeaveGroup"
                @drop-group="handleDropOnGroup"
                @toggle-favorite="toggleGroupFavorite"
                @detach-group="handleDetachGroupFromParent"
                @move-group="openReparentGroupModal"
                @convert-to-cluster="handleConvertGroup"
              />
            </div>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
