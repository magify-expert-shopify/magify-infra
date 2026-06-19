<script setup lang="ts">
import type { SiteLinksResponse } from "~/types/site-settings";

const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();

const emptyLinks: SiteLinksResponse = {
  supportUrl: "",
  creationUrl: "",
  refonteUrl: "",
  migrationUrl: "",
  optimizationUrl: "",
  diagnosticUrl: "",
};

const { data, pending, error } = await useFetch<SiteLinksResponse>(
  () => `${runtimeConfig.public.apiUrl}/site-settings/site-links`,
  {
    default: () => ({ ...emptyLinks }),
  },
);

const links = ref<SiteLinksResponse>({ ...emptyLinks });
const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
const lastSavedSnapshot = ref("");
const saveError = ref("");

watch(
  () => data.value,
  (value) => {
    if (!value) {
      return;
    }

    links.value = { ...value };
    lastSavedSnapshot.value = JSON.stringify(links.value);
  },
  { immediate: true },
);

const hasChanges = computed(
  () => JSON.stringify(links.value) !== lastSavedSnapshot.value,
);

function updateField(key: keyof SiteLinksResponse, value: string) {
  links.value = {
    ...links.value,
    [key]: value,
  };
}

async function saveLinks() {
  if (!hasChanges.value || saveState.value === "saving") {
    return;
  }

  saveState.value = "saving";
  saveError.value = "";

  try {
    const result = await $fetch<SiteLinksResponse>(
      `${runtimeConfig.public.apiUrl}/site-settings/site-links`,
      {
        method: "PUT",
        body: links.value,
      },
    );

    links.value = { ...result };
    lastSavedSnapshot.value = JSON.stringify(links.value);
    saveState.value = "saved";
    notifications.add({
      kind: "success",
      title: "Liens du site enregistrés",
      message:
        "Les URLs sont désormais disponibles dans les templates d’emails.",
    });
  } catch (error) {
    saveState.value = "error";
    saveError.value =
      error instanceof Error
        ? error.message
        : "Impossible d’enregistrer les liens.";
    notifications.add({
      kind: "error",
      title: "Enregistrement des liens échoué",
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
          Liens du site
        </div>
        <p class="mt-1 text-xs text-slate-600">
          Renseigne les URLs utilisées dans les templates d’emails.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <UButton
          color="primary"
          variant="solid"
          size="sm"
          icon="i-lucide-save"
          :loading="saveState === 'saving'"
          :disabled="pending || !hasChanges"
          @click="saveLinks"
        >
          Enregistrer
        </UButton>
      </div>
    </div>

    <UAlert
      v-if="error"
      class="mt-4"
      color="error"
      variant="soft"
      icon="i-lucide-alert-circle"
      title="Impossible de charger les liens du site"
      :description="error.message || 'Une erreur est survenue.'"
    />

    <div
      v-if="saveError"
      class="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"
    >
      {{ saveError }}
    </div>

    <div class="mt-6 grid gap-4 md:grid-cols-2">
      <UFormField label="URL du support" class="space-y-1">
        <UInput
          :model-value="links.supportUrl"
          placeholder="https://..."
          @update:model-value="updateField('supportUrl', String($event || ''))"
        />
      </UFormField>

      <UFormField label="URL de la page création" class="space-y-1">
        <UInput
          :model-value="links.creationUrl"
          placeholder="https://..."
          @update:model-value="updateField('creationUrl', String($event || ''))"
        />
      </UFormField>

      <UFormField label="URL de la page refonte" class="space-y-1">
        <UInput
          :model-value="links.refonteUrl"
          placeholder="https://..."
          @update:model-value="updateField('refonteUrl', String($event || ''))"
        />
      </UFormField>

      <UFormField label="URL de la page migration" class="space-y-1">
        <UInput
          :model-value="links.migrationUrl"
          placeholder="https://..."
          @update:model-value="
            updateField('migrationUrl', String($event || ''))
          "
        />
      </UFormField>

      <UFormField label="URL de la page optimisation" class="space-y-1">
        <UInput
          :model-value="links.optimizationUrl"
          placeholder="https://..."
          @update:model-value="
            updateField('optimizationUrl', String($event || ''))
          "
        />
      </UFormField>

      <UFormField label="URL de la page diagnostic" class="space-y-1">
        <UInput
          :model-value="links.diagnosticUrl"
          placeholder="https://..."
          @update:model-value="
            updateField('diagnosticUrl', String($event || ''))
          "
        />
      </UFormField>
    </div>
  </section>
</template>
