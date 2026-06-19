<script setup lang="ts">
import type { EmailSendingSettingsResponse } from "~/types/site-settings";

const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();

const emptySettings: EmailSendingSettingsResponse = {
  paused: false,
  sendAtHour: 9,
  sendUntilHour: 16,
  dailyLimit: 5,
};

const { data, pending, error } = await useFetch<EmailSendingSettingsResponse>(
  () => `${runtimeConfig.public.apiUrl}/site-settings/email-sending`,
  {
    default: () => ({ ...emptySettings }),
  },
);

const settings = ref<EmailSendingSettingsResponse>({ ...emptySettings });
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
    const result = await $fetch<EmailSendingSettingsResponse>(
      `${runtimeConfig.public.apiUrl}/site-settings/email-sending`,
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
      title: "Envoi des emails enregistré",
      message: settings.value.paused
        ? "L’envoi des emails est maintenant en pause."
        : "L’envoi des emails est maintenant réactivé.",
    });
  } catch (error) {
    saveState.value = "error";
    saveError.value =
      error instanceof Error
        ? error.message
        : "Impossible d’enregistrer le réglage.";
    notifications.add({
      kind: "error",
      title: "Réglage de l’envoi des emails échoué",
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
          Envoi des emails
        </div>
        <p class="mt-1 text-xs text-slate-600">
          Coupe ou réactive l’envoi automatique des emails mis en queue.
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
      title="Impossible de charger le réglage d’envoi des emails"
      :description="error.message || 'Une erreur est survenue.'"
    />

    <div
      v-if="saveError"
      class="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"
    >
      {{ saveError }}
    </div>

    <div class="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-xs font-semibold text-slate-900">Statut</div>
          <p class="mt-1 text-xs text-slate-500">
            Quand la case est cochée, aucun email ne partira depuis la queue.
          </p>
        </div>

        <UCheckbox
          v-model="settings.paused"
          label="Mettre en pause"
          :ui="{
            label: 'text-xs font-medium text-slate-700',
          }"
        />
      </div>

      <div class="mt-4 grid gap-4 md:grid-cols-3">
        <UFormField label="Heure d’envoi" class="space-y-1">
          <UInput
            v-model.number="settings.sendAtHour"
            type="number"
            min="0"
            max="23"
            class="w-full min-w-0 rounded-xl bg-white"
          />
        </UFormField>

        <UFormField label="Heure max d’envoi" class="space-y-1">
          <UInput
            v-model.number="settings.sendUntilHour"
            type="number"
            :min="settings.sendAtHour"
            max="23"
            class="w-full min-w-0 rounded-xl bg-white"
          />
        </UFormField>

        <UFormField label="Emails par jour" class="space-y-1">
          <UInput
            v-model.number="settings.dailyLimit"
            type="number"
            min="1"
            max="200"
            class="w-full min-w-0 rounded-xl bg-white"
          />
        </UFormField>
      </div>

      <div
        class="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
      >
        <span class="font-medium text-slate-900">
          {{ settings.paused ? "Envoi en pause" : "Envoi actif" }}
        </span>
        <span class="text-slate-500">
          {{
            settings.paused
              ? "Les emails attendront la réactivation."
              : `Les emails partiront les jours ouvrés à partir de ${String(settings.sendAtHour).padStart(2, "0")}h et au plus tard avant ${String(settings.sendUntilHour).padStart(2, "0")}h, jusqu’à ${settings.dailyLimit} par jour.`
          }}
        </span>
      </div>
    </div>
  </section>
</template>
