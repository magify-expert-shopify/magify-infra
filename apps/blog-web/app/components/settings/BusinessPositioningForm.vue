<script setup lang="ts">
import type {
  BusinessPositioningKeyword,
  BusinessPositioningSettings,
} from "~/types/settings";
import { buildKeywordResearchUrl } from "~/utils/keyword-research-url";

const props = withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    allowPrefill?: boolean;
    allowExtractKeywords?: boolean;
    submitLabel?: string;
    savingLabel?: string;
    idleMessage?: string;
    successMessage?: string;
  }>(),
  {
    title: "Positionnement business",
    description:
      "Décrivez votre offre, vos différenciateurs et les problèmes que vous résolvez.",
    allowPrefill: true,
    allowExtractKeywords: false,
    submitLabel: "Enregistrer",
    savingLabel: "Enregistrement...",
    idleMessage: "Ces réponses servent de base pour mieux guider le produit.",
    successMessage: "Réponses enregistrées.",
  },
);

const emit = defineEmits<{
  saved: [value: BusinessPositioningSettings];
}>();

const {
  getBusinessPositioning,
  extractBusinessPositioningKeywords,
  prefillBusinessPositioningFromWebsite,
  updateBusinessPositioning,
  updateBusinessPositioningAnswersOnly,
} = useSettings();

const businessPositioningState = useState<BusinessPositioningSettings | null>(
  "business-positioning",
  () => null,
);

const websiteUrl = ref("");
const savedWebsiteUrl = ref("");
const offering = ref("");
const differentiator = ref("");
const problemsSolved = ref("");
const savedOffering = ref("");
const savedDifferentiator = ref("");
const savedProblemsSolved = ref("");
const extractedKeywords = ref<BusinessPositioningKeyword[]>([]);
const isLoading = ref(true);
const isSaving = ref(false);
const isSavingWithoutExtraction = ref(false);
const isExtractingKeywords = ref(false);
const isPrefilling = ref(false);
const feedbackMessage = ref("");
const openQuestionKey = ref<"offering" | "differentiator" | "problemsSolved">(
  "offering",
);

const hasChanges = computed(
  () =>
    websiteUrl.value.trim() !== savedWebsiteUrl.value.trim() ||
    offering.value.trim() !== savedOffering.value.trim() ||
    differentiator.value.trim() !== savedDifferentiator.value.trim() ||
    problemsSolved.value.trim() !== savedProblemsSolved.value.trim(),
);

const questionSections = computed(() => [
  {
    key: "offering" as const,
    title: "Qu’est-ce que vous vendez, précisément ?",
    placeholder:
      "Exemple: on vend un accompagnement SEO ecommerce pour les boutiques Shopify...",
    model: offering,
    rows: 9,
  },
  {
    key: "differentiator" as const,
    title: "Qu’est-ce que vous faites de mieux que vos concurrents ?",
    placeholder:
      "Exemple: on va plus vite à la mise en ligne, on travaille les clusters SEO de bout en bout...",
    model: differentiator,
    rows: 6,
  },
  {
    key: "problemsSolved" as const,
    title: "Quels problèmes résolvez-vous ?",
    placeholder:
      "Exemple: manque de trafic qualifié, retard éditorial, faible conversion SEO...",
    model: problemsSolved,
    rows: 12,
  },
]);

function toggleQuestionSection(
  key: "offering" | "differentiator" | "problemsSolved",
) {
  openQuestionKey.value = openQuestionKey.value === key ? key : key;
}

async function loadBusinessPositioning() {
  isLoading.value = true;
  feedbackMessage.value = "";

  try {
    const response =
      businessPositioningState.value ?? (await getBusinessPositioning());

    businessPositioningState.value = response;
    websiteUrl.value = response.websiteUrl;
    savedWebsiteUrl.value = response.websiteUrl;
    offering.value = response.offering;
    differentiator.value = response.differentiator;
    problemsSolved.value = response.problemsSolved;
    savedOffering.value = response.offering;
    savedDifferentiator.value = response.differentiator;
    savedProblemsSolved.value = response.problemsSolved;
    extractedKeywords.value = response.keywords;
  } finally {
    isLoading.value = false;
  }
}

