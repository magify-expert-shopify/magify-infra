<script setup lang="ts">
import { keywordLengthTypeLabels, searchIntentLabels } from "~/constants/enums";
import { pageTypeLabels } from "~/constants/pages";
import type {
  KeywordGroupRecord,
  KeywordPageType,
  KeywordRecord,
} from "~/types/keywords";
import { getKeywordIntentIcon } from "~/utils/keyword-intent";
import { normalizeSearchText } from "~/utils/search-normalizer";

const {
  assignKeywordTemplate,
  assignKeywordGroupTemplate,
  autoAssignKeywordGroupTemplate,
  autoAssignKeywordTemplates,
  listKeywordGroups,
  setKeywordGroupFavorite,
  updateKeywordGroup,
  useKeywordsList,
} = useKeywords();
const { showErrorToast } = useAppToast();
const { data: keywords, status, error, refresh } = await useKeywordsList();
const { data: keywordGroups } = await useAsyncData(
  "keywords:templates:groups",
  () => listKeywordGroups(),
);
const savingKeywordId = ref<string | null>(null);
const savingGroupTemplateId = ref<string | null>(null);
const updatingGroupFavoriteId = ref<string | null>(null);
const detachingKeywordId = ref<string | null>(null);
const autoAssigningTemplates = ref(false);
const keywordFilter = ref("");
const onlyWithoutTemplate = ref(true);
const onlyFavorites = ref(false);
const selectedGroupId = ref("");
const breadcrumbItems = [
  {
    label: "Rédaction",
    to: "/suggestions",
  },
  {
    label: "Templates",
  },
];

const pageTypeOptions = Object.entries(pageTypeLabels).map(
  ([value, label]) => ({
    value: value as KeywordPageType,
    label,
  }),
);

function getKeywordTemplate(keyword: KeywordRecord) {
  return keyword.template ?? keyword.page?.pageType ?? null;
}

const keywordGroupsById = computed(() => {
  const map = new Map<string, KeywordGroupRecord>();

  for (const group of keywordGroups.value ?? []) {
    map.set(group.id, group);
  }

  return map;
});

const keywordGroupChildrenById = computed(() => {
  const map = new Map<string, string[]>();

  for (const group of keywordGroups.value ?? []) {
    map.set(group.id, []);
  }

  for (const group of keywordGroups.value ?? []) {
    for (const parentGroup of group.parentGroups ?? []) {
      const children = map.get(parentGroup.id) ?? [];

      if (!children.includes(group.id)) {
        children.push(group.id);
      }

      map.set(parentGroup.id, children);
    }
  }

  return map;
});

function collectDescendantGroupIds(groupId: string) {
  const visited = new Set<string>();
  const stack = [groupId];

  while (stack.length) {
    const currentGroupId = stack.pop();

    if (!currentGroupId || visited.has(currentGroupId)) {
      continue;
    }

    visited.add(currentGroupId);
    stack.push(...(keywordGroupChildrenById.value.get(currentGroupId) ?? []));
  }

  return visited;
}

function getKeywordGroupDepth(groupId: string) {
  const visited = new Set<string>();
  let currentGroup = keywordGroupsById.value.get(groupId);
  let depth = 0;

  while (currentGroup?.parentGroups?.length && !visited.has(currentGroup.id)) {
    visited.add(currentGroup.id);

    const nextParentId = currentGroup.parentGroups[0]?.id;

    if (!nextParentId) {
      break;
    }

    const nextParent = keywordGroupsById.value.get(nextParentId);

    if (!nextParent) {
      break;
    }

    depth += 1;
    currentGroup = nextParent;
  }

  return depth;
}

const templateGroupOptions = computed(() =>
  (keywordGroups.value ?? [])
    .map((group) => ({
      value: group.id,
      label: `${"› ".repeat(getKeywordGroupDepth(group.id))}${group.name}`,
    }))
    .sort((left, right) =>
      right.label.localeCompare(left.label, "fr", { sensitivity: "base" }),
    ),
);

