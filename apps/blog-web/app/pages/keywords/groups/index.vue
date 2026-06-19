<script setup lang="ts">
import { normalizeSearchText } from "~/utils/search-normalizer";

const {
  createKeywordGroup,
  deleteKeywordGroup,
  formKeywordGroupsWithAi,
  listKeywordGroups,
  listKeywords,
  updateKeywordGroup,
} = useKeywords();
const { showErrorToast, showSuccessToast, showWarningToast } = useAppToast();

const { data: keywords, refresh: refreshKeywords } = await useAsyncData(
  "keywords:organize:list",
  () => listKeywords(),
);
const { data: groups, refresh: refreshGroups } = await useAsyncData(
  "keywords:organize:groups",
  () => listKeywordGroups(),
);

const defaultGroupDescription =
  "Page qui répond à l'intention de recherche :\n";
const groupName = ref("");
const groupDescription = ref(defaultGroupDescription);
const groupKeywordSearch = ref("");
const groupSearch = ref("");
const isSortingUngroupedKeywordsByVolume = ref(false);
const selectedKeywordIds = ref<string[]>([]);
const selectedPrimaryKeywordId = ref("");
const activeGroupId = ref<string | null>(null);
const activeGroupName = ref("");
const activeGroupDescription = ref("");
const activeGroupPrimaryKeywordId = ref("");
const isSavingGroup = ref(false);
const isSavingActiveGroupName = ref(false);
const isSavingActiveGroupDescription = ref(false);
const isDeletingActiveGroup = ref(false);
const draggedKeywordId = ref<string | null>(null);
const isSelectionDropZoneActive = ref(false);
const selectionDropZoneDepth = ref(0);
const activeGroupDropTargetId = ref<string | null>(null);
const groupDropZoneDepth = ref<Record<string, number>>({});
const breadcrumbItems = [
  {
    label: "Mots-clés",
    to: "/keywords/list",
  },
  {
    label: "Regrouper par mots-clés",
  },
];

const ungroupedKeywords = computed(() =>
  (keywords.value ?? [])
    .filter((keyword) => !keyword.keywordGroup?.id),
);

const filteredUngroupedKeywords = computed(() => {
  const search = normalizeSearchText(groupKeywordSearch.value);
  const filtered = !search
    ? [...ungroupedKeywords.value]
    : ungroupedKeywords.value.filter((keyword) =>
        normalizeSearchText(keyword.keyword).includes(search),
      );

  if (isSortingUngroupedKeywordsByVolume.value) {
    return filtered.sort((left, right) => {
      const leftVolume = left.volume ?? 0;
      const rightVolume = right.volume ?? 0;

      if (rightVolume !== leftVolume) {
        return rightVolume - leftVolume;
      }

      return left.keyword.localeCompare(right.keyword);
    });
  }

  return filtered.sort((left, right) =>
    left.keyword.localeCompare(right.keyword),
  );
});
const selectedUngroupedKeywords = computed(() =>
  ungroupedKeywords.value.filter((keyword) =>
    selectedKeywordIds.value.includes(keyword.id),
  ),
);
const hasSelectedKeywords = computed(
  () => selectedKeywordIds.value.length > 0,
);
const canCreateGroup = computed(() => {
  if (!groupName.value.trim()) {
    return false;
  }

  if (!hasSelectedKeywords.value) {
    return true;
  }

  return Boolean(selectedPrimaryKeywordId.value);
});

const activeGroup = computed(
  () =>
    (groups.value ?? []).find((group) => group.id === activeGroupId.value) ??
    null,
);
const activeGroupKeywordChecklist = computed(() => {
  const currentGroupKeywordIds = new Set(
    activeGroup.value?.keywords.map((keyword) => keyword.id) ?? [],
  );

  return [...(keywords.value ?? [])].sort((left, right) => {
    const leftInGroup = currentGroupKeywordIds.has(left.id);
    const rightInGroup = currentGroupKeywordIds.has(right.id);

    if (leftInGroup !== rightInGroup) {
      return leftInGroup ? -1 : 1;
    }

    return left.keyword.localeCompare(right.keyword);
  });
});
const filteredGroups = computed(() => {
  const search = normalizeSearchText(groupSearch.value);

  if (!search) {
    return groups.value ?? [];
  }

  return (groups.value ?? []).filter((group) =>
    [
      group.name,
      group.description ?? "",
      group.primaryKeyword ?? "",
      ...group.keywords.map((keyword) => keyword.keyword),
    ]
      .join(" ")
      .includes(search),
  );
});
const hasUngroupedKeywords = computed(() => ungroupedKeywords.value.length > 0);

