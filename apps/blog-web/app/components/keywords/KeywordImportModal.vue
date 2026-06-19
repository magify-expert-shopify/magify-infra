<script setup lang="ts">
import {
  KeywordIntent,
  type KeywordImportProgress,
  type UpsertKeywordInput,
} from "~/types/keyword-analysis";
import { normalizeSearchText } from "~/utils/search-normalizer";

const props = defineProps<{
  open: boolean;
  existingKeywords: string[];
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  "analyze-requested": [keyword: string];
  imported: [];
}>();

const { upsertKeyword } = useKeywordAnalysis();
const { showSuccessToast, showWarningToast } = useAppToast();
const csvTemplateHeader = "keyword,volume,difficulty,searchIntent";

const keywordIntentOptions = [
  { value: KeywordIntent.INFORMATIONAL, label: "Informationnelle" },
  { value: KeywordIntent.COMMERCIAL, label: "Commerciale" },
  { value: KeywordIntent.TRANSACTIONAL, label: "Transactionnelle" },
  { value: KeywordIntent.NAVIGATIONAL, label: "Navigationnelle" },
] as const;

const form = reactive<UpsertKeywordInput>({
  keyword: "",
  volume: null,
  difficulty: null,
  searchIntent: null,
});

const isSaving = ref(false);
const isImporting = ref(false);
const isCopyingCsvTemplate = ref(false);
const feedbackMessage = ref("");
const feedbackTone = ref<"info" | "success" | "warning" | "error">("info");
const importSummaryMessage = ref("");
const isDropZoneActive = ref(false);
const dragDepth = ref(0);
const csvFileInput = ref<HTMLInputElement | null>(null);
const importProgress = reactive<KeywordImportProgress>({
  total: 0,
  processed: 0,
  createdKeywords: 0,
  existingKeywords: 0,
  skippedKeywords: 0,
  currentKeyword: "",
});

const importProgressPercent = computed(() =>
  importProgress.total
    ? Math.round((importProgress.processed / importProgress.total) * 100)
    : 0,
);

const isBusy = computed(() => isSaving.value || isImporting.value);
const canClose = computed(() => !isBusy.value);
const importHasFinished = computed(
  () => !isImporting.value && !!importSummaryMessage.value,
);

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      return;
    }

    resetState();
  },
);

function closeModal(force = false) {
  if (!force && !canClose.value) {
    return;
  }

  emit("update:open", false);
}

function resetState() {
  form.keyword = "";
  form.volume = null;
  form.difficulty = null;
  form.searchIntent = null;
  isSaving.value = false;
  isImporting.value = false;
  isCopyingCsvTemplate.value = false;
  feedbackMessage.value = "";
  feedbackTone.value = "info";
  importSummaryMessage.value = "";
  resetImportProgress();
  resetDropZoneState();
}

function resetImportProgress() {
  importProgress.total = 0;
  importProgress.processed = 0;
  importProgress.createdKeywords = 0;
  importProgress.existingKeywords = 0;
  importProgress.skippedKeywords = 0;
  importProgress.currentKeyword = "";
}

function normalizeCsvValue(value: string) {
  return value
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .trim();
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let currentValue = "";
  let isInsideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (isInsideQuotes && nextChar === '"') {
        currentValue += '"';
        index += 1;
      } else {
        isInsideQuotes = !isInsideQuotes;
      }
      continue;
    }

    if (char === "," && !isInsideQuotes) {
      values.push(currentValue);
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  values.push(currentValue);

  return values.map(normalizeCsvValue);
}

function parseKeywordsCsv(rawCsv: string) {
  const lines = rawCsv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("Le fichier CSV est vide.");
  }

  const headers = parseCsvLine(lines[0]).map((header) =>
    normalizeSearchText(header),
  );
  const expectedHeaders = ["keyword", "volume", "difficulty", "searchintent"];

  if (
    headers.length !== expectedHeaders.length ||
    !expectedHeaders.every((header, index) => headers[index] === header)
  ) {
    throw new Error(
      "Le CSV doit avoir exactement les colonnes : keyword,volume,difficulty,searchIntent",
    );
  }

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);

    if (values.length !== expectedHeaders.length) {
      throw new Error(`La ligne ${index + 2} ne contient pas 4 colonnes.`);
    }

    return {
      keyword: values[0] || "",
      volume: values[1] || "",
      difficulty: values[2] || "",
      searchIntent: values[3] || "",
    };
  });
}

function normalizeNullableNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  }

  if (!value?.toString().trim()) {
    return null;
  }

  const parsedValue = Number.parseInt(value.toString().trim(), 10);

  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null;
}

function normalizeDifficulty(value: string | number | null | undefined) {
  const normalizedValue = normalizeNullableNumber(value);

  if (normalizedValue === null) {
    return null;
  }

  if (normalizedValue > 100) {
    throw new Error("La difficulté doit être comprise entre 0 et 100.");
  }

  return normalizedValue;
}

function normalizeSearchIntent(value: string) {
  const normalizedValue = value.trim().toUpperCase();

  if (!normalizedValue) {
    return null;
  }

  return (
    keywordIntentOptions.find((option) => option.value === normalizedValue)
      ?.value ?? null
  );
}

function handleDropZoneDragEnter() {
  dragDepth.value += 1;
  isDropZoneActive.value = true;
}

function handleDropZoneDragLeave() {
  dragDepth.value = Math.max(0, dragDepth.value - 1);

  if (!dragDepth.value) {
    isDropZoneActive.value = false;
  }
}

function resetDropZoneState() {
  dragDepth.value = 0;
  isDropZoneActive.value = false;
}

function openCsvFilePicker() {
  if (isBusy.value) {
    return;
  }

  csvFileInput.value?.click();
}

function handleCsvFileSelected(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];

  if (input) {
    input.value = "";
  }

  if (!file) {
    return;
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    feedbackTone.value = "warning";
    feedbackMessage.value = "Choisis un fichier CSV au format attendu.";
    return;
  }

  void importKeywordsFromCsv(file);
}

async function submitForm(options?: { analyzeAfterSave?: boolean }) {
  if (isBusy.value || !form.keyword?.trim()) {
    return;
  }

  isSaving.value = true;
  feedbackMessage.value = "";
  feedbackTone.value = "info";

  try {
    const normalizedKeyword = form.keyword.trim();
    const analyzeAfterSave = options?.analyzeAfterSave ?? false;

    if (
      props.existingKeywords.some(
        (keyword) =>
          normalizeSearchText(keyword) === normalizeSearchText(normalizedKeyword),
      )
    ) {
      if (analyzeAfterSave) {
        emit("imported");
        closeModal(true);
        emit("analyze-requested", normalizedKeyword);
        return;
      }

      feedbackTone.value = "warning";
      feedbackMessage.value = "Ce mot-clé existe déjà.";
      return;
    }

    await upsertKeyword({
      keyword: normalizedKeyword,
      volume: normalizeNullableNumber(form.volume),
      difficulty: normalizeDifficulty(form.difficulty),
      searchIntent: form.searchIntent ?? null,
    });
    emit("imported");
    if (analyzeAfterSave) {
      closeModal(true);
      emit("analyze-requested", normalizedKeyword);
      return;
    }

    closeModal(true);
  } catch (error) {
    feedbackTone.value = "error";
    feedbackMessage.value =
      error instanceof Error
        ? error.message
        : "Impossible d’ajouter le mot-clé.";
  } finally {
    isSaving.value = false;
  }
}

