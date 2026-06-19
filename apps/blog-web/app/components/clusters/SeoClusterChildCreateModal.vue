<script setup lang="ts">
defineProps<{
  open: boolean;
  isSubmitting: boolean;
  errorMessage?: string | null;
  parentClusterName: string;
  form: {
    name: string;
    slug: string;
    icon: string;
    description: string;
    primaryKeyword: string;
  };
}>();

defineEmits<{
  close: [];
  submit: [];
}>();
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
    @pointerdown.self="$emit('close')"
  >
    <div
      class="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl"
      @pointerdown.stop
    >
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-xl font-semibold text-slate-900">
            Ajouter un sous-cluster
          </h2>
          <p class="text-sm text-slate-500">
            Le nouveau cluster sera ajouté sous
            <span class="font-medium text-slate-700">{{ parentClusterName }}</span>.
          </p>
        </div>

        <button
          type="button"
          class="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          @click="$emit('close')"
        >
          <UIcon name="i-lucide-x" class="h-5 w-5" />
        </button>
      </div>

      <form class="mt-6 space-y-4" @submit.prevent="$emit('submit')">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700">
              Nom du sous-cluster <span class="text-red-500">*</span>
            </span>
            <input
              v-model="form.name"
              type="text"
              placeholder="Ex. netlinking local"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            />
          </label>

          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700">
              Slug <span class="text-red-500">*</span>
            </span>
            <input
              v-model="form.slug"
              type="text"
              placeholder="Ex. netlinking-local"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            />
          </label>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700">
              Mot-clé principal <span class="text-red-500">*</span>
            </span>
            <input
              v-model="form.primaryKeyword"
              type="text"
              placeholder="Ex. netlinking local"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            />
          </label>

          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700">
              Icône Lucide
            </span>
            <ClustersSeoClusterIconInput v-model="form.icon" />
          </label>
        </div>

        <label class="block space-y-2">
          <span class="text-sm font-medium text-slate-700">Description</span>
          <textarea
            v-model="form.description"
            rows="3"
            placeholder="Décrivez rapidement le sous-cluster."
            class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          />
        </label>

        <FeedbackErrorMessage v-if="errorMessage">
          {{ errorMessage }}
        </FeedbackErrorMessage>

        <div class="flex items-center justify-end gap-3 pt-2">
          <UButton
            type="button"
            color="neutral"
            variant="soft"
            @click="$emit('close')"
          >
            Annuler
          </UButton>
          <UButton
            type="submit"
            :loading="isSubmitting"
            :disabled="
              !form.name.trim() ||
              !form.slug.trim() ||
              !form.primaryKeyword.trim()
            "
          >
            {{ isSubmitting ? "Création..." : "Créer le sous-cluster" }}
          </UButton>
        </div>
      </form>
    </div>
  </div>
</template>
