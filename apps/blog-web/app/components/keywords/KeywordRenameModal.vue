<script setup lang="ts">
const props = defineProps<{
  open: boolean;
  keywordId: string | null;
  initialKeyword: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  renamed: [];
}>();

const { renameKeyword } = useKeywords();

const keywordValue = ref("");
const feedbackMessage = ref("");
const isSaving = ref(false);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      keywordValue.value = "";
      feedbackMessage.value = "";
      isSaving.value = false;
      return;
    }

    keywordValue.value = props.initialKeyword;
    feedbackMessage.value = "";
  },
);

function closeModal() {
  if (isSaving.value) {
    return;
  }

  emit("update:open", false);
}

async function handleSave() {
  if (isSaving.value || !props.keywordId || !keywordValue.value.trim()) {
    return;
  }

  isSaving.value = true;
  feedbackMessage.value = "";

  try {
    await renameKeyword(props.keywordId, keywordValue.value);
    emit("renamed");
    closeModal();
  } catch (error) {
    feedbackMessage.value =
      error instanceof Error
        ? error.message
        : "Impossible de modifier le mot-clé.";
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <UModal :open="open" :dismissible="!isSaving" @update:open="emit('update:open', $event)">
    <template #content>
      <div class="rounded-3xl bg-white p-6 shadow-xl">
        <div class="space-y-1">
          <h2 class="text-xl font-semibold text-slate-900">
            Modifier le mot-clé
          </h2>
          <p class="text-sm leading-6 text-slate-500">
            Renommez ce mot-clé sans recréer une nouvelle entrée.
          </p>
        </div>

        <label class="mt-5 block space-y-2">
          <span class="text-sm font-medium text-slate-700">Mot-clé</span>
          <input
            v-model="keywordValue"
            type="text"
            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          />
        </label>

        <p v-if="feedbackMessage" class="mt-4 text-sm text-red-600">
          {{ feedbackMessage }}
        </p>

        <div class="mt-6 flex justify-end gap-3">
          <UButton
            color="neutral"
            variant="soft"
            :disabled="isSaving"
            @click="closeModal"
          >
            Annuler
          </UButton>

          <UButton
            icon="i-lucide-save"
            :loading="isSaving"
            :disabled="!keywordValue.trim()"
            @click="handleSave"
          >
            {{ isSaving ? "Enregistrement..." : "Enregistrer" }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
