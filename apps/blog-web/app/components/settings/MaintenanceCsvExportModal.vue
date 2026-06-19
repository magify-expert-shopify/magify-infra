<script setup lang="ts">
import type { MaintenanceSummaryItem } from "~/types/maintenance";

const props = defineProps<{
  open: boolean;
  items: MaintenanceSummaryItem[];
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const { exportMaintenanceCsv } = useMaintenance();
const { showSuccessToast, showWarningToast } = useAppToast();

const selectedTargets = ref<string[]>([]);
const isExporting = ref(false);
const exportSummaryMessage = ref("");
const feedbackMessage = ref("");
const feedbackTone = ref<"info" | "success" | "warning" | "error">("info");

const defaultTargets = computed(() =>
  props.items.map((item) => item.key).filter(Boolean),
);

const exportHasFinished = computed(
  () => !isExporting.value && !!exportSummaryMessage.value,
);

const canSubmit = computed(
  () => selectedTargets.value.length > 0 && !isExporting.value,
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
  isExporting.value = false;
  exportSummaryMessage.value = "";
  feedbackMessage.value = "";
  feedbackTone.value = "info";
}

function closeModal() {
  if (isExporting.value) {
    return;
  }

  emit("update:open", false);
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

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

async function submitExport() {
  if (!selectedTargets.value.length || isExporting.value) {
    return;
  }

  isExporting.value = true;
  feedbackMessage.value = "";
  exportSummaryMessage.value = "";

  try {
    const response = await exportMaintenanceCsv({
      targets: [...selectedTargets.value],
    });

    const exportedFiles = response.files.filter((file) => file.csv.trim().length > 0);

    for (const file of exportedFiles) {
      downloadTextFile(file.filename, file.csv, "text/csv;charset=utf-8;");
    }

    const skippedFiles = response.files.length - exportedFiles.length;
    exportSummaryMessage.value =
      skippedFiles > 0
        ? `${exportedFiles.length} fichier(s) CSV exporté(s), ${skippedFiles} table(s) vide(s) ignorée(s).`
        : `${exportedFiles.length} fichier(s) CSV exporté(s).`;

    if (exportedFiles.length > 0) {
      showSuccessToast("Export CSV terminé", exportSummaryMessage.value);
      emit("update:open", false);
    } else {
      showWarningToast(
        "Export CSV vide",
        "Aucune ligne à exporter pour les tables sélectionnées.",
      );
    }
  } catch (error) {
    feedbackTone.value = "error";
    feedbackMessage.value =
      error instanceof Error
        ? error.message
        : "Impossible d'exporter les tables sélectionnées.";
  } finally {
    isExporting.value = false;
  }
}
</script>

<template>
  <UModal
    :open="open"
    :dismissible="!isExporting"
    :ui="{ content: 'sm:max-w-3xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="rounded-3xl bg-white p-6 shadow-xl">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <h2 class="text-xl font-semibold text-slate-900">
              Export CSV de maintenance
            </h2>
            <p class="text-sm leading-6 text-slate-500">
              Sélectionne les tables à exporter. Chaque table sera téléchargée dans un CSV séparé.
            </p>
          </div>

          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            :disabled="isExporting"
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

        <div class="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-semibold text-slate-900">
              Tables à exporter
            </p>

            <div class="flex gap-2">
              <UButton size="xs" variant="soft" color="neutral" @click="selectAllTargets">
                Tout cocher
              </UButton>
              <UButton size="xs" variant="soft" color="neutral" @click="clearTargets">
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
                  <UBadge color="neutral" variant="soft">
                    {{ item.totalCount }} ligne(s)
                  </UBadge>
                </div>
                <p class="mt-1 text-xs text-slate-500">
                  {{ item.tablePurgeable ? "Export complet disponible" : "Export lecture seule" }}
                </p>
              </div>
            </label>
          </div>
        </div>

        <div v-if="exportHasFinished" class="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {{ exportSummaryMessage }}
        </div>

        <div class="mt-6 flex flex-wrap justify-end gap-3">
          <UButton color="neutral" variant="soft" @click="closeModal">
            Annuler
          </UButton>
          <UButton
            color="primary"
            icon="i-lucide-file-down"
            :loading="isExporting"
            :disabled="!canSubmit"
            @click="submitExport"
          >
            Exporter le CSV
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
