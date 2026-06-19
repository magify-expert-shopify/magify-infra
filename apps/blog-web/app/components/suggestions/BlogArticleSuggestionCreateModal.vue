<script setup lang="ts">
import { pageTypeLabels } from "~/constants/pages";
import { useAppToast } from "~/composables/useAppToast";
import { usePages } from "~/composables/usePages";
import type { PageDetailRecord } from "~/types/pages";
import type { KeywordGroupSuggestionRecord } from "~/types/keywords";

const props = defineProps<{
  open: boolean;
  suggestion: KeywordGroupSuggestionRecord | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [page: PageDetailRecord];
}>();

const { createPageFromSuggestionGroup } = usePages();
const { showErrorToast } = useAppToast();

const isSubmitting = ref(false);
const subjectExact = ref("");
const primaryKeyword = ref("");
const secondaryKeywords = ref("");
const target = ref("Entrepreneuses et e-commerçantes débutantes");
const conversionObjective = ref(
  "Créer de la confiance, expliquer et faire passer à l'action",
);
const approxLength = ref("1200 mots");

const templateTypes = computed(() =>
  [
    ...new Set(
      (props.suggestion?.keywords ?? [])
        .map((keyword) => keyword.template)
        .filter(Boolean),
    ),
  ].filter((template): template is NonNullable<typeof template> =>
    Boolean(template),
  ),
);

const detectedPageTypeLabel = computed(() =>
  templateTypes.value.length
    ? pageTypeLabels[templateTypes.value[0]]
    : "Type de page non déterminé",
);

function getSuggestionKeywords() {
  return Array.isArray(props.suggestion?.keywords)
    ? props.suggestion.keywords
    : [];
}

function getDefaultApproxLength() {
  const primaryTemplateType = templateTypes.value[0];

  if (primaryTemplateType === "DEFINITION") {
    return "300 mots maximum";
  }

  if (primaryTemplateType === "GUIDE") {
    return "Minimum 2 000 mots";
  }

  return "1200 mots";
}

function buildDefaultFields() {
  const suggestion = props.suggestion;

  if (!suggestion) {
    return;
  }

  const keywords = getSuggestionKeywords();
  const normalizedPrimaryKeyword =
    suggestion.primaryKeyword?.trim() ||
    keywords[0]?.keyword?.trim() ||
    "";

  subjectExact.value = suggestion.description?.trim() || suggestion.name.trim();
  primaryKeyword.value = normalizedPrimaryKeyword;
  secondaryKeywords.value = keywords
    .map((keyword) => keyword.keyword.trim())
    .filter((keyword) => keyword && keyword !== normalizedPrimaryKeyword)
    .join(", ");
  target.value = "Entrepreneuses et e-commerçantes débutantes";
  conversionObjective.value =
    "Créer de la confiance, expliquer et faire passer à l'action";
  approxLength.value = getDefaultApproxLength();
}

watch(
  () => [props.open, props.suggestion?.id],
  ([open]) => {
    if (open) {
      buildDefaultFields();
    }
  },
  { immediate: true },
);

function closeModal() {
  emit("update:open", false);
}