watch(
  activeGroup,
  (group) => {
    if (!group) {
      activeGroupName.value = "";
      activeGroupDescription.value = "";
      activeGroupPrimaryKeywordId.value = "";
      return;
    }

    activeGroupName.value = group.name;
    activeGroupDescription.value = group.description ?? "";
    activeGroupPrimaryKeywordId.value =
      group.keywords.find(
        (keyword) =>
          normalizeSearchText(keyword.keyword) ===
          normalizeSearchText(group.primaryKeyword ?? ""),
      )
        ?.id ??
      group.keywords[0]?.id ??
      "";
  },
  { immediate: true },
);

function getKeywordVolumeToneClass(volume?: number | null) {
  if (volume === null || volume === undefined) {
    return "border-orange-200 bg-orange-50 text-orange-900 hover:border-orange-300 hover:bg-orange-100";
  }

  if (volume <= 10) {
    return "border-orange-200 bg-orange-50 text-orange-900 hover:border-orange-300 hover:bg-orange-100";
  }

  if (volume <= 50) {
    return "border-orange-200 bg-orange-100 text-orange-950 hover:border-orange-300 hover:bg-orange-200";
  }

  if (volume <= 100) {
    return "border-orange-300 bg-orange-200 text-orange-950 hover:border-orange-400 hover:bg-orange-300";
  }

  if (volume <= 300) {
    return "border-orange-400 bg-orange-300 text-orange-950 hover:border-orange-500 hover:bg-orange-400";
  }

  if (volume <= 1000) {
    return "border-rose-300 bg-rose-200 text-rose-950 hover:border-rose-400 hover:bg-rose-300";
  }

  return "border-red-400 bg-red-300 text-red-950 hover:border-red-500 hover:bg-red-400";
}

watch(
  selectedKeywordIds,
  () => {
    if (!selectedKeywordIds.value.length) {
      selectedPrimaryKeywordId.value = "";
      return;
    }

    if (
      !selectedPrimaryKeywordId.value ||
      !selectedKeywordIds.value.includes(selectedPrimaryKeywordId.value)
    ) {
      selectedPrimaryKeywordId.value = selectedKeywordIds.value[0] ?? "";
    }
  },
  { immediate: true },
);

async function refreshAll() {
  await Promise.all([refreshKeywords(), refreshGroups()]);
}

function addKeywordToSelection(keywordId: string) {
  if (selectedKeywordIds.value.includes(keywordId)) {
    return;
  }

  selectedKeywordIds.value = [...selectedKeywordIds.value, keywordId];
}

function removeKeywordFromSelection(keywordId: string) {
  selectedKeywordIds.value = selectedKeywordIds.value.filter(
    (id) => id !== keywordId,
  );
}

function handleKeywordDragStart(keywordId: string) {
  draggedKeywordId.value = keywordId;
}

function handleKeywordDragEnd() {
  draggedKeywordId.value = null;
  resetGroupDropZoneState();
  resetSelectionDropZoneState();
}

function handleSelectionDropZoneDragEnter() {
  if (!draggedKeywordId.value) {
    return;
  }

  selectionDropZoneDepth.value += 1;
  isSelectionDropZoneActive.value = true;
}

function handleSelectionDropZoneDragLeave() {
  selectionDropZoneDepth.value = Math.max(0, selectionDropZoneDepth.value - 1);

  if (!selectionDropZoneDepth.value) {
    isSelectionDropZoneActive.value = false;
  }
}

function resetSelectionDropZoneState() {
  selectionDropZoneDepth.value = 0;
  isSelectionDropZoneActive.value = false;
}

function handleSelectionDropZoneDrop() {
  if (draggedKeywordId.value) {
    addKeywordToSelection(draggedKeywordId.value);
  }

  draggedKeywordId.value = null;
  resetSelectionDropZoneState();
}