async function saveBusinessPositioning() {
  if (isSaving.value || isSavingWithoutExtraction.value) {
    return;
  }

  isSaving.value = true;
  feedbackMessage.value = "";

  try {
    const response = await updateBusinessPositioning(
      websiteUrl.value,
      offering.value,
      differentiator.value,
      problemsSolved.value,
    );

    businessPositioningState.value = response;
    websiteUrl.value = response.websiteUrl;
    savedWebsiteUrl.value = response.websiteUrl;
    offering.value = response.offering;
    differentiator.value = response.differentiator;
    problemsSolved.value = response.problemsSolved;
    savedOffering.value = response.offering;
    savedDifferentiator.value = response.differentiator;
    savedProblemsSolved.value = response.problemsSolved;
    extractedKeywords.value = response.keywords;
    feedbackMessage.value = props.successMessage;
    emit("saved", response);
  } finally {
    isSaving.value = false;
  }
}

async function saveBusinessPositioningWithoutExtraction() {
  if (isSaving.value || isSavingWithoutExtraction.value || isExtractingKeywords.value) {
    return;
  }

  isSavingWithoutExtraction.value = true;
  feedbackMessage.value = "";

  try {
    const response = await updateBusinessPositioningAnswersOnly(
      websiteUrl.value,
      offering.value,
      differentiator.value,
      problemsSolved.value,
    );

    businessPositioningState.value = response;
    websiteUrl.value = response.websiteUrl;
    savedWebsiteUrl.value = response.websiteUrl;
    offering.value = response.offering;
    differentiator.value = response.differentiator;
    problemsSolved.value = response.problemsSolved;
    savedOffering.value = response.offering;
    savedDifferentiator.value = response.differentiator;
    savedProblemsSolved.value = response.problemsSolved;
    extractedKeywords.value = response.keywords;
    feedbackMessage.value = "Réponses enregistrées sans relancer l’extraction.";
    emit("saved", response);
  } finally {
    isSavingWithoutExtraction.value = false;
  }
}

async function extractKeywordsOnly() {
  if (
    isSaving.value ||
    isSavingWithoutExtraction.value ||
    isExtractingKeywords.value
  ) {
    return;
  }

  if (
    !offering.value.trim() ||
    !differentiator.value.trim() ||
    !problemsSolved.value.trim()
  ) {
    feedbackMessage.value =
      "Complète les trois réponses avant de lancer l’extraction.";
    return;
  }

  isExtractingKeywords.value = true;
  feedbackMessage.value = "";

  try {
    const response = await extractBusinessPositioningKeywords(
      websiteUrl.value,
      offering.value,
      differentiator.value,
      problemsSolved.value,
    );

    extractedKeywords.value = response.keywords;
    feedbackMessage.value = "Mots-clés extraits.";
  } finally {
    isExtractingKeywords.value = false;
  }
}

async function prefillFromWebsite() {
  if (isPrefilling.value || !websiteUrl.value.trim()) {
    return;
  }

  isPrefilling.value = true;
  feedbackMessage.value = "";

  try {
    const response = await prefillBusinessPositioningFromWebsite(
      websiteUrl.value,
    );
    websiteUrl.value = response.websiteUrl;
    offering.value = response.offering;
    differentiator.value = response.differentiator;
    problemsSolved.value = response.problemsSolved;
    feedbackMessage.value = "Proposition pré-rédigée générée.";
  } finally {
    isPrefilling.value = false;
  }
}

onMounted(() => {
  void loadBusinessPositioning();
});
</script>

