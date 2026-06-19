<script setup lang="ts">
import MagifyAuthorModal from "~/components/settings/MagifyAuthorModal.vue";
import type { UpsertMagifyAuthorInput } from "~/types/authors";
import type { Author } from "~/types/domain";

const {
  createMagifyAuthor,
  deleteMagifyAuthor,
  updateMagifyAuthor,
  useMagifyAuthorsList,
} = useAuthors();
const { getPreferredAuthorProfile, updatePreferredAuthorProfile } = useSettings();
const { data: magifyAuthors, refresh: refreshMagifyAuthors } =
  await useMagifyAuthorsList();
const {
  data: preferredAuthorProfile,
  refresh: refreshPreferredAuthorProfile,
} = await useAsyncData("settings:preferred-author-profile", () =>
  getPreferredAuthorProfile(),
);

const isAuthorModalOpen = ref(false);
const authorBeingEdited = ref<Author | null>(null);
const isSavingAuthor = ref(false);
const deletingAuthorId = ref<string | null>(null);
const isSavingPreferredAuthor = ref(false);
const authorFeedbackMessage = ref("");
const selectedPreferredAuthorId = ref("");

const magifyAuthorCards = computed(() => magifyAuthors.value ?? []);

watch(
  preferredAuthorProfile,
  (value) => {
    selectedPreferredAuthorId.value = value?.authorId ?? "";
  },
  { immediate: true },
);

function openCreateAuthorModal() {
  authorBeingEdited.value = null;
  isAuthorModalOpen.value = true;
}

function openEditAuthorModal(author: Author) {
  authorBeingEdited.value = author;
  isAuthorModalOpen.value = true;
}

function closeAuthorModal(force = false) {
  if (isSavingAuthor.value && !force) {
    return;
  }

  isAuthorModalOpen.value = false;
  authorBeingEdited.value = null;
}

async function saveMagifyAuthor(payload: UpsertMagifyAuthorInput) {
  if (isSavingAuthor.value) {
    return;
  }

  isSavingAuthor.value = true;
  authorFeedbackMessage.value = "";

  try {
    if (authorBeingEdited.value) {
      await updateMagifyAuthor(authorBeingEdited.value.id, payload);
      authorFeedbackMessage.value = "Auteur Magify mis à jour.";
    } else {
      await createMagifyAuthor(payload);
      authorFeedbackMessage.value = "Auteur Magify créé.";
    }

    await refreshMagifyAuthors();
    closeAuthorModal(true);
  } finally {
    isSavingAuthor.value = false;
  }
}

async function removeMagifyAuthor(author: Author) {
  if (deletingAuthorId.value) {
    return;
  }

  const authorLabel =
    author.displayName?.trim() ||
    [author.firstName, author.lastName].filter(Boolean).join(" ").trim() ||
    author.name;

  if (!window.confirm(`Supprimer l’auteur Magify « ${authorLabel} » ?`)) {
    return;
  }

  deletingAuthorId.value = author.id;
  authorFeedbackMessage.value = "";

  try {
    await deleteMagifyAuthor(author.id);
    await refreshMagifyAuthors();
    authorFeedbackMessage.value = "Auteur Magify supprimé.";
  } finally {
    deletingAuthorId.value = null;
  }
}

