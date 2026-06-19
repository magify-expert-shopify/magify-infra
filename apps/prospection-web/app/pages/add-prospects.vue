<script setup lang="ts">
const notifications = useNotificationsStore();
const { normalizeUrlList, createBulkProspectImport } = useBulkProspects();

const bulkText = ref("");
const selectedFileName = ref("");
const isSubmitting = ref(false);
const isDragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const resultMessage = ref("");
const resultTone = ref<"idle" | "success" | "error">("idle");
const importResult = ref<{
  id: number;
  sourceFile: string;
  totalUrls: number;
  existingUrls: number;
  urlIds: number[];
  newUrlIds: number[];
  existingUrlIds: number[];
  queuedUrls?: number;
  processedUrls?: number;
  failedUrls?: number;
  status?: string;
  currentStep?: string;
} | null>(null);
const importDestination = computed(() =>
  importResult.value ? `/imports/${importResult.value.id}` : "/imports",
);

const urlCount = computed(() => normalizeUrlList(bulkText.value).length);
const textareaUi = {
  base: "max-h-[42vh] min-h-[12rem] overflow-y-auto resize-none",
};

function resetFeedback() {
  resultMessage.value = "";
  resultTone.value = "idle";
  importResult.value = null;
}

async function applyFileContent(file: File) {
  selectedFileName.value = file.name;

  const reader = new FileReader();

  const fileText = await new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Impossible de lire ce fichier."));
    reader.readAsText(file);
  });

  const urls = normalizeUrlList(fileText);
  bulkText.value = urls.join("\n");
  resetFeedback();
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }

  try {
    await applyFileContent(file);
  } finally {
    if (input) {
      input.value = "";
    }
  }
}

async function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (!file) {
    return;
  }

  await applyFileContent(file);
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
  isDragging.value = true;
}

function handleDragLeave() {
  isDragging.value = false;
}

function handleTextareaPaste(event: ClipboardEvent) {
  const pastedText = event.clipboardData?.getData("text/plain") || "";
  const urls = normalizeUrlList(pastedText);

  if (!urls.length) {
    return;
  }

  event.preventDefault();
  bulkText.value = "";
  bulkText.value = urls.join("\n");
  selectedFileName.value = "";
  if (fileInput.value) {
    fileInput.value.value = "";
  }
  resetFeedback();
}

function openFilePicker() {
  if (fileInput.value) {
    fileInput.value.value = "";
  }

  fileInput.value?.click();
}

async function handleSubmit() {
  const urls = normalizeUrlList(bulkText.value);

  if (!urls.length) {
    resultTone.value = "error";
    resultMessage.value = "Ajoute au moins une URL valide.";
    notifications.add({
      kind: "error",
      title: "Import groupé",
      message: resultMessage.value,
    });
    return;
  }

  isSubmitting.value = true;
  resetFeedback();

  try {
    const result = await createBulkProspectImport(
      urls,
      selectedFileName.value || "manual",
    );
    if ("skipped" in result && result.skipped) {
      importResult.value = null;
      resultTone.value = "success";
      resultMessage.value = result.message;

      notifications.add({
        kind: "success",
        title: "Import groupé",
        message: resultMessage.value,
      });
      return;
    }

    importResult.value = result;
    resultTone.value = "success";
    resultMessage.value = `${result.totalUrls} URL(s) mises en file, ${result.existingUrls} déjà existante(s).`;

    notifications.add({
      kind: "success",
      title: "Import groupé mis en file",
      message: resultMessage.value,
      href: importDestination.value,
    });
  } catch (error) {
    resultTone.value = "error";
    resultMessage.value =
      error instanceof Error ? error.message : "Impossible d’importer ce lot.";
    notifications.add({
      kind: "error",
      title: "Import groupé échoué",
      message: resultMessage.value,
    });
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <LayoutPageShell
    title="Ajouter plusieurs prospects"
    description="Colle plusieurs URLs ou dépose un fichier. On extrait les liens côté front, puis on crée l’import et on l’envoie en file pour traitement en arrière-plan."
    max-width="3xl"
  >
    <section
      class="rounded-xl border p-4 shadow-sm transition"
      :class="
        isDragging
          ? 'border-blue-400 bg-blue-100/50 ring-2 ring-blue-100'
          : 'border-slate-200 bg-white'
      "
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        accept=".txt,.csv,.md,.json,.html,.htm,.xml,.xhtml,.log,text/*,application/json,application/xml,application/xhtml+xml"
        @change="handleFileChange"
      />

      <div class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-medium text-slate-900">
              Dépose un fichier ou colle du texte
            </p>
            <p class="text-xs text-slate-500">
              On garde uniquement les URLs détectées.
            </p>
          </div>
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-upload"
            :disabled="isSubmitting"
            @click="openFilePicker"
          >
            Choisir un fichier
          </UButton>
        </div>

        <UTextarea
          v-model="bulkText"
          :disabled="isSubmitting"
          :rows="10"
          placeholder="https://example.com"
          class="w-full"
          :ui="textareaUi"
          @paste="handleTextareaPaste"
        />

        <div class="flex flex-wrap items-center gap-3 text-muted-sm">
          <span>{{ urlCount }} URL(s) détectée(s)</span>
          <span v-if="selectedFileName">Fichier: {{ selectedFileName }}</span>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <UButton
            color="primary"
            variant="solid"
            icon="i-lucide-folder-plus"
            :loading="isSubmitting"
            :disabled="isSubmitting"
            @click="handleSubmit"
          >
            Ajouter les prospects
          </UButton>

          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-trash-2"
            :disabled="isSubmitting"
            @click="bulkText = ''"
          >
            Vider
          </UButton>
        </div>

        <div
          v-if="resultMessage"
          class="rounded-lg border px-3 py-2 text-xs"
          :class="
            resultTone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          "
        >
          <div
            class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p class="leading-6">
              {{ resultMessage }}
            </p>

            <UButton
              v-if="resultTone === 'success' && importResult"
              :to="importDestination"
              color="primary"
              variant="solid"
              icon="i-lucide-users"
            >
              Voir la file
            </UButton>
          </div>
        </div>
      </div>
    </section>
  </LayoutPageShell>
</template>