async function handleCreatePage() {
  if (!props.suggestion) {
    return;
  }

  try {
    isSubmitting.value = true;

    const page = await createPageFromSuggestionGroup(props.suggestion.id, {
      subjectExact: subjectExact.value,
      primaryKeyword: primaryKeyword.value,
      secondaryKeywords: secondaryKeywords.value,
      target: target.value,
      conversionObjective: conversionObjective.value,
      approxLength: approxLength.value,
    });

    emit("created", page);
    closeModal();
  } catch (error) {
    showErrorToast(
      "Impossible de créer la page",
      error instanceof Error
        ? error.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <UModal
    :open="open"
    :ui="{ content: 'sm:max-w-5xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div
        class="max-h-[90vh] overflow-y-auto rounded-3xl bg-gradient-to-br from-white to-slate-50 p-6 shadow-xl"
      >
        <div class="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div class="space-y-2">
            <div class="space-y-1">
              <h2 class="text-xl font-semibold text-slate-900">
                Créer une page à partir de cette suggestion
              </h2>
              <p class="max-w-3xl text-sm leading-6 text-slate-500">
                Complète les informations de base avant de générer le contenu
                et de l’associer au groupe.
              </p>
            </div>

            <div v-if="templateTypes.length" class="flex flex-wrap gap-2">
              <UBadge
                v-for="template in templateTypes"
                :key="template"
                color="info"
                variant="soft"
              >
                {{ pageTypeLabels[template] }}
              </UBadge>
            </div>
          </div>

          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-x"
            @click="closeModal"
          />
        </div>

        <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
          <div class="space-y-6">
            <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div class="mb-4 space-y-1">
                <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  Brief de contenu
                </h3>
                <p class="text-sm text-slate-500">
                  Décris ici le sujet exact et l’objectif du contenu.
                </p>
              </div>

              <div class="space-y-4">
                <label class="block space-y-2">
                  <span class="text-sm font-medium text-slate-700">
                    Sujet exact
                  </span>
                  <UTextarea
                    v-model="subjectExact"
                    :rows="4"
                    autoresize
                    class="w-full"
                    placeholder="Sujet exact de l’article"
                  />
                </label>

                <label class="block space-y-2">
                  <span class="text-sm font-medium text-slate-700">
                    Objectif de conversion
                  </span>
                  <UTextarea
                    v-model="conversionObjective"
                    :rows="4"
                    autoresize
                    class="w-full"
                    placeholder="Créer de la confiance, expliquer et faire passer à l'action"
                  />
                </label>
              </div>
            </section>

            <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div class="mb-4 space-y-1">
                <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  Réglages SEO
                </h3>
                <p class="text-sm text-slate-500">
                  Les informations qui guideront la génération du contenu.
                </p>
              </div>

              <div class="grid gap-4 md:grid-cols-2">
                <label class="block space-y-2">
                  <span class="text-sm font-medium text-slate-700">
                    Mot-clé principal
                  </span>
                  <UInput
                    v-model="primaryKeyword"
                    class="w-full"
                    placeholder="Mot-clé principal"
                  />
                </label>

                <label class="block space-y-2">
                  <span class="text-sm font-medium text-slate-700">
                    Cible
                  </span>
                  <UInput
                    v-model="target"
                    class="w-full"
                    placeholder="Entrepreneuses et e-commerçantes débutantes"
                  />
                </label>

                <label class="block space-y-2 md:col-span-2">
                  <span class="text-sm font-medium text-slate-700">
                    Mots-clés secondaires
                  </span>
                  <UTextarea
                    v-model="secondaryKeywords"
                    :rows="4"
                    autoresize
                    class="w-full"
                    placeholder="Mot-clé secondaire 1, mot-clé secondaire 2"
                  />
                </label>

                <label class="block space-y-2 md:col-span-2">
                  <span class="text-sm font-medium text-slate-700">
                    Longueur approximative
                  </span>
                  <UInput
                    v-model="approxLength"
                    class="w-full"
                    placeholder="1200 mots"
                  />
                </label>
              </div>
            </section>
          </div>

          <aside class="space-y-4">
            <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Type de page détecté
              </p>
              <p class="mt-2 text-sm font-medium text-slate-900">
                {{ detectedPageTypeLabel }}
              </p>
            </div>

            <div class="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Récapitulatif
              </p>

              <dl class="mt-4 space-y-4 text-sm">
                <div class="space-y-1">
                  <dt class="font-medium text-slate-700">Sujet exact</dt>
                  <dd class="text-slate-600">
                    {{ subjectExact || "-" }}
                  </dd>
                </div>

                <div class="space-y-1">
                  <dt class="font-medium text-slate-700">Mot-clé principal</dt>
                  <dd class="text-slate-600">
                    {{ primaryKeyword || "-" }}
                  </dd>
                </div>

                <div class="space-y-1">
                  <dt class="font-medium text-slate-700">Cible</dt>
                  <dd class="text-slate-600">
                    {{ target || "-" }}
                  </dd>
                </div>

                <div class="space-y-1">
                  <dt class="font-medium text-slate-700">
                    Objectif de conversion
                  </dt>
                  <dd class="text-slate-600">
                    {{ conversionObjective || "-" }}
                  </dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>

        <div
          class="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-end"
        >
          <UButton color="neutral" variant="soft" @click="closeModal">
            Annuler
          </UButton>

          <UButton
            color="primary"
            variant="solid"
            icon="i-lucide-file-plus-2"
            :loading="isSubmitting"
            @click="handleCreatePage"
          >
            Créer la page
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