function handleGroupDropZoneDragEnter(groupId: string) {
  if (!draggedKeywordId.value) {
    return;
  }

  groupDropZoneDepth.value = {
    ...groupDropZoneDepth.value,
    [groupId]: (groupDropZoneDepth.value[groupId] ?? 0) + 1,
  };
  activeGroupDropTargetId.value = groupId;
}

function handleGroupDropZoneDragLeave(groupId: string) {
  const nextDepth = Math.max(0, (groupDropZoneDepth.value[groupId] ?? 0) - 1);

  groupDropZoneDepth.value = {
    ...groupDropZoneDepth.value,
    [groupId]: nextDepth,
  };

  if (nextDepth === 0 && activeGroupDropTargetId.value === groupId) {
    activeGroupDropTargetId.value = null;
  }
}

function resetGroupDropZoneState() {
  groupDropZoneDepth.value = {};
  activeGroupDropTargetId.value = null;
}

async function handleGroupDropZoneDrop(groupId: string) {
  const keywordId = draggedKeywordId.value;

  draggedKeywordId.value = null;
  resetGroupDropZoneState();

  if (!keywordId) {
    return;
  }

  await toggleKeywordInGroup(groupId, keywordId);
}

async function handleCreateGroup() {
  if (isSavingGroup.value || !groupName.value.trim()) {
    return;
  }

  if (hasSelectedKeywords.value && !selectedPrimaryKeywordId.value) {
    showWarningToast(
      "Mot-clé principal manquant",
      "Sélectionne un mot-clé principal avant de créer le groupe.",
    );
    return;
  }

  if (!hasSelectedKeywords.value) {
    const shouldCreateEmptyGroup = window.confirm(
      [
        "Créer un groupe sans mot-clé ?",
        "Le groupe sera créé vide, puis tu pourras y ajouter des mots-clés plus tard.",
      ].join("\n\n"),
    );

    if (!shouldCreateEmptyGroup) {
      return;
    }
  }

  isSavingGroup.value = true;

  try {
    await createKeywordGroup({
      name: groupName.value,
      description: groupDescription.value.trim() || null,
      keywordIds: selectedKeywordIds.value,
      primaryKeyword:
        selectedUngroupedKeywords.value.find(
          (keyword) => keyword.id === selectedPrimaryKeywordId.value,
        )?.keyword ?? null,
    });
    groupName.value = "";
    groupDescription.value = defaultGroupDescription;
    groupKeywordSearch.value = "";
    selectedKeywordIds.value = [];
    selectedPrimaryKeywordId.value = "";
    draggedKeywordId.value = null;
    resetSelectionDropZoneState();
    resetGroupDropZoneState();
    await refreshAll();
  } finally {
    isSavingGroup.value = false;
  }
}

const isGroupingWithAi = ref(false);

