<script setup lang="ts">
import { defaultKeywordVolumeThresholds } from "~/constants/keyword-volume";
import type { KeywordVolumeThresholdsSettings } from "~/types/settings";

const { getKeywordVolumeThresholds, updateKeywordVolumeThresholds } =
  useSettings();

const thresholds = ref<KeywordVolumeThresholdsSettings>({
  ...defaultKeywordVolumeThresholds,
});
const savedThresholds = ref<KeywordVolumeThresholdsSettings>({
  ...defaultKeywordVolumeThresholds,
});
const isLoading = ref(true);
const isSaving = ref(false);
const feedbackMessage = ref("");

const hasChanges = computed(
  () => JSON.stringify(thresholds.value) !== JSON.stringify(savedThresholds.value),
);

const mediumMin = computed(() => thresholds.value.lowMax + 1);

async function loadKeywordVolumeThresholds() {
  isLoading.value = true;

  try {
    const response = await getKeywordVolumeThresholds();
    thresholds.value = { ...response };
    savedThresholds.value = { ...response };
  } finally {
    isLoading.value = false;
  }
}

function resetDefaults() {
  thresholds.value = { ...defaultKeywordVolumeThresholds };
}

async function saveThresholds() {
  if (isSaving.value) {
    return;
  }

  isSaving.value = true;
  feedbackMessage.value = "";

  try {
    const response = await updateKeywordVolumeThresholds(thresholds.value);
    thresholds.value = { ...response };
    savedThresholds.value = { ...response };
    feedbackMessage.value = "Seuils de volume enregistrés.";
  } finally {
    isSaving.value = false;
  }
}

onMounted(() => {
  void loadKeywordVolumeThresholds();
});
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex flex-col gap-4">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-slate-900">Seuils de volume</h2>
        <p class="text-sm leading-6 text-slate-500">
          Définissez quand un volume est considéré comme faible, moyen ou fort.
          Exemple :
          <span class="font-medium text-slate-700">Fort &gt;= 1001</span>.
        </p>
      </div>

      <div
        v-if="isLoading"
        class="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500"
      >
        Chargement des seuils de volume...
      </div>

      <template v-else>
        <div class="grid gap-4 lg:grid-cols-3">
          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700">Faible max</span>
            <input
              v-model.number="thresholds.lowMax"
              type="number"
              min="0"
              class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
            <p class="text-xs text-slate-500">
              Faible :
              <span class="font-medium text-slate-700">
                &lt;= {{ thresholds.lowMax }}
              </span>
            </p>
          </label>

          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700">Moyen max</span>
            <input
              v-model.number="thresholds.mediumMax"
              type="number"
              :min="mediumMin"
              class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
            <p class="text-xs text-slate-500">
              Moyen :
              <span class="font-medium text-slate-700">
                {{ mediumMin }} à {{ thresholds.mediumMax }}
              </span>
            </p>
          </label>

          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700">Fort min</span>
            <input
              v-model.number="thresholds.highMin"
              type="number"
              :min="thresholds.mediumMax + 1"
              class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
            <p class="text-xs text-slate-500">
              Fort :
              <span class="font-medium text-slate-700">
                &gt;= {{ thresholds.highMin }}
              </span>
            </p>
          </label>
        </div>

        <div class="flex flex-wrap gap-3">
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
              "Les seuils sont normalisés automatiquement pour éviter les chevauchements."
            }}
          </p>

          <UButton
            icon="i-lucide-save"
            :loading="isSaving"
            :disabled="!hasChanges"
            @click="saveThresholds"
          >
            {{ isSaving ? "Enregistrement..." : "Enregistrer les seuils" }}
          </UButton>
        </div>
      </template>
    </div>
  </div>
</template>