async function savePreferredAuthorProfile() {
  if (isSavingPreferredAuthor.value) {
    return;
  }

  isSavingPreferredAuthor.value = true;
  authorFeedbackMessage.value = "";

  try {
    const updatedProfile = await updatePreferredAuthorProfile(
      selectedPreferredAuthorId.value || null,
    );
    preferredAuthorProfile.value = updatedProfile;
    await refreshPreferredAuthorProfile();
    authorFeedbackMessage.value = updatedProfile.authorId
      ? "Profil de publication par défaut mis à jour."
      : "Profil de publication par défaut retiré.";
  } finally {
    isSavingPreferredAuthor.value = false;
  }
}
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex flex-col gap-4">
      <div
        class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
      >
        <div class="space-y-1">
          <h2 class="text-lg font-semibold text-slate-900">Auteurs Magify</h2>
          <p class="text-sm leading-6 text-slate-500">
            Gérez ici les fiches auteurs internes utilisées pour la rédaction et
            la publication.
          </p>
        </div>

        <UButton icon="i-lucide-user-plus" @click="openCreateAuthorModal">
          Ajouter un auteur
        </UButton>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <label class="block space-y-2">
          <span class="text-sm font-medium text-slate-700">
            Profil de publication par défaut
          </span>
          <select
            v-model="selectedPreferredAuthorId"
            :disabled="isSavingPreferredAuthor"
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            @change="savePreferredAuthorProfile"
          >
            <option value="">Aucun profil</option>
            <option v-for="author in magifyAuthorCards" :key="author.id" :value="author.id">
              {{ author.displayName || author.name }}
            </option>
          </select>
          <p class="text-xs text-slate-500">
            Ce profil sera préselectionné quand vous publierez un article.
          </p>
        </label>
      </div>

      <p v-if="authorFeedbackMessage" class="text-sm text-slate-500">
        {{ authorFeedbackMessage }}
      </p>

      <div
        v-if="!magifyAuthorCards.length"
        class="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500"
      >
        Aucun auteur Magify n’est encore configuré.
      </div>

      <div v-else class="grid gap-4 md:grid-cols-2">
        <article
          v-for="author in magifyAuthorCards"
          :key="author.id"
          class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
        >
          <div class="flex items-start gap-4">
            <img
              v-if="author.avatarUrl"
              :src="author.avatarUrl"
              :alt="author.displayName || author.name"
              class="h-16 w-16 rounded-full border border-slate-200 object-cover"
            />
            <div
              v-else
              class="flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-semibold text-slate-600"
            >
              {{
                (author.displayName || author.name).slice(0, 1).toUpperCase()
              }}
            </div>

            <div class="min-w-0 flex-1 space-y-1">
              <p class="truncate text-base font-semibold text-slate-900">
                {{ author.displayName || author.name }}
              </p>
              <p v-if="author.jobTitle" class="text-sm text-slate-600">
                {{ author.jobTitle }}
              </p>
              <p
                v-if="author.firstName || author.lastName"
                class="text-sm text-slate-600"
              >
                {{
                  [author.firstName, author.lastName].filter(Boolean).join(" ")
                }}
              </p>
              <p v-if="author.email" class="truncate text-sm text-slate-500">
                {{ author.email }}
              </p>
              <p v-if="author.phoneNumber" class="text-sm text-slate-500">
                {{ author.phoneNumber }}
              </p>
              <a
                v-if="author.linkedinProfileUrl"
                :href="author.linkedinProfileUrl"
                target="_blank"
                rel="noreferrer"
                class="inline-flex text-sm font-medium text-sky-700 transition hover:text-sky-800"
              >
                Profil LinkedIn
              </a>
              <p v-if="author.slug" class="text-xs text-slate-400">
                /{{ author.slug }}
              </p>
              <p
                v-if="author.shopifyPageId"
                class="truncate text-xs text-slate-400"
              >
                {{ author.shopifyPageId }}
              </p>
            </div>
          </div>

          <p v-if="author.bio" class="mt-4 text-sm leading-6 text-slate-500">
            {{ author.bio }}
          </p>

          <a
            v-if="author.profileUrl"
            :href="author.profileUrl"
            target="_blank"
            rel="noreferrer"
            class="mt-3 inline-flex text-sm font-medium text-violet-700 transition hover:text-violet-800"
          >
            Voir la page auteur
          </a>

          <div class="mt-4 flex flex-wrap items-center gap-2">
            <UButton
              size="sm"
              color="neutral"
              variant="soft"
              icon="i-lucide-pencil"
              @click="openEditAuthorModal(author)"
            >
              Modifier
            </UButton>

            <UButton
              size="sm"
              color="error"
              variant="soft"
              icon="i-lucide-trash-2"
              :loading="deletingAuthorId === author.id"
              :disabled="!!deletingAuthorId"
              @click="removeMagifyAuthor(author)"
            >
              Supprimer
            </UButton>
          </div>
        </article>
      </div>
    </div>

    <MagifyAuthorModal
      :open="isAuthorModalOpen"
      :author="authorBeingEdited"
      :is-saving="isSavingAuthor"
      @close="closeAuthorModal"
      @save="saveMagifyAuthor"
    />
  </div>
</template>