async function handleFormGroupsWithAi() {
  if (isGroupingWithAi.value) {
    return;
  }

  if (!hasUngroupedKeywords.value) {
    showWarningToast(
      "Aucun mot-clé à regrouper",
      "Il faut au moins un mot-clé non groupé pour lancer l’IA.",
    );
    return;
  }

  isGroupingWithAi.value = true;

  try {
    const result = await formKeywordGroupsWithAi();
    await refreshAll();
    showSuccessToast(
      "Groupes formés avec l’IA",
      `${result.createdGroups} groupe(s) créé(s), ${result.updatedGroups} mis à jour.`,
    );
  } catch (error) {
    showErrorToast(
      "Impossible de former les groupes",
      error instanceof Error
        ? error.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    isGroupingWithAi.value = false;
  }
}

async function toggleKeywordInGroup(groupId: string, keywordId: string) {
  const group = (groups.value ?? []).find((item) => item.id === groupId);

  if (!group) {
    return;
  }

  const nextKeywordIds = new Set(group.keywords.map((keyword) => keyword.id));

  if (nextKeywordIds.has(keywordId)) {
    nextKeywordIds.delete(keywordId);
  } else {
    nextKeywordIds.add(keywordId);
  }

  const nextKeywordRecords = group.keywords.filter((keyword) =>
    nextKeywordIds.has(keyword.id),
  );
  const currentPrimaryKeyword = group.keywords.find(
    (keyword) => keyword.keyword === group.primaryKeyword,
  );
  const nextPrimaryKeyword =
    (currentPrimaryKeyword && nextKeywordIds.has(currentPrimaryKeyword.id)
      ? currentPrimaryKeyword.keyword
      : nextKeywordRecords[0]?.keyword) ?? null;

  await updateKeywordGroup(groupId, {
    keywordIds: [...nextKeywordIds],
    primaryKeyword: nextPrimaryKeyword,
  });
  await refreshAll();
}

function openGroupKeywordsModal(groupId: string) {
  activeGroupId.value = groupId;
}

async function updateActiveGroupPrimaryKeyword(keywordId: string) {
  const group = activeGroup.value;

  if (!group) {
    return;
  }

  activeGroupPrimaryKeywordId.value = keywordId;

  await updateKeywordGroup(group.id, {
    keywordIds: group.keywords.map((keyword) => keyword.id),
    primaryKeyword:
      group.keywords.find((keyword) => keyword.id === keywordId)?.keyword ??
      null,
  });
  await refreshAll();
}

async function saveActiveGroupName() {
  const group = activeGroup.value;

  if (!group || isSavingActiveGroupName.value) {
    return;
  }

  const trimmedName = activeGroupName.value.trim();

  if (!trimmedName) {
    showWarningToast(
      "Nom de groupe manquant",
      "Le nom du groupe ne peut pas être vide.",
    );
    activeGroupName.value = group.name;
    return;
  }

  if (trimmedName === group.name) {
    return;
  }

  isSavingActiveGroupName.value = true;

  try {
    await updateKeywordGroup(group.id, {
      name: trimmedName,
    });
    activeGroupName.value = trimmedName;
    await refreshAll();
    showSuccessToast("Groupe renommé", "Le nom du groupe a été mis à jour.");
  } catch (error) {
    activeGroupName.value = group.name;
    showErrorToast(
      "Impossible de renommer le groupe",
      error instanceof Error ? error.message : "Une erreur est survenue.",
    );
  } finally {
    isSavingActiveGroupName.value = false;
  }
}

async function saveActiveGroupDescription() {
  const group = activeGroup.value;

  if (!group || isSavingActiveGroupDescription.value) {
    return;
  }

  const trimmedDescription = activeGroupDescription.value.trim();
  const nextDescription =
    trimmedDescription.length > 0 ? trimmedDescription : null;

  if (nextDescription === (group.description ?? null)) {
    return;
  }

  isSavingActiveGroupDescription.value = true;

  try {
    await updateKeywordGroup(group.id, {
      description: nextDescription,
    });
    activeGroupDescription.value = nextDescription ?? "";
    await refreshAll();
    showSuccessToast(
      "Description mise à jour",
      "La description du groupe a été enregistrée.",
    );
  } catch (error) {
    activeGroupDescription.value = group.description ?? "";
    showErrorToast(
      "Impossible de mettre à jour la description",
      error instanceof Error ? error.message : "Une erreur est survenue.",
    );
  } finally {
    isSavingActiveGroupDescription.value = false;
  }
}

async function deleteActiveGroup() {
  const group = activeGroup.value;

  if (!group || isDeletingActiveGroup.value) {
    return;
  }

  const confirmed = window.confirm(
    `Supprimer le groupe "${group.name}" ? Les mots-clés resteront en base, mais ne seront plus rattachés à ce groupe.`,
  );

  if (!confirmed) {
    return;
  }

  isDeletingActiveGroup.value = true;

  try {
    await deleteKeywordGroup(group.id);
    activeGroupId.value = null;
    await refreshAll();
    showSuccessToast(
      "Groupe supprimé",
      "Le groupe a été supprimé et ses mots-clés ont été conservés.",
    );
  } catch (error) {
    showErrorToast(
      "Impossible de supprimer le groupe",
      error instanceof Error ? error.message : "Une erreur est survenue.",
    );
  } finally {
    isDeletingActiveGroup.value = false;
  }
}
</script>

<template>
  <section class="space-y-6">
    <UBreadcrumb :items="breadcrumbItems" class="text-slate-500" />

    <UModal
      :open="!!activeGroup"
      :ui="{ content: 'sm:max-w-4xl' }"
      @update:open="activeGroupId = $event ? activeGroupId : null"
    >
      <template #content>
        <div v-if="activeGroup" class="rounded-3xl bg-white p-6 shadow-xl">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0 flex-1 space-y-2">
              <div class="space-y-1">
                <label
                  class="block text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                  Nom du groupe
                </label>
                <UInput
                  v-model="activeGroupName"
                  size="lg"
                  icon="i-lucide-folder-pen"
                  class="w-full"
                  @keydown.enter.prevent="saveActiveGroupName"
                />
              </div>

              <p v-if="activeGroup.description" class="text-sm text-slate-500">
                {{ activeGroup.description }}
              </p>
              <p v-else class="text-sm text-slate-500">
                Ajoutez ou retirez des mots-clés de ce groupe.
              </p>
            </div>

              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-x"
                @click="activeGroupId = null"
              />
            </div>

            <div class="mt-3 flex justify-end">
              <UButton
                icon="i-lucide-save"
                :loading="isSavingActiveGroupName"
                :disabled="!activeGroupName.trim()"
                @click="saveActiveGroupName"
              >
                Enregistrer le nom
              </UButton>
            </div>

          <div class="mt-5 space-y-4">
            <div class="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <label
                class="block text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                Description du groupe
              </label>

              <textarea
                v-model="activeGroupDescription"
                rows="4"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                placeholder="Décris l'angle, le rôle ou le périmètre de ce groupe..."
              />

              <div class="flex justify-end">
                <UButton
                  icon="i-lucide-save"
                  variant="soft"
                  :loading="isSavingActiveGroupDescription"
                  @click="saveActiveGroupDescription"
                >
                  Enregistrer la description
                </UButton>
              </div>
            </div>

            <div
              class="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
            >
              <label
                class="block text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                Mot-clé principal
              </label>

              <select
                v-model="activeGroupPrimaryKeywordId"
                :disabled="!activeGroup.keywords.length"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                @change="updateActiveGroupPrimaryKeyword(activeGroupPrimaryKeywordId)"
              >
                <option value="">
                  {{
                    activeGroup.keywords.length
                      ? "Choisir un mot-clé principal"
                      : "Aucun mot-clé dans ce groupe"
                  }}
                </option>
                <option
                  v-for="keyword in activeGroup.keywords"
                  :key="keyword.id"
                  :value="keyword.id"
                >
                  {{ keyword.keyword }}
                </option>
              </select>

              <p class="text-xs text-slate-500">
                Ce mot-clé sera utilisé comme mot-clé principal du groupe.
              </p>
            </div>

            <div class="max-h-[28rem] overflow-y-auto pr-1">
              <div class="grid gap-2 md:grid-cols-2">
                <label
                  v-for="keyword in activeGroupKeywordChecklist"
                  :key="keyword.id"
                  class="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700"
                >
                  <input
                    :checked="
                      activeGroup.keywords.some((item) => item.id === keyword.id)
                    "
                    type="checkbox"
                    class="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    @change="toggleKeywordInGroup(activeGroup.id, keyword.id)"
                  />
                  <span>{{ keyword.keyword }}</span>
                </label>
              </div>
            </div>

            <div class="mt-6 flex justify-end border-t border-slate-200 pt-4">
              <UButton
                color="error"
                variant="soft"
                icon="i-lucide-trash-2"
                :loading="isDeletingActiveGroup"
                @click="deleteActiveGroup"
              >
                Supprimer le groupe
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- <header class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900">
        Organiser les mots-clés
      </h1>
      <p class="text-sm text-slate-500">
        Créez des groupes de mots-clés avec un nom et une description, puis
        regroupez-les pour les transformer ensuite en clusters.
      </p>
    </header> -->

    <div class="grid gap-6 xl:grid-cols-2">
      <aside class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="space-y-4">
          <div class="space-y-1">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-lg font-semibold text-slate-900">
                Nouveau groupe
              </h2>

              <UBadge color="neutral" variant="soft">
                {{ filteredUngroupedKeywords.length }}
              </UBadge>
            </div>
            <p class="text-sm text-slate-500">
              La liste des mots-clés est à gauche, et le formulaire du groupe
              avec la zone de dépôt à droite.
            </p>
          </div>

          <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
              <div class="space-y-3">
                <div class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div class="space-y-0.5">
                    <p class="text-sm font-medium text-slate-900">
                      Tri des mots-clés
                    </p>
                    <p class="text-xs text-slate-500">
                      {{
                        isSortingUngroupedKeywordsByVolume
                          ? "Classés par volume décroissant"
                        : "Classés par ordre alphabétique"
                    }}
                  </p>
                </div>

                <USwitch
                  v-model="isSortingUngroupedKeywordsByVolume"
                  color="primary"
                />
              </div>

              <input
                v-model="groupKeywordSearch"
                type="text"
                placeholder="Filtrer les mots-clés non groupés..."
                class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              />

              <div class="max-h-[36rem] space-y-2 overflow-y-auto pr-1">
                <div class="flex items-center justify-between px-1">
                  <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Mots-clés non groupés
                  </p>

                  <p class="text-xs text-slate-500">
                    {{ filteredUngroupedKeywords.length }} mot(s)-clé(s)
                  </p>
                </div>

                <label
                  v-for="keyword in filteredUngroupedKeywords"
                  :key="keyword.id"
                  class="flex cursor-grab items-start gap-3 rounded-2xl border px-3 py-3 text-sm transition active:cursor-grabbing"
                  :class="getKeywordVolumeToneClass(keyword.volume)"
                  draggable="true"
                  @dragstart="handleKeywordDragStart(keyword.id)"
                  @dragend="handleKeywordDragEnd"
                >
                  <input
                    v-model="selectedKeywordIds"
                    :value="keyword.id"
                    type="checkbox"
                    class="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <div class="min-w-0 space-y-1">
                    <span class="block">{{ keyword.keyword }}</span>
                    <span
                      v-if="keyword.searchIntentDescription"
                      class="block text-xs leading-5 text-slate-500"
                    >
                      {{ keyword.searchIntentDescription }}
                    </span>
                  </div>
                </label>

                <p
                  v-if="!filteredUngroupedKeywords.length"
                  class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500"
                >
                  Aucun mot-clé non groupé ne correspond à ce filtre.
                </p>
              </div>
            </div>

            <div class="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <input
                v-model="groupName"
                type="text"
                placeholder="Ex: Audit SEO Shopify"
                class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              />

              <textarea
                v-model="groupDescription"
                rows="4"
                placeholder="Décrivez l’angle éditorial du groupe..."
                class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              />

              <div
                class="rounded-2xl border border-dashed px-4 py-4 transition"
                :class="
                  isSelectionDropZoneActive
                    ? 'border-sky-300 bg-sky-50 ring-4 ring-sky-100'
                    : 'border-slate-200 bg-white'
                "
                @dragenter.prevent="handleSelectionDropZoneDragEnter"
                @dragover.prevent="isSelectionDropZoneActive = true"
                @dragleave.prevent="handleSelectionDropZoneDragLeave"
                @drop.prevent="handleSelectionDropZoneDrop"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="space-y-1">
                    <p class="text-sm font-medium text-slate-900">
                      Glisse les mots-clés ici pour les ajouter au groupe
                    </p>
                    <p class="text-xs text-slate-500">
                      {{ selectedKeywordIds.length }} mot(s)-clé(s) sélectionné(s)
                    </p>
                  </div>

                  <UBadge color="neutral" variant="soft">
                    {{ selectedKeywordIds.length }}
                  </UBadge>
                </div>

                <div
                  v-if="selectedUngroupedKeywords.length"
                  class="mt-3 flex flex-wrap gap-2"
                >
                  <button
                    v-for="keyword in selectedUngroupedKeywords"
                    :key="keyword.id"
                    type="button"
                    class="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1.5 text-sm font-medium text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
                    @click="removeKeywordFromSelection(keyword.id)"
                  >
                    <UIcon name="i-lucide-grip-vertical" class="h-4 w-4" />
                    <span class="max-w-[12rem] truncate">
                      {{ keyword.keyword }}
                    </span>
                    <UIcon name="i-lucide-x" class="h-4 w-4" />
                  </button>
                </div>

                <p v-else class="mt-3 text-sm text-slate-500">
                  Aucun mot-clé sélectionné pour le moment.
                </p>
              </div>

              <div
                v-if="selectedUngroupedKeywords.length"
                class="space-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-3"
              >
                <label
                  class="block text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                  Mot-clé principal
                </label>
                <select
                  v-model="selectedPrimaryKeywordId"
                  class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                >
                  <option
                    v-for="keyword in selectedUngroupedKeywords"
                    :key="keyword.id"
                    :value="keyword.id"
                  >
                    {{ keyword.keyword }}
                  </option>
                </select>
                <p class="text-xs text-slate-500">
                  Ce mot-clé servira de mot-clé principal du groupe.
                </p>
              </div>

              <div class="flex justify-end">
                <UButton
                  icon="i-lucide-folder-plus"
                  :loading="isSavingGroup"
                  :disabled="!canCreateGroup"
                  @click="handleCreateGroup"
                >
                  Créer le groupe
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <section
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-slate-900">
              Groupes existants
            </h2>
            <p class="text-sm text-slate-500">
              Vous pouvez encore ajouter ou retirer des mots-clés avant de les
              transformer en cluster.
            </p>
          </div>

          <div class="flex gap-3">
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-sparkles"
              :loading="isGroupingWithAi"
              :disabled="true || !hasUngroupedKeywords"
              class="whitespace-nowrap"
              @click="handleFormGroupsWithAi"
            >
              Former les groupes avec l’IA
            </UButton>

            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-rotate-ccw"
              @click="refreshAll"
            >
              <!-- Rafraîchir -->
            </UButton>
          </div>
        </div>

        <div
          v-if="!(groups?.length ?? 0)"
          class="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500"
        >
          Aucun groupe pour le moment.
        </div>

        <div v-else class="mt-5 space-y-3">
          <input
            v-model="groupSearch"
            type="text"
            placeholder="Filtrer les groupes existants..."
            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          />
        </div>

        <div class="mt-5 max-h-[42rem] space-y-4 overflow-y-auto pr-1">
          <article
            v-for="group in filteredGroups"
            :key="group.id"
            class="rounded-2xl border p-4 transition"
            :class="
              activeGroupDropTargetId === group.id
                ? 'border-sky-300 bg-sky-50 ring-4 ring-sky-100'
                : 'border-slate-200 bg-slate-50'
            "
            @dragenter.prevent="handleGroupDropZoneDragEnter(group.id)"
            @dragover.prevent="activeGroupDropTargetId = group.id"
            @dragleave.prevent="handleGroupDropZoneDragLeave(group.id)"
            @drop.prevent="handleGroupDropZoneDrop(group.id)"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-base font-semibold text-slate-900">
                    {{ group.name }}
                  </h3>
                  <UBadge
                    v-if="group.primaryKeyword"
                    color="sky"
                    variant="soft"
                  >
                    {{ group.primaryKeyword }}
                  </UBadge>
                  <UBadge
                    v-if="group.seoCluster"
                    color="success"
                    variant="soft"
                  >
                    Déjà clusterisé
                  </UBadge>
                  <UBadge color="neutral" variant="soft">
                    {{ group.keywords.length }} mot(s)-clé(s)
                  </UBadge>
                </div>

                <p
                  v-if="group.description"
                  class="max-w-3xl text-sm text-slate-500"
                >
                  {{ group.description }}
                </p>
              </div>

              <div class="flex flex-col gap-2">
                <UButton
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-folder-open"
                  :to="`/keyword-groups/${group.id}`"
                  class="whitespace-nowrap"
                >
                  Ouvrir le groupe
                </UButton>

                <UButton
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-list-checks"
                  class="whitespace-nowrap"
                  @click="openGroupKeywordsModal(group.id)"
                >
                  Gérer les mots-clés
                </UButton>
              </div>
            </div>

            <!-- <div
              class="mt-4 rounded-2xl border border-dashed px-4 py-4 text-sm transition"
              :class="
                activeGroupDropTargetId === group.id
                  ? 'border-sky-300 bg-white'
                  : 'border-slate-200 bg-white/80'
              "
            >
              <p class="font-medium text-slate-900">
                Dépose un mot-clé ici pour l’ajouter à ce groupe
              </p>
              <p class="mt-1 text-xs text-slate-500">
                {{ group.keywords.length }} mot(s)-clé(s) dans ce groupe.
              </p>
            </div> -->
          </article>

          <p
            v-if="!filteredGroups.length"
            class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500"
          >
            Aucun groupe existant ne correspond à ce filtre.
          </p>
        </div>
      </section>
    </div>
  </section>
</template>