function mergeUpdatedKeywords(updatedKeywords: KeywordRecord[]) {
  if (!updatedKeywords.length) {
    return false;
  }

  const currentKeywords = keywords.value ?? [];
  const updatedById = new Map(updatedKeywords.map((keyword) => [keyword.id, keyword]));
  const nextKeywords = currentKeywords.map((keyword) =>
    updatedById.get(keyword.id) ?? keyword,
  );

  keywords.value = nextKeywords;
  return true;
}

const filteredKeywords = computed(() => {
  const items = keywords.value ?? [];
  const normalizedFilter = normalizeSearchText(keywordFilter.value);
  const selectedGroup = selectedGroupId.value.trim();
  const selectedGroupDescendantIds = selectedGroup
    ? collectDescendantGroupIds(selectedGroup)
    : null;

  return items.filter((keyword) => {
    const matchesFilter = !normalizedFilter
      ? true
      : [
          keyword.keyword,
          keyword.searchIntentDescription ?? "",
          keyword.searchIntent ? searchIntentLabels[keyword.searchIntent] : "",
          keyword.lengthType ? keywordLengthTypeLabels[keyword.lengthType] : "",
          getKeywordTemplate(keyword) ?? "",
          keyword.page?.url ?? "",
        ]
          .join(" ")
          .includes(normalizedFilter);

    const matchesTemplateFilter = onlyWithoutTemplate.value
      ? !getKeywordTemplate(keyword)
      : true;

    const matchesFavoriteFilter = onlyFavorites.value
      ? keyword.keywordGroup?.isFavorite ?? false
      : true;

    const matchesGroupFilter = selectedGroupDescendantIds
      ? selectedGroupDescendantIds.has(keyword.keywordGroup?.id ?? "")
      : true;

    return (
      matchesFilter &&
      matchesTemplateFilter &&
      matchesFavoriteFilter &&
      matchesGroupFilter
    );
  });
});

type KeywordTemplateGroupSection = {
  id: string;
  name: string;
  description: string;
  anchorId: string;
  keywords: NonNullable<typeof filteredKeywords.value>;
};

const groupedKeywords = computed<KeywordTemplateGroupSection[]>(() => {
  const sections = new Map<string, KeywordTemplateGroupSection>();

  for (const keyword of filteredKeywords.value) {
    const groupId = keyword.keywordGroup?.id ?? "ungrouped";
    const groupName = keyword.keywordGroup?.name ?? "Sans groupe";
    const groupDescription = keyword.keywordGroup?.description ?? "";
    const existingSection = sections.get(groupId);

    if (existingSection) {
      existingSection.keywords.push(keyword);
      continue;
    }

    sections.set(groupId, {
      id: groupId,
      name: groupName,
      description: groupDescription,
      anchorId:
        groupId === "ungrouped" ? "group-ungrouped" : `group-${groupId}`,
      keywords: [keyword],
    });
  }

  return Array.from(sections.values()).sort((left, right) => {
    if (left.id === "ungrouped") {
      return 1;
    }

    if (right.id === "ungrouped") {
      return -1;
    }

    return left.name.localeCompare(right.name, "fr", { sensitivity: "base" });
  });
});

const templateGroupNavigation = computed(() =>
  groupedKeywords.value.map((group) => ({
    id: group.id,
    name: group.name,
    anchorId: group.anchorId,
    count: group.keywords.length,
  })),
);

