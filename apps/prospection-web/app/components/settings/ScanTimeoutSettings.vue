<script setup lang="ts">
import type { ScanTimeoutSettingsResponse } from "~/types/site-settings";

const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();

const emptySettings: ScanTimeoutSettingsResponse = {
  timeoutMs: 10_000,
};

const { data, pending, error, refresh } =
  await useFetch<ScanTimeoutSettingsResponse>(
    () => `${runtimeConfig.public.apiUrl}/site-settings/scan-timeout`,
    {
      default: () => ({ ...emptySettings }),
    },
  );

const settings = ref<ScanTimeoutSettingsResponse>({ ...emptySettings });
const timeoutSeconds = ref(10);
const lastSavedSnapshot = ref(JSON.stringify(emptySettings));
const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function normalizeTimeoutSeconds(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return Math.round(emptySettings.timeoutMs / 1000);
  }

  return Math.min(120, Math.max(1, Math.round(numericValue)));
}

watch(
  () => data.value,
  (value) => {
    if (!value) {
      return;
    }

    settings.value = { ...value };
    timeoutSeconds.value = normalizeTimeoutSeconds(value.timeoutMs / 1000);
    lastSavedSnapshot.value = JSON.stringify(settings.value);
  },
  { immediate: true },
);

const hasChanges = computed(
  () =>
    JSON.stringify({ timeoutMs: normalizeTimeoutSeconds(timeoutSeconds.value) * 1000 }) !==
    lastSavedSnapshot.value,
);

function scheduleSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    void saveTimeout();
  }, 400);
}

async function saveTimeout() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  const nextTimeoutMs = Math.min(
    120_000,
    Math.max(1_000, normalizeTimeoutSeconds(timeoutSeconds.value) * 1000),
  );
  const snapshot = JSON.stringify({ timeoutMs: nextTimeoutMs });

  if (snapshot === lastSavedSnapshot.value) {
    saveState.value = "idle";
    return;
  }

  saveState.value = "saving";

  try {
    const result = await $fetch<ScanTimeoutSettingsResponse>(
      `${runtimeConfig.public.apiUrl}/site-settings/scan-timeout`,
      {
        method: "PUT",
        body: {
          timeoutMs: nextTimeoutMs,
        },
      },
    );

    settings.value = { ...result };
    timeoutSeconds.value = normalizeTimeoutSeconds(result.timeoutMs / 1000);
    lastSavedSnapshot.value = JSON.stringify(result);
    saveState.value = "saved";

    notifications.add({
      kind: "success",
      title: "Timeout de scan",
      message: `Le timeout des scans est maintenant réglé à ${timeoutSeconds.value} secondes.`,
    });
  } catch (saveError) {
    saveState.value = "error";
    notifications.add({
      kind: "error",
      title: "Impossible d’enregistrer le timeout",
      message:
        saveError instanceof Error
          ? saveError.message
          : "Une erreur est survenue.",
    });
    await refresh();
  } finally {
    window.setTimeout(() => {
      if (saveState.value === "saved" || saveState.value === "error") {
        saveState.value = "idle";
      }
    }, 1800);
  }
}

onBeforeUnmount(() => {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
});
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div class="text-xs font-medium uppercase tracking-wide text-slate-500">
          Timeout de scan
        </div>
        <h2 class="mt-1 text-lg font-semibold text-slate-900">
          Durée maximale d’attente lors des scans d’URL
        </h2>
        <p class="mt-1 text-xs text-slate-600">
          Ce réglage définit le timeout par défaut utilisé quand une URL est scannée.
        </p>
      </div>

      <UBadge color="neutral" variant="soft">
        {{ timeoutSeconds }} s
      </UBadge>
    </div>

    <UAlert
      v-if="error"
      class="mt-4"
      color="error"
      variant="soft"
      icon="i-lucide-alert-circle"
      title="Impossible de charger le timeout de scan"
      :description="error.message || 'Une erreur est survenue.'"
    />

    <div class="mt-5 grid gap-4 md:grid-cols-[minmax(0,18rem)_1fr] md:items-end">
      <UFormField label="Timeout en secondes" class="space-y-1">
        <UInput
          v-model.number="timeoutSeconds"
          type="number"
          min="1"
          max="120"
          step="1"
          class="w-full min-w-0 rounded-xl bg-white"
          @update:model-value="scheduleSave"
        />
      </UFormField>

      <div class="flex flex-wrap items-center gap-3">
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-save"
          :loading="saveState === 'saving'"
          :disabled="saveState === 'saving' || !hasChanges"
          @click="saveTimeout"
        >
          Enregistrer
        </UButton>
        <p v-if="saveState === 'saved'" class="text-sm text-emerald-600">
          Modifications enregistrées.
        </p>
      </div>
    </div>

    <p class="mt-3 text-xs text-slate-500">
      La valeur est convertie en millisecondes côté API.
    </p>
  </section>
</template>