async function importKeywordsFromCsv(file: File) {
  if (isBusy.value) {
    return;
  }

  isImporting.value = true;
  feedbackMessage.value = "";
  feedbackTone.value = "info";
  importSummaryMessage.value = "";
  resetImportProgress();

  try {
    const rawCsv = await file.text();
    const rows = parseKeywordsCsv(rawCsv);
    const existingKeywords = new Set(
      props.existingKeywords.map((keyword) => normalizeSearchText(keyword)),
    );

    importProgress.total = rows.length;

    for (const row of rows) {
      const keyword = row.keyword.trim();
      importProgress.currentKeyword = keyword || "Ligne sans mot-clé";

      if (!keyword) {
        importProgress.skippedKeywords += 1;
        importProgress.processed += 1;
        continue;
      }

      const normalizedSearchIntent = normalizeSearchIntent(row.searchIntent);

      if (row.searchIntent.trim() && !normalizedSearchIntent) {
        throw new Error(
          `Search intent invalide pour « ${keyword} » : ${row.searchIntent}`,
        );
      }

      const keywordKey = normalizeSearchText(keyword);
      const alreadyExists = existingKeywords.has(keywordKey);

      if (alreadyExists) {
        importProgress.existingKeywords += 1;
        importProgress.processed += 1;
        continue;
      }

      await upsertKeyword({
        keyword,
        volume: normalizeNullableNumber(row.volume),
        difficulty: normalizeDifficulty(row.difficulty),
        searchIntent: normalizedSearchIntent,
      });

      importProgress.createdKeywords += 1;
      existingKeywords.add(keywordKey);

      importProgress.processed += 1;
    }

    const summaryParts = [
      `${importProgress.createdKeywords} mot(s)-clé(s) créé(s)`,
    ];

    if (importProgress.existingKeywords) {
      summaryParts.push(
        `${importProgress.existingKeywords} mot(s)-clé(s) déjà présents`,
      );
    }

    if (importProgress.skippedKeywords) {
      summaryParts.push(
        `${importProgress.skippedKeywords} ligne(s) ignorée(s)`,
      );
    }

    importSummaryMessage.value = `${summaryParts.join(" • ")}.`;
    emit("imported");
  } catch (error) {
    feedbackTone.value = "error";
    feedbackMessage.value =
      error instanceof Error ? error.message : "Impossible d’importer le CSV.";
  } finally {
    isImporting.value = false;
    importProgress.currentKeyword = "";
    resetDropZoneState();
  }
}

async function handleDropZoneDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0];

  resetDropZoneState();

  if (!file) {
    return;
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    feedbackTone.value = "warning";
    feedbackMessage.value = "Dépose un fichier CSV au format attendu.";
    return;
  }

  await importKeywordsFromCsv(file);
}

async function copyCsvTemplateToClipboard() {
  if (isCopyingCsvTemplate.value) {
    return;
  }

  isCopyingCsvTemplate.value = true;

  try {
    await navigator.clipboard.writeText(csvTemplateHeader);
    showSuccessToast(
      "Structure CSV copiée",
      "Tu peux maintenant la coller ailleurs.",
    );
  } catch {
    showWarningToast(
      "Copie impossible",
      "Copie manuellement la structure affichée.",
    );
  } finally {
    isCopyingCsvTemplate.value = false;
  }
}
</script>