function scrollToTemplateGroup(anchorId: string) {
  const target = document.getElementById(anchorId);

  if (!target) {
    return;
  }

  target.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

async function handleAutoAssignTemplates() {
  const keywordIds = filteredKeywords.value
    .filter((keyword) => !getKeywordTemplate(keyword))
    .map((keyword) => keyword.id);

  if (!keywordIds.length || autoAssigningTemplates.value) {
    return;
  }

  autoAssigningTemplates.value = true;

  try {
    const result = await autoAssignKeywordTemplates(keywordIds);

    if (!mergeUpdatedKeywords(result.updatedKeywords)) {
      await refresh();
    }
  } finally {
    autoAssigningTemplates.value = false;
  }
}

async function handleAutoAssignGroupTemplates(group: KeywordTemplateGroupSection) {
  if (savingGroupTemplateId.value || !group.keywords.length) {
    return;
  }

  savingGroupTemplateId.value = group.id;

  try {
    const result = await autoAssignKeywordGroupTemplate(group.id);

    if (!mergeUpdatedKeywords(result.updatedKeywords)) {
      await refresh();
    }
  } finally {
    savingGroupTemplateId.value = null;
  }
}

async function toggleGroupFavorite(groupId: string) {
  if (updatingGroupFavoriteId.value) {
    return;
  }

  const group = keywordGroupsById.value.get(groupId);

  if (!group) {
    return;
  }

  updatingGroupFavoriteId.value = groupId;

  try {
    const updatedGroup = await setKeywordGroupFavorite(
      groupId,
      !group.isFavorite,
    );

    if (!mergeUpdatedKeywords(updatedGroup.updatedKeywords ?? [])) {
      await refresh();
    }

    keywordGroups.value =
      keywordGroups.value?.map((item) =>
        item.id === updatedGroup.id
          ? { ...item, isFavorite: updatedGroup.isFavorite }
          : item,
      ) ?? keywordGroups.value;
  } catch (error) {
    showErrorToast("Impossible de mettre à jour le favori du groupe.", error);
  } finally {
    updatingGroupFavoriteId.value = null;
  }
}

async function handleAssignTemplateToGroup(
  groupId: string,
  pageType: string,
) {
  if (!pageType || savingGroupTemplateId.value) {
    return;
  }

  savingGroupTemplateId.value = groupId;

  try {
    const result = await assignKeywordGroupTemplate(
      groupId,
      pageType as KeywordPageType,
    );

    if (!mergeUpdatedKeywords(result.updatedKeywords)) {
      await refresh();
    }
  } finally {
    savingGroupTemplateId.value = null;
  }
}

async function handleAssignTemplate(keywordId: string, pageType: string) {
  if (!pageType || savingKeywordId.value) {
    return;
  }

  savingKeywordId.value = keywordId;

  try {
    const updatedKeyword = await assignKeywordTemplate(
      keywordId,
      pageType as KeywordPageType,
    );

    if (!mergeUpdatedKeywords([updatedKeyword])) {
      await refresh();
    }
  } finally {
    savingKeywordId.value = null;
  }
}

async function handleDetachKeywordFromGroup(
  group: KeywordTemplateGroupSection,
  keyword: KeywordRecord,
) {
  if (
    group.id === "ungrouped" ||
    detachingKeywordId.value ||
    !keyword.keywordGroup?.id
  ) {
    return;
  }

  if (
    !window.confirm(
      `Retirer "${keyword.keyword}" du groupe "${group.name}" ?`,
    )
  ) {
    return;
  }

  detachingKeywordId.value = keyword.id;

  try {
    const remainingKeywordIds = group.keywords
      .filter((groupKeyword) => groupKeyword.id !== keyword.id)
      .map((groupKeyword) => groupKeyword.id);

    const updatedGroup = await updateKeywordGroup(group.id, {
      keywordIds: remainingKeywordIds,
    });

    if (
      !mergeUpdatedKeywords([
        {
          ...keyword,
          keywordGroup: null,
        },
      ])
    ) {
      await refresh();
    }

    keywordGroups.value =
      keywordGroups.value?.map((item) =>
        item.id === updatedGroup.id
          ? {
              ...item,
              primaryKeyword: updatedGroup.primaryKeyword ?? null,
              keywords: updatedGroup.keywords,
            }
          : item,
      ) ?? keywordGroups.value;
  } finally {
    detachingKeywordId.value = null;
  }
}
</script>

<template>
  <section class="space-y-6">
    <UBreadcrumb :items="breadcrumbItems" class="text-slate-500" />

    <!-- <header class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900">
        Choisir un template
      </h1>
      <p class="text-sm text-slate-500">
        Chaque choix met à jour ou crée la `Page` associée au mot-clé.
      </p>
    </header> -->

    <div class="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <aside class="hidden xl:block">
        <div
          class="sticky top-28 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div class="space-y-1 border-b border-slate-200 pb-4">
            <p
              class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
            >
              Navigation groupes
            </p>
            <p class="text-sm text-slate-500">
              Accès rapide aux groupes de mots-clés.
            </p>
          </div>

          <div class="mt-4 rounded-2xl border border-slate-200 px-3 py-3">
            <div class="flex items-center gap-3">
              <USwitch v-model="onlyWithoutTemplate" color="primary" />
              <div class="space-y-0.5">
                <p class="text-sm font-medium text-slate-900">
                  Sans template uniquement
                </p>
                <p class="text-xs text-slate-500">
                  Affiche uniquement les mots-clés qui n’ont pas encore de
                  template.
                </p>
              </div>
            </div>
          </div>

          <div class="mt-4 rounded-2xl border border-slate-200 px-3 py-3">
            <div class="flex items-center gap-3">
              <USwitch v-model="onlyFavorites" color="primary" />
              <div class="space-y-0.5">
                <p class="text-sm font-medium text-slate-900">
                  Favoris uniquement
                </p>
                <p class="text-xs text-slate-500">
                  Affiche uniquement les mots-clés marqués en favori.
                </p>
              </div>
            </div>
          </div>

          <div class="mt-4 rounded-2xl border border-slate-200 px-3 py-3">
            <div class="space-y-1">
              <p class="text-sm font-medium text-slate-900">
                Filtrer par groupe
              </p>
              <p class="text-xs text-slate-500">
                Affiche le groupe choisi et tous ses descendants.
              </p>
            </div>

            <select
              v-model="selectedGroupId"
              class="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            >
              <option value="">Tous les groupes</option>
              <option
                v-for="group in templateGroupOptions"
                :key="group.value"
                :value="group.value"
              >
                {{ group.label }}
              </option>
            </select>
          </div>

          <nav
            class="mt-4 max-h-[calc(50vh-10rem)] space-y-1 overflow-y-auto pr-1"
          >
            <button
              v-for="group in templateGroupNavigation"
              :key="group.id"
              type="button"
              class="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
              @click="scrollToTemplateGroup(group.anchorId)"
            >
              <span class="min-w-0 truncate font-medium">{{ group.name }}</span>
              <UBadge variant="soft" color="neutral" class="shrink-0">
                {{ group.count }}
              </UBadge>
            </button>
          </nav>
        </div>
      </aside>

      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div
          class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
        >
          <div class="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <UInput
              v-model="keywordFilter"
              icon="i-lucide-search"
              size="lg"
              variant="outline"
              placeholder="Filtrer les mots-clés, le mini scan, le template..."
            />
          </div>

          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-rotate-ccw"
            @click="refresh()"
          >
            <!-- Rafraîchir -->
          </UButton>

          <UButton
            color="primary"
            variant="soft"
            icon="i-lucide-sparkles"
            :loading="autoAssigningTemplates"
            :disabled="
              autoAssigningTemplates ||
              !filteredKeywords.some((keyword) => !keyword.page?.pageType)
            "
            @click="handleAutoAssignTemplates"
          >
            Appliquer auto
          </UButton>
        </div>

        <p v-if="status === 'pending'" class="mt-5 text-sm text-slate-500">
          Chargement des templates...
        </p>

        <FeedbackRichMessage
          v-else-if="error"
          tone="error"
          class="mt-5"
          title="Impossible de charger les mots-clés"
          description="La liste nécessaire pour associer les templates n'a pas pu être chargée."
          action-label="Réessayer"
          @action="refresh"
        />

        <div
          v-else-if="groupedKeywords.length > 0"
          class="mt-5 max-h-[calc(100vh-26rem)] space-y-5 overflow-y-auto"
        >
          <section
            v-for="group in groupedKeywords"
            :id="group.anchorId"
            :key="group.id"
            class="overflow-hidden rounded-2xl border border-slate-200 scroll-mt-28"
          >
            <div
              class="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3"
            >
              <div class="space-y-0.5">
                <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <h2 class="text-sm font-semibold text-slate-900">
                    {{ group.name }}
                  </h2>
                  <span
                    v-if="group.description"
                    class="text-xs font-medium leading-5 text-slate-600"
                  >
                    - {{ group.description }}
                  </span>
                </div>
                <p class="text-xs text-slate-500">
                  {{ group.keywords.length }} mot-clé{{
                    group.keywords.length > 1 ? "s" : ""
                  }}
                </p>
              </div>

              <div class="flex flex-wrap items-center justify-end gap-2">
                <UButton
                  color="neutral"
                  variant="soft"
                  class="group/favorite"
                  :loading="updatingGroupFavoriteId === group.id"
                  :title="
                    group.isFavorite
                      ? 'Retirer des favoris'
                      : 'Ajouter aux favoris'
                  "
                  @click="toggleGroupFavorite(group.id)"
                >
                  <UIcon
                    name="i-lucide-star"
                    class="h-4 w-4 transition"
                    :class="
                      group.isFavorite
                        ? 'fill-amber-500 text-amber-500'
                        : 'text-amber-600/40 opacity-80 group-hover/favorite:text-amber-600 group-hover/favorite:opacity-100'
                    "
                  />
                </UButton>

                <UButton
                  v-if="group.id !== 'ungrouped'"
                  color="primary"
                  variant="soft"
                  icon="i-lucide-sparkles"
                  size="sm"
                  :loading="savingGroupTemplateId === group.id"
                  :disabled="savingGroupTemplateId === group.id || !group.keywords.length"
                  @click="handleAutoAssignGroupTemplates(group)"
                >
                  Auto groupe
                </UButton>

                <select
                  v-if="group.id !== 'ungrouped'"
                  :value="''"
                  class="min-w-44 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  :disabled="savingGroupTemplateId === group.id"
                  @change="
                    handleAssignTemplateToGroup(
                      group.id,
                      ($event.target as HTMLSelectElement).value,
                    )
                  "
                >
                  <option value="">Appliquer au groupe…</option>
                  <option
                    v-for="option in pageTypeOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </div>
            </div>

            <!-- <div class="max-h-[42rem] overflow-auto"> -->
            <table class="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr class="text-left text-slate-500">
                  <th class="px-4 py-3 font-medium">
                    <span class="inline-flex items-center gap-2">
                      <!-- <UIcon name="i-lucide-search" class="h-4 w-4" /> -->
                      Mot-clé
                    </span>
                  </th>
                  <th class="px-4 py-3 font-medium">
                    <span class="inline-flex items-center gap-2">
                      <!-- <UIcon name="i-lucide-sparkles" class="h-4 w-4" /> -->
                      Mini scan IA
                    </span>
                  </th>
                  <th class="px-4 py-3 font-medium">
                    <span class="inline-flex items-center gap-2">
                      <!-- <UIcon name="i-lucide-compass" class="h-4 w-4" /> -->
                      Intent
                    </span>
                  </th>
                  <th class="px-4 py-3 font-medium">
                    <span class="inline-flex items-center gap-2">
                      <!-- <UIcon 
                        name="i-lucide-ruler-dimension-line"
                        class="h-4 w-4"
                      /> -->
                      Longueur
                    </span>
                  </th>
                  <th class="px-4 py-3 font-medium">
                    <span class="inline-flex items-center gap-2">
                      <!-- <UIcon name="i-lucide-file-text" class="h-4 w-4" /> -->
                      Template
                    </span>
                  </th>
                  <th class="whitespace-nowrap px-4 py-3 font-medium">
                    <span class="inline-flex items-center gap-2">
                      <!-- <UIcon name="i-lucide-folder" class="h-4 w-4" /> -->
                      Page liée
                    </span>
                  </th>
                  <th class="whitespace-nowrap px-4 py-3 font-medium">
                    <span class="inline-flex items-center gap-2">
                      <UIcon name="i-lucide-unlink" class="h-4 w-4" />
                      Groupe
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="keyword in group.keywords" :key="keyword.id">
                  <td
                    class="w-64 whitespace-nowrap px-4 py-3 font-medium text-slate-900"
                  >
                    <span class="inline-flex items-center gap-2">
                      <!-- <UIcon
                        name="i-lucide-search"
                        class="h-5 w-5 shrink-0 text-slate-400"
                      /> -->
                      {{ keyword.keyword }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-slate-600">
                    <div class="flex items-start gap-2">
                      <!-- <UIcon
                        name="i-lucide-sparkles"
                        class="mt-0.5 h-5 w-5 shrink-0"
                      /> -->
                      <p
                        class="max-w-md text-sm leading-6 text-slate-600 line-clamp-3"
                      >
                        {{ keyword.searchIntentDescription }}
                      </p>
                    </div>
                  </td>
                  <td class="w-0 px-4 py-3 text-slate-600">
                    <span class="inline-flex items-center gap-2">
                      <UIcon
                        :name="getKeywordIntentIcon(keyword.searchIntent)"
                        class="h-5 w-5 shrink-0"
                      />
                      {{
                        keyword.searchIntent
                          ? searchIntentLabels[keyword.searchIntent]
                          : "-"
                      }}
                    </span>
                  </td>
                  <td class="w-0 px-4 py-3 text-slate-600">
                    <span class="inline-flex items-center gap-2">
                      <UIcon
                        name="i-lucide-ruler-dimension-line"
                        class="h-5 w-5 shrink-0"
                      />
                      {{
                        keyword.lengthType
                          ? keywordLengthTypeLabels[keyword.lengthType]
                          : "-"
                      }}
                    </span>
                  </td>
                  <td class="w-0 px-4 py-3">
                    <div class="flex items-center gap-2">
                      <UIcon
                        name="i-lucide-file-text"
                        class="h-5 w-5 shrink-0"
                      />
                      <select
                        :value="keyword.template || keyword.page?.pageType || ''"
                        class="whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                        @change="
                          handleAssignTemplate(
                            keyword.id,
                            ($event.target as HTMLSelectElement).value,
                          )
                        "
                      >
                        <option value="">Sélectionner</option>
                        <option
                          v-for="option in pageTypeOptions"
                          :key="option.value"
                          :value="option.value"
                        >
                          {{ option.label }}
                        </option>
                      </select>
                    </div>
                  </td>
                  <td class="w-0 px-4 py-3 text-slate-600">
                    <span class="whitespace-nowrap inline-flex items-center gap-2">
                      <span v-if="savingKeywordId === keyword.id"
                        >Mise à jour...</span
                      >
                      <template v-else-if="keyword.page?.url">
                        <UIcon
                          name="i-lucide-folder"
                          class="h-5 w-5 shrink-0"
                        />
                        <NuxtLink
                          :to="
                            keyword.page.pageType === 'BLOG_ARTICLE'
                              ? `/articles/${keyword.page.id}`
                              : keyword.page.url
                          "
                          class="max-w-[20rem] truncate text-sky-600 transition hover:text-sky-700 hover:underline"
                        >
                          {{ keyword.page.title || keyword.page.url }}
                        </NuxtLink>
                      </template>
                      <span v-else>-</span>
                    </span>
                  </td>
                  <td class="w-0 px-4 py-3 text-slate-600">
                    <div class="flex items-center gap-2">
                      <UButton
                        v-if="keyword.keywordGroup?.id"
                        color="neutral"
                        variant="soft"
                        icon="i-lucide-unlink"
                        :loading="detachingKeywordId === keyword.id"
                        :disabled="
                          detachingKeywordId === keyword.id ||
                          group.id === 'ungrouped'
                        "
                        :title="`Retirer ${keyword.keyword} de son groupe`"
                        @click="handleDetachKeywordFromGroup(group, keyword)"
                      >
                        Retirer
                      </UButton>
                      <span v-else>-</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <!-- </div> -->
          </section>
        </div>

        <FeedbackInlineMessage v-else tone="info" class="mt-5">
          Aucun mot-clé ne correspond à votre filtre.
        </FeedbackInlineMessage>
      </div>
    </div>
  </section>
</template>
