<script setup lang="ts">
import type { EmailTemplate } from "~/types/prospects";
import type { EmailTemplatesResponse } from "~/types/site-settings";

const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();

const { data, pending, error } = await useFetch<EmailTemplatesResponse>(
  () => `${runtimeConfig.public.apiUrl}/site-settings/email-templates`,
  {
    default: () => ({ templates: [] }),
  },
);

const templates = ref<EmailTemplate[]>([]);
const selectedTemplateKey = ref<string>("");
const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
const lastSavedSnapshot = ref("");
const saveError = ref("");

const placeholderList = [
  "{{firstName}}",
  "{{siteName}}",
  "{{shopName}}",
  "{{firstObservation}}",
  "{{errorName}}",
  "{{errorExplanation}}",
  "{{allErrorExplanations}}",
  "{{theme}}",
  "{{cms}}",
  "{{leadScore}}",
  "{{supportLink}}",
  "{{creationLink}}",
  "{{refonteLink}}",
  "{{migrationLink}}",
  "{{optimizationLink}}",
  "{{diagnosticLink}}",
];

watch(
  () => data.value?.templates,
  (value) => {
    if (!value) {
      return;
    }

    templates.value = value.map((template) => ({ ...template }));
    if (
      !selectedTemplateKey.value ||
      !templates.value.some(
        (template) => template.key === selectedTemplateKey.value,
      )
    ) {
      selectedTemplateKey.value = templates.value[0]?.key || "";
    }
    lastSavedSnapshot.value = JSON.stringify(templates.value);
  },
  { immediate: true },
);

const templateOptions = computed(() =>
  templates.value.map((template) => ({
    label: template.label,
    value: template.key,
  })),
);

const selectedTemplate = computed(
  () =>
    templates.value.find(
      (template) => template.key === selectedTemplateKey.value,
    ) || null,
);

const selectedTemplateSubject = computed({
  get: () => selectedTemplate.value?.subject || "",
  set: (value: string) => {
    if (!selectedTemplate.value) {
      return;
    }

    updateTemplateSubject(selectedTemplate.value.key, value);
  },
});

const selectedTemplateBody = computed({
  get: () => selectedTemplate.value?.body || "",
  set: (value: string) => {
    if (!selectedTemplate.value) {
      return;
    }

    updateTemplateBody(selectedTemplate.value.key, value);
  },
});

function updateTemplate(key: string, patch: Partial<EmailTemplate>) {
  templates.value = templates.value.map((template) =>
    template.key === key ? { ...template, ...patch } : template,
  );
}

function updateTemplateSubject(key: string, value: string) {
  updateTemplate(key, { subject: value });
}

function updateTemplateBody(key: string, value: string) {
  updateTemplate(key, { body: value });
}

const hasChanges = computed(
  () => JSON.stringify(templates.value) !== lastSavedSnapshot.value,
);

async function saveTemplates() {
  if (!hasChanges.value || saveState.value === "saving") {
    return;
  }

  saveState.value = "saving";
  saveError.value = "";

  try {
    const result = await $fetch<EmailTemplatesResponse>(
      `${runtimeConfig.public.apiUrl}/site-settings/email-templates`,
      {
        method: "PUT",
        body: {
          templates: templates.value.map((template) => ({
            key: template.key,
            subject: template.subject,
            body: template.body,
          })),
        },
      },
    );

    templates.value = result.templates.map((template) => ({ ...template }));
    lastSavedSnapshot.value = JSON.stringify(templates.value);
    saveState.value = "saved";
    notifications.add({
      kind: "success",
      title: "Templates d’emails enregistrés",
      message: "Les modèles sont maintenant utilisés par le composeur.",
    });
  } catch (error) {
    saveState.value = "error";
    saveError.value =
      error instanceof Error
        ? error.message
        : "Impossible d’enregistrer les templates.";
    notifications.add({
      kind: "error",
      title: "Enregistrement des templates échoué",
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
          Paramètres des emails
        </div>
        <p class="mt-1 text-xs text-slate-600">
          Ajuste les sujets et contenus par défaut utilisés dans le composeur de
          mails.
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
          @click="saveTemplates"
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
      title="Impossible de charger les templates d’emails"
      :description="error.message || 'Une erreur est survenue.'"
    />

    <div
      class="mt-5 flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
    >
      <span class="font-medium text-slate-500">Variables disponibles:</span>
      <code
        v-for="token in placeholderList"
        :key="token"
        class="rounded bg-white px-2 py-1 font-mono text-slate-700 ring-1 ring-slate-200"
      >
        {{ token }}
      </code>
      <span class="w-full text-[11px] text-slate-500">
        shopName reprend exactement la même valeur que siteName.
      </span>
    </div>

    <div
      v-if="saveError"
      class="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"
    >
      {{ saveError }}
    </div>

    <div v-else class="mt-6 space-y-4">
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div class="grid gap-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <UFormField label="Template à éditer" class="space-y-1">
            <USelect
              v-model="selectedTemplateKey"
              :items="templateOptions"
              value-attribute="value"
              option-attribute="label"
              color="neutral"
              size="sm"
              class="w-full min-w-0 rounded-xl bg-white"
              trailing-icon="i-lucide-chevron-down"
              :content="{
                class:
                  'z-50 max-h-60 w-(--reka-select-trigger-width) overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl ring-1 ring-slate-200 dark:bg-white dark:text-slate-900 dark:ring-slate-200',
              }"
              :ui="{
                base: 'bg-white dark:bg-white',
                value: 'truncate min-w-0 pointer-events-none pr-8',
                placeholder:
                  'truncate min-w-0 pointer-events-none pr-8 text-slate-400',
                trailing: 'absolute inset-y-0 end-0 flex items-center pe-3',
                trailingIcon: 'shrink-0 text-slate-400',
                item: 'p-2 text-xs text-slate-700',
                itemLabel: 'truncate text-slate-700',
                itemDescription: 'truncate text-slate-500',
                label:
                  'p-2 text-xs font-semibold uppercase tracking-wide text-slate-500',
              }"
              placeholder="Choisir un email"
            />
          </UFormField>
        </div>

        <div v-if="selectedTemplate" class="mt-4 grid gap-4">
          <UFormField label="Sujet" class="space-y-1 md:col-span-2">
            <UInput
              v-model="selectedTemplateSubject"
              placeholder="Sujet du mail"
              class="w-full min-w-0"
            />
          </UFormField>

          <UFormField label="Corps" class="space-y-1">
            <EmailRichTextEditor
              v-model="selectedTemplateBody"
              :show-header="false"
              :disabled="pending || saveState === 'saving'"
              min-height="14rem"
            />
          </UFormField>
        </div>
      </div>
    </div>
  </section>
</template>
