<script setup lang="ts">
import JsonCodeViewer from "~/components/editor/JsonCodeViewer.vue";
import {
  openAiPromptTypeColors,
  openAiPromptTypeLabels,
} from "~/constants/openai-prompt-types";

const { getOpenAiCache } = useSettings();

const ALL_PROMPT_TYPES = "__all__";
const promptTypeFilter = ref<OpenAiPromptType | typeof ALL_PROMPT_TYPES>(
  ALL_PROMPT_TYPES,
);
const currentPage = ref(1);
const pageSize = 10;

const { data, status, error, refresh } = await useAsyncData(
  "settings:openai-cache",
  () =>
    getOpenAiCache(
      promptTypeFilter.value === ALL_PROMPT_TYPES
        ? null
        : promptTypeFilter.value,
      {
        page: currentPage.value,
        pageSize,
      },
    ),
  {
    watch: [promptTypeFilter, currentPage],
  },
);

watch(promptTypeFilter, () => {
  currentPage.value = 1;
});

const pagination = computed(() => data.value?.pagination ?? null);

const entryRangeLabel = computed(() => {
  const total = pagination.value?.total ?? 0;
  if (!total) {
    return "0 entrée";
  }

  const start = ((pagination.value?.page ?? 1) - 1) * (pagination.value?.pageSize ?? pageSize) + 1;
  const end = Math.min(
    start + (pagination.value?.pageSize ?? pageSize) - 1,
    total,
  );

  return `${start} - ${end} / ${total} entrée${total > 1 ? "s" : ""}`;
});

const promptTypeOptions = computed(() => [
  {
    label: "Tous les prompts",
    value: ALL_PROMPT_TYPES,
  },
  ...Object.entries(openAiPromptTypeLabels).map(([value, label]) => ({
    label,
    value,
  })),
]);

function getPromptTypeColor(type: OpenAiPromptType) {
  return openAiPromptTypeColors[type] ?? openAiPromptTypeColors.OTHER;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Non disponible";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString("fr-FR");
}

function goToPreviousPage() {
  if (pagination.value?.hasPreviousPage) {
    currentPage.value = Math.max(1, currentPage.value - 1);
  }
}

function goToNextPage() {
  if (pagination.value?.hasNextPage) {
    currentPage.value += 1;
  }
}
</script>

<template>
  <section class="space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Cache IA
        </p>
        <h1 class="text-2xl font-semibold text-slate-900">
          Cache OpenAI
        </h1>
        <p class="text-sm text-slate-500">
          Inspecte les appels mis en cache, l’input envoyé, les instructions et
          la sortie réellement reçue.
        </p>
      </div>

      <div class="w-full max-w-sm">
        <USelect
          v-model="promptTypeFilter"
          :items="promptTypeOptions"
          value-key="value"
          label-key="label"
          size="lg"
        />
      </div>
    </header>

    <FeedbackInlineMessage
      v-if="status === 'pending'"
      class="animate-pulse"
      tone="info"
    >
      Chargement du cache OpenAI...
    </FeedbackInlineMessage>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :details="error.toString()"
      title="Impossible de charger le cache OpenAI"
      description="Les entrées de cache n’ont pas pu être récupérées."
      action-label="Réessayer"
      @action="refresh()"
    />

    <div v-else class="space-y-5">
      <div class="flex flex-wrap items-center gap-2">
        <UBadge color="neutral" variant="soft" class="rounded-full px-3 py-1">
          {{ entryRangeLabel }}
        </UBadge>
      </div>

      <div class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <p class="text-sm text-slate-600">
          Page {{ pagination?.page ?? 1 }} / {{ pagination?.totalPages ?? 1 }}
        </p>

        <div class="flex items-center gap-2">
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-chevron-left"
            :disabled="!(pagination?.hasPreviousPage ?? false)"
            @click="goToPreviousPage"
          >
            Précédent
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            trailing-icon="i-lucide-chevron-right"
            :disabled="!(pagination?.hasNextPage ?? false)"
            @click="goToNextPage"
          >
            Suivant
          </UButton>
        </div>
      </div>

      <div
        v-if="data?.entries.length"
        class="space-y-6"
      >
        <article
          v-for="entry in data?.entries"
          :key="entry.id"
          class="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  <span
                    class="h-2.5 w-2.5 rounded-full"
                    :class="getPromptTypeColor(entry.promptType)"
                  />
                  {{ entry.promptTypeLabel }}
                </span>
                <UBadge color="neutral" variant="soft" class="rounded-full">
                  {{ entry.model || "Modèle inconnu" }}
                </UBadge>
              </div>

              <div class="space-y-1 text-xs text-slate-500">
                <p>Endpoint: {{ entry.endpoint }}</p>
                <p>Mis à jour: {{ formatDateTime(entry.updatedAt) }}</p>
                <p>Dernière utilisation: {{ formatDateTime(entry.lastUsedAt) }}</p>
              </div>
            </div>
          </div>

          <div class="grid gap-4 xl:grid-cols-2">
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-2">
                <h2 class="text-sm font-semibold text-slate-900">Input</h2>
              </div>
              <pre
                class="min-h-[18rem] overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-700 whitespace-pre-wrap"
              >{{ entry.input || "Aucun input enregistré." }}</pre>
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between gap-2">
                <h2 class="text-sm font-semibold text-slate-900">Instructions</h2>
              </div>
              <pre
                class="min-h-[18rem] overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-700 whitespace-pre-wrap"
              >{{ entry.instructions || "Aucune instruction enregistrée." }}</pre>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-sm font-semibold text-slate-900">Output</h2>
              <UBadge color="neutral" variant="soft" class="rounded-full">
                {{ entry.output.format === "json" ? "JSON" : "Texte" }}
              </UBadge>
            </div>

            <JsonCodeViewer
              v-if="entry.output.format === 'json'"
              :value="entry.output.content"
            />

            <pre
              v-else
              class="min-h-[18rem] overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-700 whitespace-pre-wrap"
            >{{ entry.output.content || "Aucun output enregistré." }}</pre>
          </div>
        </article>
      </div>

      <FeedbackInlineMessage v-else tone="info">
        Aucune entrée de cache ne correspond à ce filtre.
      </FeedbackInlineMessage>
    </div>
  </section>
</template>
