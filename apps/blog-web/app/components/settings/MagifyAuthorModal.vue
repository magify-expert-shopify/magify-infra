<script setup lang="ts">
import MagifyAuthorFormFields from "~/components/settings/MagifyAuthorFormFields.vue";
import type { Author } from "~/types/domain";
import type { UpsertMagifyAuthorInput } from "~/types/authors";

const props = defineProps<{
  open: boolean;
  author?: Author | null;
  isSaving: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [payload: UpsertMagifyAuthorInput];
}>();

const form = reactive<UpsertMagifyAuthorInput>({
  firstName: "",
  lastName: "",
  displayName: "",
  jobTitle: "",
  bio: "",
  avatarUrl: "",
  shopifyAvatarId: "",
  email: "",
  phoneNumber: "",
  shopifyPageId: "",
  linkedinProfileUrl: "",
  slug: "",
});

const title = computed(() =>
  props.author ? "Modifier l’auteur Magify" : "Ajouter un auteur Magify",
);

function resetForm() {
  form.firstName = props.author?.firstName ?? "";
  form.lastName = props.author?.lastName ?? "";
  form.displayName = props.author?.displayName ?? "";
  form.jobTitle = props.author?.jobTitle ?? "";
  form.bio = props.author?.bio ?? "";
  form.avatarUrl = props.author?.avatarUrl ?? "";
  form.shopifyAvatarId = props.author?.shopifyAvatarId ?? "";
  form.email = props.author?.email ?? "";
  form.phoneNumber = props.author?.phoneNumber ?? "";
  form.shopifyPageId = props.author?.shopifyPageId ?? "";
  form.linkedinProfileUrl = props.author?.linkedinProfileUrl ?? "";
  form.slug = props.author?.slug ?? "";
}

function submit() {
  emit("save", {
    firstName: form.firstName,
    lastName: form.lastName,
    displayName: form.displayName,
    jobTitle: form.jobTitle,
    bio: form.bio,
    avatarUrl: form.avatarUrl,
    shopifyAvatarId: form.shopifyAvatarId,
    email: form.email,
    phoneNumber: form.phoneNumber,
    shopifyPageId: form.shopifyPageId,
    linkedinProfileUrl: form.linkedinProfileUrl,
    slug: form.slug,
  });
}

watch(
  () => [props.open, props.author],
  () => {
    if (props.open) {
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
      class="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl"
      @pointerdown.stop
    >
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-xl font-semibold text-slate-900">
            {{ title }}
          </h2>
          <p class="text-sm text-slate-500">
            Renseignez la fiche auteur utilisée pour les contenus Magify.
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
        <MagifyAuthorFormFields :form="form" />
      </div>

      <div class="mt-6 flex items-center justify-end gap-3">
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="isSaving"
          @click="emit('close')"
        >
          Annuler
        </UButton>

        <UButton
          icon="i-lucide-save"
          :loading="isSaving"
          @click="submit"
        >
          {{ author ? "Enregistrer les modifications" : "Créer l’auteur" }}
        </UButton>
      </div>
    </div>
  </div>
</template>