<template>
  <UModal
    :open="open"
    :dismissible="canClose"
    :ui="{ content: 'sm:max-w-3xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="rounded-3xl bg-white p-6 shadow-xl">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <h2 class="text-xl font-semibold text-slate-900">
              Ajouter des mots-clés
            </h2>
            <p class="text-sm leading-6 text-slate-500">
              Ajoute un mot-clé manuellement ou dépose un CSV au format .
              <UButton
                color="neutral"
                variant="soft"
                size="xs"
                icon="i-lucide-copy"
                :loading="isCopyingCsvTemplate"
                @click="copyCsvTemplateToClipboard"
              >
                <!-- Copier la structure -->
                <code class="px-1.5 py-0.5 text-slate-700">
                  {{ csvTemplateHeader }}
                </code>
              </UButton>
            </p>
          </div>

          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            :disabled="!canClose"
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

        <div class="mt-5 space-y-5">
          <div
            class="rounded-2xl border border-dashed px-5 py-6 transition"
            :class="
              isDropZoneActive
                ? 'border-sky-300 bg-sky-50'
                : 'border-slate-200 bg-slate-50/70'
            "
            role="button"
            tabindex="0"
            :aria-disabled="isBusy"
            @click="openCsvFilePicker"
            @keydown.enter.prevent="openCsvFilePicker"
            @keydown.space.prevent="openCsvFilePicker"
            @dragenter.prevent="handleDropZoneDragEnter"
            @dragover.prevent="isDropZoneActive = true"
            @dragleave.prevent="handleDropZoneDragLeave"
            @drop.prevent="handleDropZoneDrop"
          >
            <div class="flex flex-col items-center justify-center text-center">
              <UIcon
                name="i-lucide-file-down"
                class="h-10 w-10"
                :class="isDropZoneActive ? 'text-sky-600' : 'text-slate-400'"
              />
              <p class="mt-3 text-base font-semibold text-slate-900">
                Dépose ton CSV ici
              </p>
              <p class="mt-2 max-w-lg text-sm leading-6 text-slate-500">
                Chaque ligne sera importée une par une pour afficher la
                progression.
              </p>
              <p class="mt-3 text-xs text-slate-400">
                Clique ici pour ouvrir un fichier CSV, ou glisse-le dans la zone.
              </p>
            </div>
          </div>

          <div
            v-if="isImporting || importHasFinished"
            class="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 shadow-sm"
          >
            <div class="space-y-4">
              <p class="text-sm font-semibold text-sky-900">
                {{ isImporting ? "Import CSV en cours" : "Import CSV terminé" }}
              </p>

              <ImportsImportProgressBar
                v-if="isImporting"
                :processed="importProgress.processed"
                :total="importProgress.total"
                :percent="importProgressPercent"
                current-label="Traitement"
                :current-value="importProgress.currentKeyword"
              />

              <p v-else class="text-sm text-sky-700">
                {{ importSummaryMessage }}
              </p>

              <div class="flex flex-wrap gap-2 text-xs text-sky-800">
                <span class="rounded-full bg-white/70 px-3 py-1">
                  Créés : {{ importProgress.createdKeywords }}
                </span>
                <span class="rounded-full bg-white/70 px-3 py-1">
                  Déjà présents : {{ importProgress.existingKeywords }}
                </span>
                <span class="rounded-full bg-white/70 px-3 py-1">
                  Ignorés : {{ importProgress.skippedKeywords }}
                </span>
              </div>

              <div v-if="importHasFinished" class="flex justify-end">
                <UButton icon="i-lucide-check" @click="closeModal">
                  Fermer
                </UButton>
              </div>
            </div>
          </div>

          <div v-else class="rounded-2xl border border-slate-200 bg-white p-5">
            <div class="space-y-4">
              <div class="space-y-1">
                <h3 class="text-base font-semibold text-slate-900">
                  Ajout manuel
                </h3>
                <p class="text-sm text-slate-500">
                  Renseigne un mot-clé unique si tu ne veux pas passer par un
                  CSV.
                </p>
              </div>

              <label class="block space-y-2">
                <span class="text-sm font-medium text-slate-700">
                  Mot-clé <span class="text-red-500">*</span>
                </span>
                <input
                  v-model="form.keyword"
                  type="text"
                  placeholder="Ex: audit seo shopify"
                  class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>

              <div class="grid gap-4 md:grid-cols-3">
                <label class="block space-y-2">
                  <span class="text-sm font-medium text-slate-700">Volume</span>
                  <input
                    v-model="form.volume"
                    type="number"
                    min="0"
                    placeholder="Ex: 320"
                    class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>

                <label class="block space-y-2">
                  <span class="text-sm font-medium text-slate-700">
                    Difficulté
                  </span>
                  <input
                    v-model="form.difficulty"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Ex: 42"
                    class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>

                <label class="block space-y-2">
                  <span class="text-sm font-medium text-slate-700">
                    Search intent
                  </span>
                  <select
                    v-model="form.searchIntent"
                    class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  >
                    <option :value="null">Non renseigné</option>
                    <option
                      v-for="option in keywordIntentOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                </label>
              </div>

              <div class="flex flex-wrap justify-end gap-3">
                <UButton
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-search"
                  :loading="isSaving"
                  :disabled="!form.keyword.trim() || isImporting"
                  @click="submitForm({ analyzeAfterSave: true })"
                >
                  {{ isSaving ? "Enregistrement..." : "Ajouter puis analyser" }}
                </UButton>
                <UButton
                  icon="i-lucide-save"
                  :loading="isSaving"
                  :disabled="!form.keyword.trim() || isImporting"
                  @click="submitForm()"
                >
                  {{ isSaving ? "Enregistrement..." : "Ajouter le mot-clé" }}
                </UButton>
              </div>
            </div>
          </div>
        </div>

        <input
          ref="csvFileInput"
          type="file"
          accept=".csv,text/csv"
          class="hidden"
          @change="handleCsvFileSelected"
        />
      </div>
    </template>
  </UModal>
</template>
