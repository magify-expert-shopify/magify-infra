<script setup lang="ts">
import { keywordAnalysisModelOptions } from "~/constants/settings";
import type { PromptConfigSettings } from "~/types/settings";

const props = defineProps<{
  title: string;
  description: string;
  inputLabel?: string;
  inputPlaceholder: string;
  inputRows?: number;
  instructionsPlaceholder: string;
  instructionsRows?: number;
  inputVariables: string[];
  saveLabel: string;
  savingLabel: string;
  successMessage: string;
  idleMessage: string;
  loadSettings: () => Promise<PromptConfigSettings>;
  saveSettings: (
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) => Promise<PromptConfigSettings>;
}>();

const input = ref("");
const savedInput = ref("");
const instructions = ref("");
const savedInstructions = ref("");
const model = ref("");
const savedModel = ref("");
const maxOutputTokens = ref(0);
const savedMaxOutputTokens = ref(0);
const isLoading = ref(true);
const isSaving = ref(false);
const feedbackMessage = ref("");

const availableModelOptions = computed(() => {
  const options = [...keywordAnalysisModelOptions];

  if (model.value && !options.some((option) => option.value === model.value)) {
    options.unshift({
      value: model.value,
      label: `Modèle actuel: ${model.value}`,
    });
  }

  return options;
});

const hasChanges = computed(
  () =>
    input.value.trim() !== savedInput.value.trim() ||
    instructions.value.trim() !== savedInstructions.value.trim() ||
    model.value.trim() !== savedModel.value.trim() ||
    maxOutputTokens.value !== savedMaxOutputTokens.value,
);

async function loadPromptSettings() {
  isLoading.value = true;
  feedbackMessage.value = "";

  try {
    const settings = await props.loadSettings();
    input.value = settings.input;
    savedInput.value = settings.input;
    instructions.value = settings.instructions;
    savedInstructions.value = settings.instructions;
    model.value = settings.model;
    savedModel.value = settings.model;
    maxOutputTokens.value = settings.maxOutputTokens;
    savedMaxOutputTokens.value = settings.maxOutputTokens;
  } finally {
    isLoading.value = false;
  }
}

async function savePrompt() {
  if (isSaving.value) {
    return;
  }

  isSaving.value = true;
  feedbackMessage.value = "";

  try {
    const response = await props.saveSettings(
      input.value,
      instructions.value,
      model.value,
      maxOutputTokens.value,
    );
    input.value = response.input;
    savedInput.value = response.input;
    instructions.value = response.instructions;
    savedInstructions.value = response.instructions;
    model.value = response.model;
    savedModel.value = response.model;
    maxOutputTokens.value = response.maxOutputTokens;
    savedMaxOutputTokens.value = response.maxOutputTokens;
    feedbackMessage.value = props.successMessage;
  } finally {
    isSaving.value = false;
  }
}

onMounted(() => {
  void loadPromptSettings();
});
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex flex-col gap-4">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-slate-900">
          {{ title }}
        </h2>
        <p class="text-sm leading-6 text-slate-500">
          {{ description }}
        </p>
      </div>

      <div
        v-if="isLoading"
        class="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500"
      >
        Chargement du prompt...
      </div>

      <template v-else>
        <label class="block text-sm font-medium text-slate-700">
          <span class="mb-2 block">
            Modèle ChatGPT <span class="text-red-500">*</span>
          </span>

          <select
            v-model="model"
            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
          >
            <option
              v-for="option in availableModelOptions"
              :key="option.value"
              :value="option.value"
              :class="option.deprecated ? 'text-amber-700' : ''"
            >
              {{ option.label }}{{ option.deprecated ? " (déprécié)" : "" }}
            </option>
          </select>
        </label>

        <label class="block text-sm font-medium text-slate-700">
          <span class="mb-2 block">
            Max output tokens <span class="text-red-500">*</span>
          </span>

          <input
            v-model.number="maxOutputTokens"
            type="number"
            min="1"
            step="1"
            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
            placeholder="500"
          />
        </label>

        <label class="block text-sm font-medium text-slate-700">
          <span class="mb-2 block">
            Instructions système <span class="text-red-500">*</span>
          </span>

          <textarea
            v-model="instructions"
            :rows="instructionsRows ?? 6"
            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-6 text-slate-800 shadow-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
            :placeholder="instructionsPlaceholder"
          />
        </label>

        <label class="block text-sm font-medium text-slate-700">
          <span class="mb-2 block">
            {{ inputLabel || "Template d’input" }}
            <span class="text-red-500">*</span>
          </span>

          <p class="mb-2 text-sm font-normal leading-6 text-slate-500">
            Variables disponibles :
            <template
              v-for="(variableName, index) in inputVariables"
              :key="variableName"
            >
              <code class="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                {{ variableName }}
              </code>
              <span v-if="index < inputVariables.length - 1">, </span>
            </template>
          </p>

          <textarea
            v-model="input"
            :rows="inputRows ?? 14"
            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-6 text-slate-800 shadow-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
            :placeholder="inputPlaceholder"
          />
        </label>

        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="text-sm text-slate-500">
            {{ feedbackMessage || idleMessage }}
          </p>

          <UButton
            icon="i-lucide-save"
            :loading="isSaving"
            :disabled="
            !input.trim() ||
            !instructions.trim() ||
            !model.trim() ||
            !maxOutputTokens ||
            !hasChanges
          "
            @click="savePrompt"
          >
            {{ isSaving ? savingLabel : saveLabel }}
          </UButton>
        </div>
      </template>
    </div>
  </div>
</template>