<template>
  <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div class="flex flex-col gap-5">
      <div class="space-y-1">
        <h2 class="text-xl font-semibold text-slate-900">
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
        Chargement de vos réponses...
      </div>

      <template v-else>
        <label class="block text-sm font-medium text-slate-700">
          <span class="mb-2 block"> Quelle est l’URL du site ? </span>

          <div class="flex flex-col gap-3 md:flex-row">
            <input
              v-model="websiteUrl"
              type="url"
              placeholder="https://www.votresite.com"
              class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
            />

            <UButton
              v-if="allowPrefill"
              color="primary"
              variant="soft"
              icon="i-lucide-sparkles"
              :loading="isPrefilling"
              :disabled="
                true || !websiteUrl.trim() || isSaving || isSavingWithoutExtraction
              "
              class="whitespace-nowrap"
              @click="prefillFromWebsite"
            >
              {{ isPrefilling ? "Pré-rédaction..." : "Pré-rédiger avec l’IA" }}
            </UButton>
          </div>
        </label>

        <div class="space-y-3">
          <article
            v-for="section in questionSections"
            :key="section.key"
            class="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
          >
            <button
              type="button"
              class="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-slate-100"
              @click="toggleQuestionSection(section.key)"
            >
              <div class="space-y-1">
                <p class="text-sm font-medium text-slate-800">
                  {{ section.title }}
                </p>
                <p class="text-xs text-slate-500">
                  {{
                    section.model.value.trim()
                      ? `${section.model.value.trim().length} caractères saisis`
                      : "Aucune réponse pour le moment"
                  }}
                </p>
              </div>

              <UIcon
                name="i-lucide-chevron-down"
                class="h-5 w-5 shrink-0 text-slate-500 transition"
                :class="
                  openQuestionKey === section.key ? 'rotate-180' : 'rotate-0'
                "
              />
            </button>

            <div
              v-if="openQuestionKey === section.key"
              class="border-t border-slate-200 bg-white px-4 py-4"
            >
              <label class="block text-sm font-medium text-slate-700">
                <textarea
                  v-model="section.model.value"
                  :rows="section.rows"
                  class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 shadow-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  :placeholder="section.placeholder"
                />
              </label>
            </div>
          </article>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div
            class="flex flex-wrap flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div class="space-y-1">
              <p class="text-sm font-medium text-slate-800">
                Mots-clés extraits automatiquement
              </p>
              <!-- <p class="text-sm text-slate-500">
                Mis à jour à chaque enregistrement pour résumer votre
                positionnement.
              </p> -->
            </div>

            <div class="flex flex-wrap gap-2">
              <NuxtLink
                v-for="keyword in extractedKeywords"
                :key="keyword.id"
                :to="
                  buildKeywordResearchUrl(keyword.keyword, {
                    autorun: false,
                    language: 'fr',
                    country: 'fr',
                  })
                "
                class="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800"
              >
                {{ keyword.keyword }}
              </NuxtLink>
              <span
                v-if="!extractedKeywords.length"
                class="text-sm text-slate-500"
              >
                Aucun mot-clé extrait pour le moment.
              </span>
            </div>
          </div>
        </div>

        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="text-sm text-slate-500">
            {{ feedbackMessage || idleMessage }}
          </p>

          <div class="flex flex-wrap justify-end gap-3">
            <UButton
              v-if="allowExtractKeywords"
              color="neutral"
              variant="soft"
              icon="i-lucide-scan-search"
              :loading="isExtractingKeywords"
              :disabled="
                !offering.trim() ||
                !differentiator.trim() ||
                !problemsSolved.trim() ||
                isSaving ||
                isSavingWithoutExtraction
              "
              @click="extractKeywordsOnly"
            >
              {{
                isExtractingKeywords
                  ? "Extraction..."
                  : "Extraire les mots-clés"
              }}
            </UButton>

            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-save"
              :loading="isSavingWithoutExtraction"
              :disabled="!hasChanges || isSaving"
              @click="saveBusinessPositioningWithoutExtraction"
            >
              {{
                isSavingWithoutExtraction
                  ? "Enregistrement..."
                  : "Enregistrer sans extraire"
              }}
            </UButton>

            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-save"
              :loading="isSaving"
              :disabled="!hasChanges || isSavingWithoutExtraction"
              @click="saveBusinessPositioning"
            >
              {{ isSaving ? savingLabel : submitLabel }}
            </UButton>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
