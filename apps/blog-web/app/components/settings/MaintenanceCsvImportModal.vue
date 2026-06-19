<script setup lang="ts">
import type {
  MaintenanceCsvImportPayload,
  MaintenanceSummaryItem,
} from "~/types/maintenance";

const props = defineProps<{
  open: boolean;
  items: MaintenanceSummaryItem[];
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  import: [payload: MaintenanceCsvImportPayload];
}>();

const selectedTargets = ref<string[]>([]);
const selectedFile = ref<File | null>(null);
const isDropZoneActive = ref(false);
const dragDepth = ref(0);
const isSubmitting = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const feedbackMessage = ref("");
const feedbackTone = ref<"info" | "success" | "warning" | "error">("info");

const defaultTargets = computed(() =>
  props.items.map((item) => item.key).filter(Boolean),
);

const canSubmit = computed(
  () => !!selectedFile.value && selectedTargets.value.length > 0 && !isSubmitting.value,
);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      resetState();
      return;
    }

    selectedTargets.value = [...defaultTargets.value];
  },
  { immediate: true },
);

function resetState() {
  selectedTargets.value = [];
  selectedFile.value = null;
  isDropZoneActive.value = false;
  dragDepth.value = 0;
  isSubmitting.value = false;
  feedbackMessage.value = "";
  feedbackTone.value = "info";
}

function closeModal() {
  if (isSubmitting.value) {
    return;
  }

  emit("update:open", false);
}

function openFilePicker() {
  if (isSubmitting.value) {
    return;
  }

  fileInput.value?.click();
}

function normalizeFile(file: File | undefined | null) {
  if (!file) {
    return null;
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    feedbackTone.value = "warning";
    feedbackMessage.value = "Choisis un fichier CSV au format attendu.";
    return null;
  }

  feedbackMessage.value = "";
  return file;
}

function handleFileSelected(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const file = normalizeFile(input?.files?.[0] ?? null);

  if (input) {
    input.value = "";
  }

  if (!file) {
    return;
  }

  selectedFile.value = file;
}

function handleDragEnter() {
  dragDepth.value += 1;
  isDropZoneActive.value = true;
}

function handleDragLeave() {
  dragDepth.value = Math.max(0, dragDepth.value - 1);

  if (!dragDepth.value) {
    isDropZoneActive.value = false;
  }
}

function resetDropZoneState() {
  dragDepth.value = 0;
  isDropZoneActive.value = false;
}

function handleDrop(event: DragEvent) {
  const file = normalizeFile(event.dataTransfer?.files?.[0] ?? null);
  resetDropZoneState();

  if (!file) {
    return;
  }

  selectedFile.value = file;
}

function toggleTarget(targetKey: string) {
  if (selectedTargets.value.includes(targetKey)) {
    selectedTargets.value = selectedTargets.value.filter(
      (item) => item !== targetKey,
    );
    return;
  }

  selectedTargets.value = [...selectedTargets.value, targetKey];
}

function selectAllTargets() {
  selectedTargets.value = [...defaultTargets.value];
}

function clearTargets() {
  selectedTargets.value = [];
}

async function submitImport() {
  if (!selectedFile.value || !selectedTargets.value.length || isSubmitting.value) {
    return;
  }

  isSubmitting.value = true;
  feedbackMessage.value = "";

  try {
    emit("import", {
      file: selectedFile.value,
      targets: [...selectedTargets.value],
    });
  } catch (error) {
    feedbackTone.value = "error";
    feedbackMessage.value =
      error instanceof Error
        ? error.message
        : "Impossible de préparer l'import CSV.";
    return;
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <UModal
    :open="open"
    :dismissible="!isSubmitting"
    :ui="{ content: 'sm:max-w-3xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="rounded-3xl bg-white p-6 shadow-xl">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <h2 class="text-xl font-semibold text-slate-900">
              Import CSV de maintenance
            </h2>
            <p class="text-sm leading-6 text-slate-500">
              Choisis le fichier CSV puis sélectionne les tables à importer.
            </p>
          </div>

          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            :disabled="isSubmitting"
            @click="closeModal"
          />
        </div>

        <FeedbackInlineMessage
          v-if="feedbackMessage"
          :tone="feedbackTone"
          class="mt-4"
        >
          {{ feedbackMessage }}
        </FeedbackInlineMessage>

        <div class="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div
            class="rounded-2xl border border-dashed px-5 py-6 transition"
            :class="
              isDropZoneActive
                ? 'border-sky-300 bg-sky-50'
                : 'border-slate-200 bg-slate-50/70'
            "
            role="button"
            tabindex="0"
            @click="openFilePicker"
            @keydown.enter.prevent="openFilePicker"
            @keydown.space.prevent="openFilePicker"
            @dragenter.prevent="handleDragEnter"
            @dragover.prevent="isDropZoneActive = true"
            @dragleave.prevent="handleDragLeave"
            @drop.prevent="handleDrop"
          >
            <div class="flex flex-col items-center justify-center text-center">
              <UIcon
                name="i-lucide-file-up"
                class="h-10 w-10"
                :class="isDropZoneActive ? 'text-sky-600' : 'text-slate-400'"
              />
              <p class="mt-3 text-base font-semibold text-slate-900">
                Dépose ton CSV ici
              </p>
              <p class="mt-2 max-w-lg text-sm leading-6 text-slate-500">
                Tu peux aussi cliquer pour choisir un fichier depuis ton
                ordinateur.
              </p>
              <p class="mt-3 text-xs text-slate-400">
                Format attendu: fichier `.csv`
              </p>
              <p v-if="selectedFile" class="mt-4 text-sm text-sky-700">
                Fichier sélectionné : {{ selectedFile.name }}
              </p>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-4">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-semibold text-slate-900">
                Tables à importer
              </p>

              <div class="flex gap-2">
                <UButton
                  size="xs"
                  variant="soft"
                  color="neutral"
                  @click="selectAllTargets"
                >
                  Tout cocher
                </UButton>
                <UButton
                  size="xs"
                  variant="soft"
                  color="neutral"
                  @click="clearTargets"
                >
                  Tout décocher
                </UButton>
              </div>
            </div>

            <div class="mt-4 max-h-72 space-y-2 overflow-auto pr-1">
              <label
                v-for="item in items"
                :key="item.key"
                class="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-sky-200 hover:bg-sky-50/40"
              >
                <input
                  type="checkbox"
                  class="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  :value="item.key"
                  :checked="selectedTargets.includes(item.key)"
                  @change="toggleTarget(item.key)"
                />

                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-3">
                    <p class="truncate text-sm font-medium text-slate-900">
                      {{ item.label }}
                    </p>
                    <UBadge
                      :color="item.tablePurgeable ? 'warning' : 'neutral'"
                      variant="soft"
                    >
                      {{ item.tablePurgeable ? "Purgeable" : "Lecture" }}
                    </UBadge>
                  </div>
                  <p class="mt-1 text-xs text-slate-500">
                    {{ item.totalCount }} enregistrement(s) en base
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div class="mt-6 flex flex-wrap justify-end gap-3">
          <UButton color="neutral" variant="soft" @click="closeModal">
            Annuler
          </UButton>
          <UButton
            color="primary"
            icon="i-lucide-file-up"
            :loading="isSubmitting"
            :disabled="!canSubmit"
            @click="submitImport"
          >
            Importer le CSV
          </UButton>
        </div>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept=".csv,text/csv"
        class="hidden"
        @change="handleFileSelected"
      />
    </template>
  </UModal>
</template>
