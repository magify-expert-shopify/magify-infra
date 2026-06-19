<script setup lang="ts">
import KeywordGroupsTable from "~/components/tables/KeywordGroupsTable.vue";
import { normalizeSearchText } from "~/utils/search-normalizer";

const { deleteKeywordGroup, listKeywordGroups, setKeywordGroupFavorite } =
  useKeywords();
const { showErrorToast, showSuccessToast } = useAppToast();

const {
  data: groups,
  status,
  error,
  refresh,
} = await useAsyncData("keyword-groups:index", () => listKeywordGroups());

const groupSearch = ref("");
const updatingFavoriteIds = ref<string[]>([]);
const deletingGroupIds = ref<string[]>([]);
const breadcrumbItems = [
  {
    label: "Mots-clés",
    to: "/keywords/list",
  },
  {
    label: "Groupes de mots-clés",
  },
];

const filteredGroups = computed(() => {
  const search = normalizeSearchText(groupSearch.value);
  const availableGroups = Array.isArray(groups.value)
    ? groups.value.filter((group) => (group.keywords?.length ?? 0) > 0)
    : [];

  if (!search) {
    return availableGroups;
  }

  return availableGroups.filter((group) =>
    normalizeSearchText(
      [
        group.name,
        group.description ?? "",
        group.primaryKeyword ?? "",
        ...(group.keywords?.map((keyword) => keyword.keyword) ?? []),
      ].join(" "),
    ).includes(search),
  );
});

function isUpdatingFavorite(groupId: string) {
  return updatingFavoriteIds.value.includes(groupId);
}

function isDeletingGroup(groupId: string) {
  return deletingGroupIds.value.includes(groupId);
}

async function toggleGroupFavorite(groupId: string, nextIsFavorite: boolean) {
  if (isUpdatingFavorite(groupId)) {
    return;
  }

  updatingFavoriteIds.value = [...updatingFavoriteIds.value, groupId];

  try {
    const updatedGroup = await setKeywordGroupFavorite(
      groupId,
      nextIsFavorite,
    );

    groups.value =
      groups.value?.map((group) =>
        group.id === updatedGroup.id
          ? { ...group, isFavorite: updatedGroup.isFavorite }
          : group,
      ) ?? groups.value;
  } catch (error) {
    showErrorToast("Impossible de mettre à jour le favori du groupe.", error);
  } finally {
    updatingFavoriteIds.value = updatingFavoriteIds.value.filter(
      (id) => id !== groupId,
    );
  }
}

async function handleDeleteGroup(group: { id: string; name: string }) {
  if (isDeletingGroup(group.id)) {
    return;
  }

  const confirmed = window.confirm(
    `Supprimer le groupe "${group.name}" ? Les mots-clés resteront en base, mais ne seront plus rattachés à ce groupe.`,
  );

  if (!confirmed) {
    return;
  }

  deletingGroupIds.value = [...deletingGroupIds.value, group.id];

  try {
    await deleteKeywordGroup(group.id);
    await refresh();
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
    deletingGroupIds.value = deletingGroupIds.value.filter(
      (id) => id !== group.id,
    );
  }
}
</script>

<template>
  <section class="space-y-6">
    <UBreadcrumb :items="breadcrumbItems" class="text-slate-500" />

    <div class="flex items-center justify-between gap-4">
      <!-- <div class="space-y-1">
        <p class="text-sm text-slate-500">
          <NuxtLink
            to="/keyword-groups"
            class="underline decoration-transparent underline-offset-4 transition hover:decoration-slate-300"
          >
            Groupes de mots-clés
          </NuxtLink>
        </p>
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900">
          Tableau des groupes
        </h1>
      </div> -->

      <UButton
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="soft"
        :loading="status === 'pending'"
        @click="refresh"
      >
        <!-- Rafraîchir -->
      </UButton>
    </div>

    <p v-if="status === 'pending' && !groups?.length" class="text-sm text-slate-500">
      Chargement des groupes...
    </p>

    <FeedbackRichMessage
      v-else-if="error && !groups?.length"
      tone="error"
      title="Impossible de charger les groupes"
      description="La liste des KeywordGroups n'a pas pu être récupérée."
      action-label="Réessayer"
      @action="refresh"
    />

    <div v-else class="space-y-4">
      <div class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="space-y-1">
          <h2 class="text-lg font-semibold text-slate-900">
            Recherche rapide
          </h2>
          <p class="text-sm text-slate-500">
            Filtre les groupes par nom, description, mot-clé principal ou mots-clés contenus.
          </p>
        </div>

        <UInput
          v-model="groupSearch"
          icon="i-lucide-search"
          size="lg"
          placeholder="Filtrer les groupes..."
        />
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div class="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-slate-900">
              Résultats
            </h2>
            <p class="text-sm text-slate-500">
              {{ filteredGroups.length }} groupe{{ filteredGroups.length > 1 ? "s" : "" }} affiché{{ filteredGroups.length > 1 ? "s" : "" }}.
            </p>
          </div>

          <UBadge color="neutral" variant="soft">
            {{ filteredGroups.length }}
          </UBadge>
        </div>

        <KeywordGroupsTable
          :groups="filteredGroups"
          :updating-favorite-ids="updatingFavoriteIds"
          :deleting-group-ids="deletingGroupIds"
          @toggle-favorite="toggleGroupFavorite($event.id, !$event.isFavorite)"
          @delete-group="handleDeleteGroup"
        />
      </div>

      <FeedbackRichMessage
        v-if="!filteredGroups.length"
        tone="warning"
        title="Aucun groupe ne correspond à ce filtre"
        description="Essaie un autre mot-clé ou efface le filtre pour revoir toute la liste."
      />
    </div>
  </section>
</template>
