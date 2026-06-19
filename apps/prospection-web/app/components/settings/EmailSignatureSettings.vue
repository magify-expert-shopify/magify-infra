<script setup lang="ts">
import type { EmailSignatureSettingsResponse } from "~/types/site-settings";

const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();

const { data, pending, error } = await useFetch<EmailSignatureSettingsResponse>(
  () => `${runtimeConfig.public.apiUrl}/site-settings/email-signature`,
  {
    default: () => ({
      html: `<div>
<table cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; font-family: Arial, sans-serif">
  <tbody>
    <tr valign="middle">
      <td style="padding-right: 14px">
        <div style="width: 72px; height: 72px; border-radius: 50%; background: #1f2937; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 22px; line-height: 1;">
          M
        </div>
      </td>
      <td style="border-left: 1px solid rgb(204, 204, 204)">&nbsp;</td>
      <td style="padding-left: 14px; vertical-align: middle">
        <table cellpadding="0" cellspacing="0" border="0">
          <tbody>
            <tr><td style="padding-bottom: 2px; line-height: 1.3; font-size: 14px; font-weight: bold; color: rgb(26, 26, 26)">N'GNIMA FATY</td></tr>
            <tr><td style="line-height: 1.3; font-weight: bold; color: rgb(26, 26, 26)">Experte Shopify &amp; Strategist</td></tr>
            <tr><td style="padding-bottom: 10px; line-height: 1.3; color: rgb(85, 85, 85)">Agence Magify</td></tr>
            <tr><td style="padding-bottom: 4px; font-size: 12px; color: rgb(85, 85, 85)">07 83 82 65 05</td></tr>
            <tr><td style="padding-bottom: 4px; font-size: 12px"><a href="https://magify.fr/" target="_blank" style="color: rgb(85, 85, 85); text-decoration: none">magify.fr</a></td></tr>
            <tr><td style="font-size: 12px"><a href="https://www.linkedin.com/in/ngnimafaty/" target="_blank" style="color: rgb(85, 85, 85); text-decoration: none">linkedin</a></td></tr>
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>
</table>
</div>`,
    }),
  },
);

const signature = ref<EmailSignatureSettingsResponse>({
  html: data.value?.html || "",
});
const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
const lastSavedSnapshot = ref("");
const saveError = ref("");

watch(
  () => data.value,
  (value) => {
    if (!value) {
      return;
    }

    signature.value = { html: value.html };
    lastSavedSnapshot.value = signature.value.html;
  },
  { immediate: true },
);

const hasChanges = computed(
  () => signature.value.html !== lastSavedSnapshot.value,
);

async function saveSignature() {
  if (!hasChanges.value || saveState.value === "saving") {
    return;
  }

  saveState.value = "saving";
  saveError.value = "";

  try {
    const result = await $fetch<EmailSignatureSettingsResponse>(
      `${runtimeConfig.public.apiUrl}/site-settings/email-signature`,
      {
        method: "PUT",
        body: signature.value,
      },
    );

    signature.value = { html: result.html };
    lastSavedSnapshot.value = result.html;
    saveState.value = "saved";
    notifications.add({
      kind: "success",
      title: "Signature email enregistrée",
      message: "La signature des emails a bien été sauvegardée.",
    });
  } catch (error) {
    saveState.value = "error";
    saveError.value =
      error instanceof Error
        ? error.message
        : "Impossible d’enregistrer la signature.";
    notifications.add({
      kind: "error",
      title: "Signature email",
      message: saveError.value,
    });
  }
}

const previewHtml = computed(
  () =>
    signature.value.html ||
    '<p class="text-slate-400">Aucune signature à prévisualiser.</p>',
);
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="text-xs font-medium uppercase tracking-wide text-slate-500">
          Signature email
        </div>
        <p class="mt-1 text-xs text-slate-600">
          Colle ici ta signature HTML. L’aperçu se met à jour en direct.
        </p>
      </div>

      <UButton
        color="primary"
        variant="solid"
        size="sm"
        icon="i-lucide-save"
        :loading="saveState === 'saving'"
        :disabled="pending || !hasChanges"
        @click="saveSignature"
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
      title="Impossible de charger la signature email"
      :description="error.message || 'Une erreur est survenue.'"
    />

    <div
      v-if="saveError"
      class="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"
    >
      {{ saveError }}
    </div>

    <div class="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <UFormField label="Signature HTML" class="space-y-1">
        <UTextarea
          v-model="signature.html"
          :rows="18"
          class="w-full min-w-0 rounded-xl bg-white font-mono text-xs"
          placeholder="<div>...</div>"
        />
      </UFormField>

      <div class="space-y-2">
        <div class="text-xs font-medium uppercase tracking-wide text-slate-500">
          Aperçu
        </div>
        <div
          class="overflow-hidden rounded-xl border border-slate-200 bg-white p-4"
        >
          <div
            class="signature-preview prose prose-slate max-w-none"
            v-html="previewHtml"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.signature-preview :deep(table) {
  border-collapse: collapse;
}

.signature-preview :deep(a) {
  color: inherit;
}
</style>
