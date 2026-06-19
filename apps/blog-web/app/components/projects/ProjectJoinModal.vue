<script setup lang="ts">
const props = defineProps<{
  open: boolean;
  isSaving: boolean;
  errorMessage?: string;
}>();

const emit = defineEmits<{
  close: [];
  save: [payload: { slug: string }];
}>();

const form = reactive({
  slug: "",
});

function resetForm() {
  form.slug = "";
}

function submit() {
  emit("save", {
    slug: form.slug,
  });
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      resetForm();
    }
  },
  { immediate: true },
);
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
    @pointerdown.self="emit('close')"
  >
    <div
      class="w-full max-w-xl rounded-[2rem] bg-white p-6 shadow-2xl"
      @pointerdown.stop
    >
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-xl font-semibold text-slate-900">
            Rejoindre un projet
          </h2>
          <p class="text-sm text-slate-500">
            Entrez le code du projet partagé par un autre utilisateur.
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

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <label class="block space-y-2">
          <span class="text-sm font-medium text-slate-700">Code projet</span>
          <input
            v-model="form.slug"
            type="text"
            required
            placeholder="Ex: magify-france"
            class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
          >
        </label>

        <FeedbackErrorMessage v-if="errorMessage">
          {{ errorMessage }}
        </FeedbackErrorMessage>

        <div class="flex items-center justify-end gap-3">
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="isSaving"
            @click="emit('close')"
          >
            Annuler
          </UButton>

          <UButton
            type="submit"
            color="neutral"
            icon="i-lucide-user-plus"
            :loading="isSaving"
            :disabled="isSaving || !form.slug.trim()"
          >
            Rejoindre le projet
          </UButton>
        </div>
      </form>
    </div>
  </div>
</template>
