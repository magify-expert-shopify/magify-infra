<script setup lang="ts">
import type { ScanStepsSettingsResponse } from "~/types/site-settings";

const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();

const emptySettings: ScanStepsSettingsResponse = {
  steps: [],
};

function cloneScanStepsSettings(
  value: ScanStepsSettingsResponse,
): ScanStepsSettingsResponse {
  return {
    steps: value.steps.map((step) => ({ ...step })),
  };
}

const { data, pending, error, refresh } =
  await useFetch<ScanStepsSettingsResponse>(
    () => `${runtimeConfig.public.apiUrl}/site-settings/scan-steps`,
    {
      default: () => cloneScanStepsSettings(emptySettings),
    },
  );

const settings = ref<ScanStepsSettingsResponse>(cloneScanStepsSettings(emptySettings));
const savingTarget = ref<
  ScanStepsSettingsResponse["steps"][number]["key"] | null
>(null);

const STEP_DEPENDENCIES: Record<
  ScanStepsSettingsResponse["steps"][number]["key"],
  ScanStepsSettingsResponse["steps"][number]["key"][]
> = {
  shopify: [],
  cms_detection: [],
  language: [],
  seo_meta: [],
  legal_notice: ["shopify"],
  catalog: [],
  contact: ["shopify"],
  linkedin: [],
  social: [],
  technical: [],
  lighthouse: [],
};

function getStepDependents(
  steps: ScanStepsSettingsResponse["steps"],
  stepKey: ScanStepsSettingsResponse["steps"][number]["key"],
) {
  return steps
    .filter((step) => STEP_DEPENDENCIES[step.key]?.includes(stepKey))
    .map((step) => step.key);
}

function enableWithDependencies(
  stepKey: ScanStepsSettingsResponse["steps"][number]["key"],
  nextSteps: ScanStepsSettingsResponse["steps"],
  visited = new Set<ScanStepsSettingsResponse["steps"][number]["key"]>(),
) {
  if (visited.has(stepKey)) {
    return;
  }
  visited.add(stepKey);

  const step = nextSteps.find((item) => item.key === stepKey);
  if (step) {
    step.enabled = true;
  }

  for (const dependency of STEP_DEPENDENCIES[stepKey] || []) {
    enableWithDependencies(dependency, nextSteps, visited);
  }
}

function disableWithDependents(
  stepKey: ScanStepsSettingsResponse["steps"][number]["key"],
  nextSteps: ScanStepsSettingsResponse["steps"],
  visited = new Set<ScanStepsSettingsResponse["steps"][number]["key"]>(),
) {
  if (visited.has(stepKey)) {
    return;
  }
  visited.add(stepKey);

  const step = nextSteps.find((item) => item.key === stepKey);
  if (step) {
    step.enabled = false;
  }

  for (const dependent of getStepDependents(nextSteps, stepKey)) {
    disableWithDependents(dependent, nextSteps, visited);
  }
}

watch(
  () => data.value,
  (value) => {
    if (!value) {
      return;
    }

    settings.value = cloneScanStepsSettings(value);
  },
  { immediate: true },
);

const enabledCount = computed(
  () => settings.value.steps.filter((step) => step.enabled).length,
);

async function toggleStep(
  stepKey: ScanStepsSettingsResponse["steps"][number]["key"],
) {
  if (savingTarget.value) {
    return;
  }

  const currentStep = settings.value.steps.find((step) => step.key === stepKey);
  if (!currentStep) {
    return;
  }

  savingTarget.value = stepKey;

  const nextSteps = settings.value.steps.map((step) => ({ ...step }));
  const togglingOn = !currentStep.enabled;

  if (togglingOn) {
    enableWithDependencies(stepKey, nextSteps);
  } else {
    disableWithDependents(stepKey, nextSteps);
  }

  const nextPayload: ScanStepsSettingsResponse = {
    steps: nextSteps,
  };

  try {
    const result = await $fetch<ScanStepsSettingsResponse>(
      `${runtimeConfig.public.apiUrl}/site-settings/scan-steps`,
      {
        method: "PUT",
        body: nextPayload,
      },
    );

    settings.value = cloneScanStepsSettings(result);

    notifications.add({
      kind: "success",
      title: "Étape de scan mise à jour",
      message: `${currentStep.label} a été ${togglingOn ? "activée" : "désactivée"}.`,
    });
  } catch (error) {
    notifications.add({
      kind: "error",
      title: "Impossible de mettre à jour le scan",
      message:
        error instanceof Error ? error.message : "Une erreur est survenue.",
    });
    await refresh();
  } finally {
    savingTarget.value = null;
  }
}
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div class="text-xs font-medium uppercase tracking-wide text-slate-500">
          Étapes de scan
        </div>
        <h2 class="mt-1 text-lg font-semibold text-slate-900">
          Actions exécutées par défaut lors d’un scan
        </h2>
        <p class="mt-1 text-xs text-slate-600">
          Active ou désactive les étapes lancées automatiquement quand un site
          est scanné.
        </p>
      </div>

      <UBadge color="neutral" variant="soft">
        {{ enabledCount }} / {{ settings.steps.length || 0 }} actives
      </UBadge>
    </div>

    <UAlert
      v-if="error"
      class="mt-4"
      color="error"
      variant="soft"
      icon="i-lucide-alert-circle"
      title="Impossible de charger les étapes de scan"
      :description="error.message || 'Une erreur est survenue.'"
    />

    <div
      v-if="pending && settings.steps.length === 0"
      class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      <div
        v-for="index in 6"
        :key="index"
        class="h-44 animate-pulse rounded-2xl border border-slate-200 bg-slate-50"
      />
    </div>

    <div v-else class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="step in settings.steps"
        :key="step.key"
        class="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition"
        :class="step.enabled ? 'ring-1 ring-primary-300' : ''"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <div
              class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400"
            >
              Étape de scan
            </div>
            <h3 class="mt-1 text-sm font-semibold text-slate-900">
              {{ step.label }}
            </h3>
            <!-- <div class="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
              {{ step.enabled ? "Activée" : "Désactivée" }}
            </div> -->
          </div>

          <UButton
            class="min-w-26 justify-center shrink-0"
            :color="step.enabled ? 'primary' : 'neutral'"
            :variant="step.enabled ? 'solid' : 'soft'"
            size="sm"
            :loading="savingTarget === step.key"
            :icon="
              step.enabled ? 'i-lucide-toggle-right' : 'i-lucide-toggle-left'
            "
            @click="toggleStep(step.key)"
          >
            {{ step.enabled ? "Activé" : "Désactivé" }}
          </UButton>
        </div>

        <p class="mt-3 body-muted">
          {{ step.description }}
        </p>

        <!-- <div class="mt-4 flex items-center justify-between gap-3">
          <span class="text-xs text-slate-500">
            {{
              step.enabled
                ? "Cette étape sera exécutée par défaut."
                : "Cette étape sera ignorée lors des scans automatiques."
            }}
          </span>
        </div> -->
      </article>
    </div>
  </section>
</template>
