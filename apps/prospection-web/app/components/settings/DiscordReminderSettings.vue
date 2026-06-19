<script setup lang="ts">
import type { DiscordReminderSettingsResponse } from "~/types/site-settings";

const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();

const emptySettings: DiscordReminderSettingsResponse = {
  sendAtTime: "16:45",
};

const { data, pending, error } =
  await useFetch<DiscordReminderSettingsResponse>(
    () => `${runtimeConfig.public.apiUrl}/site-settings/discord-reminder`,
    {
      default: () => ({ ...emptySettings }),
    },
  );

const settings = ref<DiscordReminderSettingsResponse>({ ...emptySettings });
const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
const lastSavedSnapshot = ref("");
const saveError = ref("");

watch(
  () => data.value,
  (value) => {
    if (!value) {
      return;
    }

    settings.value = { ...value };
    lastSavedSnapshot.value = JSON.stringify(settings.value);
  },
  { immediate: true },
);

const hasChanges = computed(
  () => JSON.stringify(settings.value) !== lastSavedSnapshot.value,
);

async function saveSettings() {
  if (!hasChanges.value || saveState.value === "saving") {
    return;
  }

  saveState.value = "saving";
  saveError.value = "";

  try {
    const result = await $fetch<DiscordReminderSettingsResponse>(
      `${runtimeConfig.public.apiUrl}/site-settings/discord-reminder`,
      {
        method: "PUT",
        body: settings.value,
      },
    );

    settings.value = { ...result };
    lastSavedSnapshot.value = JSON.stringify(settings.value);
    saveState.value = "saved";
    notifications.add({
      kind: "success",
      title: "Rappel Discord enregistré",
      message: `Le message de rappel sera envoyé chaque jour à ${settings.value.sendAtTime}.`,
    });
  } catch (error) {
    saveState.value = "error";
    saveError.value =
      error instanceof Error
        ? error.message
        : "Impossible d’enregistrer le réglage.";
    notifications.add({
      kind: "error",
      title: "Réglage du rappel Discord échoué",
      message: saveError.value,
    });
  }
}
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="text-xs font-medium uppercase tracking-wide text-slate-500">
          Rappel Discord
        </div>
        <p class="mt-1 text-xs text-slate-600">
          Définit l’heure quotidienne d’envoi du message Discord de rappel.
        </p>
      </div>

      <UButton
        color="primary"
        variant="solid"
        size="sm"
        icon="i-lucide-save"
        :loading="saveState === 'saving'"
        :disabled="pending || !hasChanges"
        @click="saveSettings"
      >
        Enregistrer
      </UButton>
    </div>

    <UAlert
      v-if="error"
      class="mt-4"
      color="error"
      variant="soft"
      icon="i-lucide-alert-circle"
      title="Impossible de charger le réglage du rappel Discord"
      :description="error.message || 'Une erreur est survenue.'"
    />

    <div
      v-if="saveError"
      class="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"
    >
      {{ saveError }}
    </div>

    <div class="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div class="grid gap-4 md:grid-cols-2">
        <UFormField label="Heure du rappel" class="space-y-1">
          <UInput
            v-model="settings.sendAtTime"
            type="time"
            class="w-full min-w-0 rounded-xl bg-white"
          />
        </UFormField>
      </div>

      <div
        class="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
      >
        <span class="font-medium text-slate-900"> Message quotidien </span>
        <span class="text-slate-500">
          Le bot enverra le rappel chaque jour à {{ settings.sendAtTime }} aux
          utilisateurs configurés.
        </span>
      </div>
    </div>
  </section>
</template>
