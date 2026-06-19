<script setup lang="ts">
import { openAiPromptTypeColors } from "~/constants/openai-prompt-types";
import type { OpenAiPromptType } from "~/types/shared";
import type { OpenAiUsageRange } from "~/types/stats";

const { useOpenAiUsageData } = useStats();

const range = ref<OpenAiUsageRange>("30d");
const selectedPromptTypes = ref<OpenAiPromptType[]>([]);
const promptTypeFilterMode = ref<"all" | "custom">("all");
const rangeOptions = [
  { label: "7 jours", value: "7d" },
  { label: "30 jours", value: "30d" },
  { label: "90 jours", value: "90d" },
  { label: "180 jours", value: "180d" },
] as const;

const { data, error, status, refresh } = await useOpenAiUsageData(range);

watchEffect(() => {
  const promptTypes = data.value?.promptTypes ?? [];
  const availableTypes = promptTypes.map((item) => item.type);

  if (!availableTypes.length) {
    selectedPromptTypes.value = [];
    promptTypeFilterMode.value = "all";
    return;
  }

  if (promptTypeFilterMode.value === "all") {
    selectedPromptTypes.value = availableTypes;
    return;
  }

  selectedPromptTypes.value = selectedPromptTypes.value.filter((type) =>
    availableTypes.includes(type),
  );
});

const filteredEntries = computed(() => {
  const entries = data.value?.entries ?? [];

  if (!selectedPromptTypes.value.length) {
    return entries;
  }

  return entries.filter((entry) =>
    selectedPromptTypes.value.includes(entry.promptType),
  );
});

function getPromptTypeColor(type: string) {
  return (
    openAiPromptTypeColors[type as keyof typeof openAiPromptTypeColors] ??
    openAiPromptTypeColors.OTHER
  );
}

function togglePromptType(type: OpenAiPromptType) {
  if (selectedPromptTypes.value.includes(type)) {
    const next = selectedPromptTypes.value.filter((item) => item !== type);

    selectedPromptTypes.value = next.length ? next : [];
    promptTypeFilterMode.value = next.length
      ? selectedPromptTypes.value.length === (data.value?.promptTypes ?? []).length
        ? "all"
        : "custom"
      : "custom";
    return;
  }

  selectedPromptTypes.value = [...selectedPromptTypes.value, type];
  promptTypeFilterMode.value =
    selectedPromptTypes.value.length === (data.value?.promptTypes ?? []).length
      ? "all"
      : "custom";
}

function selectAllPromptTypes() {
  selectedPromptTypes.value = (data.value?.promptTypes ?? []).map(
    (item) => item.type,
  );
  promptTypeFilterMode.value = "all";
}

function clearPromptTypeSelection() {
  selectedPromptTypes.value = [];
  promptTypeFilterMode.value = "custom";
}
</script>

