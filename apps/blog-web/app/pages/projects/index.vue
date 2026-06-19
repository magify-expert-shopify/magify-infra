<script setup lang="ts">
import ProjectCreateModal from "~/components/projects/ProjectCreateModal.vue";
import ProjectJoinModal from "~/components/projects/ProjectJoinModal.vue";
import type { Project } from "~/types/projects";

const route = useRoute();
const { useProjectsList, createProject, joinProject, deleteProject } = useProjects();
const { currentProject, setCurrentProject, clearCurrentProject } = useCurrentProject();
const { updateCurrentProject } = useSettings();

const search = ref("");
const isCreateModalOpen = ref(false);
const isJoinModalOpen = ref(false);
const isCreating = ref(false);
const isJoining = ref(false);
const deletingProjectId = ref<string | null>(null);
const createError = ref("");
const joinError = ref("");

const { data: projects, error, status, refresh } = await useProjectsList();

const filteredProjects = computed(() => {
  const query = search.value.trim().toLowerCase();

  if (!query) {
    return projects.value ?? [];
  }

  return (projects.value ?? []).filter((project) => {
    const haystack = [
      project.name,
      project.slug ?? "",
      project.description ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
});

async function selectProject(project: Project) {
  const response = await updateCurrentProject(project.id);
  setCurrentProject(response.project ?? project);
  await navigateTo(String(route.query.redirect || "/"));
}

async function submitProject(input: {
  name: string;
  description?: string | null;
  shopifyStoreDomain?: string | null;
}) {
  if (isCreating.value) {
    return;
  }

  createError.value = "";
  isCreating.value = true;

  try {
    const project = await createProject({
      name: input.name,
      description: input.description || null,
      shopifyStoreDomain: input.shopifyStoreDomain || null,
    });

    await refreshNuxtData("projects");
    isCreateModalOpen.value = false;
    await selectProject(project);
  } catch (caughtError) {
    createError.value =
      caughtError instanceof Error
        ? caughtError.message
        : "Impossible de créer le projet.";
  } finally {
    isCreating.value = false;
  }
}

async function submitJoinProject(input: { slug: string }) {
  if (isJoining.value) {
    return;
  }

  joinError.value = "";
  isJoining.value = true;

  try {
    const project = await joinProject({
      slug: input.slug,
    });

    await refreshNuxtData("projects");
    isJoinModalOpen.value = false;
    await selectProject(project);
  } catch (caughtError) {
    joinError.value =
      caughtError instanceof Error
        ? caughtError.message
        : "Impossible de rejoindre ce projet.";
  } finally {
    isJoining.value = false;
  }
}

async function handleDeleteProject(project: Project) {
  if (!project.canDelete || deletingProjectId.value) {
    return;
  }

  if (!window.confirm(`Supprimer le projet « ${project.name} » ?`)) {
    return;
  }

  deletingProjectId.value = project.id;

  try {
    await deleteProject(project.id);

    if (currentProject.value?.id === project.id) {
      await updateCurrentProject(null);
      clearCurrentProject();
    }

    await refreshNuxtData("projects");
  } finally {
    deletingProjectId.value = null;
  }
}
</script>

<template>
  <section class="flex min-h-screen items-center bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.16),_transparent_45%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-10 sm:px-6">
    <div class="mx-auto max-w-5xl">
      <div class="overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur">
        <div class="border-b border-slate-200/80 px-6 py-8 sm:px-8">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div class="space-y-2">
              <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Projet courant
              </p>
              <h1 class="text-3xl font-semibold tracking-tight text-slate-900">
                Choisir un projet
              </h1>
              <p class="max-w-2xl text-sm leading-6 text-slate-500">
                Sélectionnez le projet qui pilotera le reste de votre navigation, ou créez-en un nouveau en quelques secondes.
              </p>
            </div>

            <div class="flex flex-wrap gap-3">
              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-user-plus"
                @click="isJoinModalOpen = true"
              >
                Rejoindre un projet
              </UButton>
              <UButton
                color="neutral"
                icon="i-lucide-folder-plus"
                @click="isCreateModalOpen = true"
              >
                Nouveau projet
              </UButton>
            </div>
          </div>

          <label class="mt-6 block space-y-2">
            <span class="text-sm font-medium text-slate-700">Rechercher un projet</span>
            <input
              v-model="search"
              type="search"
              placeholder="Nom, slug, description..."
              class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
            >
          </label>
        </div>

        <div class="px-6 py-6 sm:px-8">
          <FeedbackLoadingMessage v-if="status === 'pending'">
            Chargement des projets...
          </FeedbackLoadingMessage>

          <FeedbackRichMessage
            v-else-if="error"
            tone="error"
            :details="error.toString()"
            title="Impossible de charger les projets"
            description="La liste des projets n'a pas pu être récupérée."
            action-label="Réessayer"
            @action="refresh"
          />

          <ul
            v-else-if="filteredProjects.length"
            class="grid gap-4 md:grid-cols-2"
          >
            <li
              v-for="project in filteredProjects"
              :key="project.id"
              class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
            >
              <div class="flex h-full flex-col justify-between gap-5">
                <div class="space-y-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <h2 class="text-lg font-semibold text-slate-900">
                      {{ project.name }}
                    </h2>
                    <span
                      v-if="currentProject?.id === project.id"
                      class="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700"
                    >
                      Courant
                    </span>
                  </div>

                  <p class="text-sm text-slate-500">
                    {{ project.description || "Aucune description pour l’instant." }}
                  </p>

                  <p class="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    Code projet: {{ project.slug || "sans-code" }}
                  </p>
                  <p class="text-xs text-slate-500">
                    Shopify: {{ project.shopifyStoreDomain || "Non configuré" }}
                  </p>
                  <p class="text-xs text-slate-500">
                    Rôle: {{ project.currentUserRole === "admin" ? "Admin" : "Membre" }}
                  </p>
                </div>

                <div class="flex items-end justify-between gap-4">
                  <p class="text-xs leading-5 text-slate-500">
                    {{ project._count?.blogArticles ?? 0 }} article{{ (project._count?.blogArticles ?? 0) > 1 ? "s" : "" }}
                    · {{ project._count?.members ?? 0 }} membre{{ (project._count?.members ?? 0) > 1 ? "s" : "" }}
                  </p>

                  <div class="flex flex-wrap justify-end gap-2">
                    <UButton color="neutral" @click="selectProject(project)">
                      Choisir
                    </UButton>
                    <UButton
                      v-if="project.canDelete"
                      color="error"
                      variant="soft"
                      icon="i-lucide-trash-2"
                      :loading="deletingProjectId === project.id"
                      @click="handleDeleteProject(project)"
                    >
                      Supprimer
                    </UButton>
                  </div>
                </div>
              </div>
            </li>
          </ul>

          <div
            v-else
            class="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center"
          >
            <p class="text-base font-medium text-slate-700">
              Aucun projet ne correspond à la recherche.
            </p>
            <p class="mt-2 text-sm text-slate-500">
              Essayez un autre terme ou créez un nouveau projet.
            </p>
            <UButton
              class="mt-5"
              color="neutral"
              variant="soft"
              icon="i-lucide-user-plus"
              @click="isJoinModalOpen = true"
            >
              Rejoindre un projet
            </UButton>
            <UButton
              class="mt-3"
              color="neutral"
              variant="soft"
              icon="i-lucide-folder-plus"
              @click="isCreateModalOpen = true"
            >
              Créer un projet
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <ProjectCreateModal
      :open="isCreateModalOpen"
      :is-saving="isCreating"
      :error-message="createError"
      @close="isCreateModalOpen = false"
      @save="submitProject"
    />

    <ProjectJoinModal
      :open="isJoinModalOpen"
      :is-saving="isJoining"
      :error-message="joinError"
      @close="isJoinModalOpen = false"
      @save="submitJoinProject"
    />
  </section>
</template>
