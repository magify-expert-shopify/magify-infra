<script setup lang="ts">
import type { ProspectRelaunchSettingsResponse } from "~/types/site-settings";

const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();

const emptySettings: ProspectRelaunchSettingsResponse = {
  afterDays: 14,
};

const { data, pending, error, refresh } =
  await useFetch<ProspectRelaunchSettingsResponse>(
    () => `${runtimeConfig.public.apiUrl}/site-settings/prospect-relaunch`,
    {
      default: () => ({ ...emptySettings }),
    },
  );

const settings = ref<ProspectRelaunchSettingsResponse>({ ...emptySettings });
const afterDays = ref(14);
const lastSavedSnapshot = ref(JSON.stringify(emptySettings));
const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function normalizeAfterDays(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return emptySettings.afterDays;
  }

  return Math.min(365, Math.max(1, Math.round(numericValue)));
}

function formatDurationLabel(days: number) {
  if (days % 7 === 0) {
    const weeks = days / 7;
    if (weeks === 1) return "1 semaine";
    return `${weeks} semaines`;
  }

  if (days === 1) return "1 jour";
  return `${days} jours`;
}

watch(
  () => data.value,
  (value) => {
    if (!value) {
      return;
    }

    settings.value = { ...value };
    afterDays.value = normalizeAfterDays(value.afterDays);
    lastSavedSnapshot.value = JSON.stringify(settings.value);
  },
  { immediate: true },
);

const hasChanges = computed(
  () =>
    JSON.stringify({ afterDays: normalizeAfterDays(afterDays.value) }) !==
    lastSavedSnapshot.value,
);

function scheduleSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    void saveSettings();
  }, 400);
}

async function saveSettings() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  const nextAfterDays = Math.min(365, Math.max(1, normalizeAfterDays(afterDays.value)));
  const snapshot = JSON.stringify({ afterDays: nextAfterDays });

  if (snapshot === lastSavedSnapshot.value) {
    saveState.value = "idle";
    return;
  }

  saveState.value = "saving";

  try {
    const result = await $fetch<ProspectRelaunchSettingsResponse>(
      `${runtimeConfig.public.apiUrl}/site-settings/prospect-relaunch`,
      {
        method: "PUT",
        body: {
          afterDays: nextAfterDays,
        },
      },
    );

    settings.value = { ...result };
    afterDays.value = normalizeAfterDays(result.afterDays);
    lastSavedSnapshot.value = JSON.stringify(result);
    saveState.value = "saved";

    notifications.add({
      kind: "success",
      title: "Relance prospects",
      message: `Les prospects seront proposés à la relance après ${formatDurationLabel(afterDays.value)}.`,
    });
  } catch (saveError) {
    saveState.value = "error";
    notifications.add({
      kind: "error",
      title: "Impossible d’enregistrer la relance",
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
          Relance prospects
        </div>
        <h2 class="mt-1 text-lg font-semibold text-slate-900">
          Délai avant de re-proposer un prospect
        </h2>
        <p class="mt-1 text-xs text-slate-600">
          Ce réglage définit après combien de temps un prospect ayant déjà reçu un
          email de prospection est proposé à nouveau.
        </p>
      </div>

      <UBadge color="neutral" variant="soft">
        {{ formatDurationLabel(afterDays) }}
      </UBadge>
    </div>

    <UAlert
      v-if="error"
      class="mt-4"
      color="error"
      variant="soft"
      icon="i-lucide-alert-circle"
      title="Impossible de charger la relance prospects"
      :description="error.message || 'Une erreur est survenue.'"
    />

    <div class="mt-5 grid gap-4 md:grid-cols-[minmax(0,18rem)_1fr] md:items-end">
      <UFormField label="Relancer après (jours)" class="space-y-1">
        <UInput
          v-model.number="afterDays"
          type="number"
          min="1"
          max="365"
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
          @click="saveSettings"
        >
          Enregistrer
        </UButton>
        <p v-if="saveState === 'saved'" class="text-sm text-emerald-600">
          Modifications enregistrées.
        </p>
      </div>
    </div>

    <p class="mt-3 text-xs text-slate-500">
      La valeur est stockée en jours. Par défaut, le délai est de 14 jours, soit
      2 semaines.
    </p>
  </section>
</template>
