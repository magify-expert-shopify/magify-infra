<script setup lang="ts">
import { defaultKeywordDifficultyLevels } from "~/constants/keyword-difficulty";
import type { KeywordDifficultyLevel } from "~/types/settings";

const { getKeywordDifficultyLevels, updateKeywordDifficultyLevels } =
  useSettings();

const levels = ref<KeywordDifficultyLevel[]>([]);
const savedLevels = ref<KeywordDifficultyLevel[]>([]);
const isLoading = ref(true);
const isSaving = ref(false);
const feedbackMessage = ref("");

const hasChanges = computed(
  () => JSON.stringify(levels.value) !== JSON.stringify(savedLevels.value),
);

async function loadKeywordDifficultyLevels() {
  isLoading.value = true;

  try {
    const response = await getKeywordDifficultyLevels();
    levels.value = response.levels.map((level) => ({ ...level }));
    savedLevels.value = response.levels.map((level) => ({ ...level }));
  } finally {
    isLoading.value = false;
  }
}

function addLevel() {
  const previousLevel = levels.value.at(-1);

  levels.value = [
    ...levels.value,
    {
      label: "",
      maxScore: previousLevel ? Math.min(previousLevel.maxScore + 1, 100) : 100,
    },
  ];
}

function removeLevel(index: number) {
  levels.value = levels.value.filter((_, currentIndex) => currentIndex !== index);
}

function resetDefaults() {
  levels.value = defaultKeywordDifficultyLevels.map((level) => ({ ...level }));
}

async function saveLevels() {
  if (isSaving.value) {
    return;
  }

  isSaving.value = true;
  feedbackMessage.value = "";

  try {
    const response = await updateKeywordDifficultyLevels(levels.value);
    levels.value = response.levels.map((level) => ({ ...level }));
    savedLevels.value = response.levels.map((level) => ({ ...level }));
    feedbackMessage.value = "Niveaux de difficulté enregistrés.";
  } finally {
    isSaving.value = false;
  }
}

onMounted(() => {
  void loadKeywordDifficultyLevels();
});
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex flex-col gap-4">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-slate-900">
          Niveaux de difficulté
        </h2>
        <p class="text-sm leading-6 text-slate-500">
          Définissez les labels affichés selon la difficulté SEO. Exemple :
          <span class="font-medium text-slate-700">Très facile &lt;= 14</span>.
        </p>
      </div>

      <div
        v-if="isLoading"
        class="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500"
      >
        Chargement des niveaux de difficulté...
      </div>

      <template v-else>
        <div class="space-y-3">
          <article
            v-for="(level, index) in levels"
            :key="index"
            class="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_12rem_auto]"
          >
            <label class="block space-y-2">
              <span class="text-sm font-medium text-slate-700">Label</span>
              <input
                v-model="level.label"
                type="text"
                placeholder="Ex: Très facile"
                class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              />
            </label>

            <label class="block space-y-2">
              <span class="text-sm font-medium text-slate-700">Score max</span>
              <input
                v-model.number="level.maxScore"
                type="number"
                min="0"
                max="100"
                class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              />
            </label>

            <div class="flex items-end justify-end">
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                :disabled="levels.length <= 1"
                @click="removeLevel(index)"
              />
            </div>
          </article>
        </div>

        <div class="flex flex-wrap gap-3">
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-plus"
            @click="addLevel"
          >
            Ajouter un niveau
          </UButton>

          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-rotate-ccw"
            @click="resetDefaults"
          >
            Remettre les valeurs par défaut
          </UButton>
        </div>

        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="text-sm text-slate-500">
            {{
              feedbackMessage ||
              "Les plages sont triées automatiquement et la dernière monte toujours jusqu’à 100."
            }}
          </p>

          <UButton
            icon="i-lucide-save"
            :loading="isSaving"
            :disabled="!hasChanges"
            @click="saveLevels"
          >
            {{ isSaving ? "Enregistrement..." : "Enregistrer les niveaux" }}
          </UButton>
        </div>
      </template>
    </div>
  </div>
</template>
