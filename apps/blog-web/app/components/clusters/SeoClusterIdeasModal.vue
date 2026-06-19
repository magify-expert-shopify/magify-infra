<script setup lang="ts">
import type { BlogArticle } from "~/types/domain";

const props = defineProps<{
  open: boolean;
  ideasSearch: string;
  ideasFilterMode: "unassigned" | "all" | "parent-clusters";
  availableIdeas: BlogArticle[];
  assigningIdeaId: string | null;
  isAssigningAllIdeas: boolean;
}>();

const emit = defineEmits<{
  close: [];
  "update:ideasSearch": [value: string];
  "update:ideasFilterMode": [value: "unassigned" | "all" | "parent-clusters"];
  "add-idea": [idea: BlogArticle];
  "add-all": [];
}>();
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
    @pointerdown.self="emit('close')"
  >
    <div
      class="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl"
      @pointerdown.stop
    >
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-xl font-semibold text-slate-900">
            Ajouter des articles depuis les idées
          </h2>
          <p class="text-sm text-slate-500">
            Sélectionnez une idée à associer à ce cluster.
          </p>
        </div>

        <button
          type="button"
          class="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          @click="emit('close')"
        >
          <UIcon name="i-lucide-x" class="h-5 w-5" />
        </button>
      </div>

      <div class="mt-6">
        <textarea
          :model-value="ideasSearch"
          rows="4"
          placeholder="Rechercher une idée d’article, une ligne = un terme..."
          class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          @update:model-value="emit('update:ideasSearch', String($event ?? ''))"
          @input="
            emit(
              'update:ideasSearch',
              (($event.target as HTMLTextAreaElement | null)?.value ?? ''),
            )
          "
        />
      </div>

      <div class="mt-4 space-y-2">
        <p class="text-sm font-medium text-slate-700">Filtre des idées</p>

        <div
          class="inline-flex flex-wrap rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
        >
          <button
            type="button"
            class="rounded-xl px-3 py-2 text-sm font-medium transition"
            :class="
              ideasFilterMode === 'unassigned'
                ? 'bg-sky-700 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            "
            @click="emit('update:ideasFilterMode', 'unassigned')"
          >
            Idées non associées
          </button>

          <button
            type="button"
            class="rounded-xl px-3 py-2 text-sm font-medium transition"
            :class="
              ideasFilterMode === 'all'
                ? 'bg-sky-700 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            "
            @click="emit('update:ideasFilterMode', 'all')"
          >
            Tout afficher
          </button>

          <button
            type="button"
            class="rounded-xl px-3 py-2 text-sm font-medium transition"
            :class="
              ideasFilterMode === 'parent-clusters'
                ? 'bg-sky-700 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            "
            @click="emit('update:ideasFilterMode', 'parent-clusters')"
          >
            Articles des clusters parents
          </button>
        </div>
      </div>

      <div class="mt-6 max-h-[26rem] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div class="mb-3 flex justify-end">
          <UButton
            size="sm"
            icon="i-lucide-list-plus"
            :loading="isAssigningAllIdeas"
            :disabled="!availableIdeas.length || !!assigningIdeaId"
            @click="emit('add-all')"
          >
            Tout ajouter
          </UButton>
        </div>

        <div v-if="availableIdeas.length" class="space-y-2">
          <article
            v-for="idea in availableIdeas"
            :key="idea.id"
            class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-slate-900">
                {{ idea.title }}
              </p>
              <p
                v-if="idea.cluster?.name"
                class="mt-1 text-xs text-slate-500"
              >
                Déjà associé à {{ idea.cluster.name }}
              </p>
            </div>

            <UButton
              size="sm"
              icon="i-lucide-plus"
              :loading="assigningIdeaId === idea.id"
              @click="emit('add-idea', idea)"
            >
              Ajouter
            </UButton>
          </article>
        </div>

        <p v-else class="px-2 py-4 text-sm text-slate-500">
          Aucune idée disponible pour cette recherche.
        </p>
      </div>
    </div>
  </div>
</template>