<template>
  <section class="space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Statistiques IA
        </p>
        <h1 class="text-2xl font-semibold text-slate-900">
          Usage des tokens OpenAI
        </h1>
        <p class="text-sm text-slate-500">
          Chaque point correspond à un appel OpenAI individuel.
        </p>
      </div>

      <div class="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
        <button
          v-for="option in rangeOptions"
          :key="option.value"
          type="button"
          class="rounded-xl px-3 py-2 text-sm font-medium transition"
          :class="
            range === option.value
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          "
          @click="range = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </header>

    <p v-if="status === 'pending'" class="text-sm text-slate-500">
      Chargement des statistiques OpenAI...
    </p>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :details="error.toString()"
      title="Impossible de charger les statistiques OpenAI"
      description="Les données d'usage des tokens n'ont pas pu être récupérées."
      action-label="Réessayer"
      @action="refresh"
    />

    <div v-else class="space-y-6">
      <div class="grid gap-4 md:grid-cols-4">
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tokens totaux
          </p>
          <p class="mt-2 text-2xl font-semibold text-slate-900">
            {{ data?.totals.totalTokens?.toLocaleString("fr-FR") ?? "0" }}
          </p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tokens entrée
          </p>
          <p class="mt-2 text-2xl font-semibold text-slate-900">
            {{ data?.totals.inputTokens?.toLocaleString("fr-FR") ?? "0" }}
          </p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tokens sortie
          </p>
          <p class="mt-2 text-2xl font-semibold text-slate-900">
            {{ data?.totals.outputTokens?.toLocaleString("fr-FR") ?? "0" }}
          </p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Appels
          </p>
          <p class="mt-2 text-2xl font-semibold text-slate-900">
            {{ data?.totals.calls?.toLocaleString("fr-FR") ?? "0" }}
          </p>
        </div>
      </div>

      <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-slate-900">
              Evolution des appels
            </h2>
            <p class="text-sm text-slate-500">
              La courbe représente chaque appel OpenAI tel qu'il a été enregistré.
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            <span
              v-for="item in data?.promptTypes ?? []"
              :key="item.type"
              class="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition"
              :class="
                selectedPromptTypes.includes(item.type)
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              "
              role="button"
              tabindex="0"
              @click="togglePromptType(item.type)"
              @keydown.enter.prevent="togglePromptType(item.type)"
              @keydown.space.prevent="togglePromptType(item.type)"
            >
              <span
                class="h-2.5 w-2.5 rounded-full"
                :class="
                  selectedPromptTypes.includes(item.type)
                    ? 'bg-white'
                    : getPromptTypeColor(item.type)
                "
              />
              {{ item.label }}
            </span>
          </div>
        </div>

        <div v-if="data?.entries?.length" class="mt-6 space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-check-check"
              @click="selectAllPromptTypes"
            >
              Tout afficher
            </UButton>
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              @click="clearPromptTypeSelection"
            >
              Réinitialiser
            </UButton>
            <p class="text-xs text-slate-500">
              {{ filteredEntries.length }} appel{{ filteredEntries.length > 1 ? "s" : "" }} affiché{{ filteredEntries.length > 1 ? "s" : "" }}
            </p>
          </div>

          <SettingsOpenAiUsageLineChart
            v-if="filteredEntries.length"
            :entries="filteredEntries"
          />

          <p v-else class="text-sm text-slate-400">
            Aucun appel ne correspond aux types sélectionnés.
          </p>
        </div>

        <p v-else class="mt-6 text-sm text-slate-400">
          Aucune donnée OpenAI disponible sur la période choisie.
        </p>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 class="text-base font-semibold text-slate-900">
            Répartition par prompt
          </h3>
          <div class="mt-4 space-y-3">
            <div
              v-for="item in data?.promptTypes ?? []"
              :key="item.type"
              class="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
            >
              <div class="flex items-center gap-3">
                <span class="h-3 w-3 rounded-full" :class="getPromptTypeColor(item.type)" />
                <div>
                  <p class="text-sm font-medium text-slate-900">
                    {{ item.label }}
                  </p>
                  <p class="text-xs text-slate-500">
                    {{ item.calls }} appel{{ item.calls > 1 ? "s" : "" }}
                  </p>
                </div>
              </div>
              <p class="text-sm font-semibold text-slate-900">
                {{ item.totalTokens.toLocaleString("fr-FR") }} tokens
              </p>
            </div>
          </div>
        </div>

        <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 class="text-base font-semibold text-slate-900">
            Lecture rapide
          </h3>
          <ul class="mt-4 space-y-3 text-sm text-slate-600">
            <li>
              Le graphique se base sur chaque appel OpenAI individuel, pas sur une moyenne.
            </li>
            <li>
              Le type de prompt est stocké en base pour suivre la consommation par flux métier et tu peux filtrer les données du graphe par type.
            </li>
            <li>
              La période est filtrable depuis le sélecteur en haut à droite.
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
