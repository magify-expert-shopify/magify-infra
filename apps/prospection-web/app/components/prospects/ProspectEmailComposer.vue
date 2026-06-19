<script setup lang="ts">
import type {
  EmailTemplate,
  EmailTemplateKey,
  ProspectEmailComposerResponse,
} from "~/types/prospects";

const props = defineProps<{
  prospectId: number;
  disabled?: boolean;
  externalSent?: boolean;
  preferredTemplateKey?: EmailTemplateKey | null;
}>();

const emit = defineEmits<{
  (event: "queued", value: { prospectId: number }): void;
  (event: "external-sent"): void;
  (
    event: "draft-changed",
    value: { subject: string; body: string; templateKey: EmailTemplateKey },
  ): void;
}>();

const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();

const selectedTemplateKey = ref<EmailTemplateKey>("blank");
const subject = ref("");
const bodyHtml = ref("");
const templates = ref<EmailTemplate[]>([]);
const isSaving = ref(false);
const isSending = ref(false);
const saveMessage = ref("");
const saveTone = ref<"idle" | "success" | "error">("idle");
const hydratedForProspectId = ref<number | null>(null);

const templateItems = computed(() => [
  ...templates.value.map((template) => ({
    label: template.label,
    value: template.key,
  })),
]);

const recipientLabel = computed(
  () => data.value?.prospect.email || "Aucun destinataire renseigné",
);
const isEmailQueued = computed(() =>
  Boolean(
    data.value?.prospect.firstContactEmailQueuedAt &&
    !data.value?.prospect.firstContactEmailSentAt,
  ),
);
const isEmailSent = computed(() =>
  Boolean(data.value?.prospect.firstContactEmailSentAt),
);
const scheduledEmailHref = computed(
  () => `/prospects/${props.prospectId}/email-planifie`,
);
const isComposerBusy = computed(
  () => pending.value || isSaving.value || isSending.value,
);

const { data, pending, error, refresh } =
  await useFetch<ProspectEmailComposerResponse>(
    () => `${runtimeConfig.public.apiUrl}/prospects/${props.prospectId}/email`,
    {
      default: () => null,
      watch: [() => props.prospectId],
    },
  );

function resetFeedback() {
  saveMessage.value = "";
  saveTone.value = "idle";
}

function setDraft(draft: {
  subject: string;
  body: string;
  templateKey: EmailTemplateKey;
}) {
  selectedTemplateKey.value = draft.templateKey;
  subject.value = draft.subject;
  bodyHtml.value = draft.body;
}

function applyTemplate(templateKey: EmailTemplateKey) {
  const template = templates.value.find((item) => item.key === templateKey);

  if (!template) {
    return;
  }

  resetFeedback();
  setDraft({
    templateKey: template.key,
    subject: template.subject,
    body: template.body,
  });
}

function handleTemplateChange(
  templateKey: EmailTemplateKey | string | number | null | undefined,
) {
  const normalizedTemplateKey = templateKey as EmailTemplateKey;

  if (normalizedTemplateKey === "blank") {
    resetFeedback();
    setDraft({
      templateKey: "blank",
      subject: "",
      body: "",
    });
    return;
  }

  applyTemplate(normalizedTemplateKey);
}

function formatProspectLabel(
  prospect: ProspectEmailComposerResponse["prospect"],
) {
  return prospect.siteName || prospect.name || "Prospect";
}

watch(
  data,
  () => {
    if (!data.value) {
      return;
    }

    if (hydratedForProspectId.value === props.prospectId) {
      return;
    }

    templates.value = data.value.templates;
    setDraft(data.value.draft);
    hydratedForProspectId.value = props.prospectId;

    if (props.preferredTemplateKey) {
      handleTemplateChange(props.preferredTemplateKey);
    }
  },
  { immediate: true },
);

watch(
  () => props.preferredTemplateKey,
  (templateKey) => {
    if (!templateKey || !data.value) {
      return;
    }

    handleTemplateChange(templateKey);
  },
);

watch(
  [subject, bodyHtml, selectedTemplateKey],
  () => {
    emit("draft-changed", {
      subject: subject.value,
      body: bodyHtml.value,
      templateKey: selectedTemplateKey.value,
    });
  },
  { immediate: true },
);

async function saveDraft() {
  isSaving.value = true;
  resetFeedback();

  try {
    const result = await $fetch<ProspectEmailComposerResponse>(
      `${runtimeConfig.public.apiUrl}/prospects/${props.prospectId}/email`,
      {
        method: "PATCH",
        body: {
          subject: subject.value,
          body: bodyHtml.value,
          templateKey: selectedTemplateKey.value,
        },
      },
    );

    templates.value = result.templates;
    selectedTemplateKey.value = result.draft.templateKey;
    subject.value = result.draft.subject;
    bodyHtml.value = result.draft.body;

    notifications.add({
      kind: "success",
      title: "Mail enregistré",
      message: `Le brouillon de ${formatProspectLabel(result.prospect)} a bien été sauvegardé.`,
    });

    saveTone.value = "success";
    saveMessage.value = "Brouillon sauvegardé.";
  } catch (error) {
    saveTone.value = "error";
    saveMessage.value =
      error instanceof Error
        ? error.message
        : "Impossible de sauvegarder le brouillon.";
    notifications.add({
      kind: "error",
      title: "Sauvegarde du mail échouée",
      message: saveMessage.value,
    });
  } finally {
    isSaving.value = false;
  }
}

async function sendEmail() {
  isSending.value = true;
  resetFeedback();

  try {
    const result = await $fetch<
      ProspectEmailComposerResponse & {
        queued?: { id: string | null; queue: string };
        sent?: { direct: boolean; recipient: string };
      }
    >(
      `${runtimeConfig.public.apiUrl}/prospects/${props.prospectId}/email/send`,
      {
        method: "POST",
        body: {
          subject: subject.value,
          body: bodyHtml.value,
          templateKey: selectedTemplateKey.value,
        },
      },
    );

    templates.value = result.templates;
    selectedTemplateKey.value = result.draft.templateKey;
    subject.value = result.draft.subject;
    bodyHtml.value = result.draft.body;

    notifications.add({
      kind: "success",
      title: result.sent?.direct ? "Mail envoyé" : "Mail mis en file",
      message: result.sent?.direct
        ? `Le mail de test de ${formatProspectLabel(result.prospect)} a été envoyé directement.`
        : `Le mail de ${formatProspectLabel(result.prospect)} a été ajouté à la file d’envoi.`,
    });

    saveTone.value = "success";
    saveMessage.value = result.sent?.direct
      ? "Mail envoyé directement."
      : "Mail mis en file.";
    await refresh();

    if (!result.sent?.direct) {
      emit("queued", { prospectId: props.prospectId });
    }
  } catch (error) {
    saveTone.value = "error";
    saveMessage.value =
      error instanceof Error
        ? error.message
        : "Impossible de mettre le mail en file.";
    notifications.add({
      kind: "error",
      title: "Mise en file échouée",
      message: saveMessage.value,
    });
  } finally {
    isSending.value = false;
  }
}
</script>

<template>
  <section
    class="rounded-2xl border border-slate-200 bg-white shadow-sm"
    :class="
      props.disabled && !isEmailQueued && !isEmailSent
        ? 'pointer-events-none select-none opacity-50'
        : ''
    "
  >
    <div class="border-b border-slate-200 px-5 py-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div
            class="text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            Mail de prospection
          </div>
          <div class="mt-1 text-muted-sm">
            Choisis un modèle pré-rempli ou écris le message de zéro.
          </div>
        </div>

        <div
          v-if="!isEmailQueued && !isEmailSent"
          class="flex flex-wrap items-end gap-3"
        >
          <div class="space-y-1">
            <label
              class="block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Modèle
            </label>
            <USelect
              v-model="selectedTemplateKey"
              :items="templateItems"
              value-attribute="value"
              option-attribute="label"
              size="sm"
              color="neutral"
              class="w-[16rem] min-w-0 rounded-xl bg-white"
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
              @update:model-value="handleTemplateChange"
            />
          </div>

          <div class="flex items-center gap-2">
            <UButton
              color="neutral"
              variant="soft"
              size="xs"
              icon="i-lucide-mail-check"
              :disabled="props.externalSent || pending || isSaving || isSending"
              @click="emit('external-sent')"
            >
              L’email a été envoyé en externe
            </UButton>
            <UButton
              color="neutral"
              variant="soft"
              size="xs"
              icon="i-lucide-eraser"
              :disabled="pending || isSaving"
              @click="handleTemplateChange('blank')"
            >
              Vierge
            </UButton>
            <UButton
              color="primary"
              variant="solid"
              size="xs"
              icon="i-lucide-save"
              :loading="isSaving"
              :disabled="pending || isSaving || isSending"
              @click="saveDraft"
            >
              Enregistrer
            </UButton>
            <UButton
              color="success"
              variant="solid"
              size="xs"
              icon="i-lucide-send"
              :loading="isSending"
              :disabled="pending || isSaving || isSending"
              @click="sendEmail"
            >
              Mettre en file
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <div v-if="pending" class="px-5 py-6 text-muted-sm">
      Chargement du composeur email...
    </div>

    <div v-else-if="error" class="px-5 py-6 text-xs text-red-600">
      Impossible de charger le composeur email.
    </div>

    <div v-else class="space-y-5 px-5 py-5">
      <div
        v-if="isEmailQueued || isEmailSent"
        class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-xs leading-6 text-slate-700"
      >
        <p class="font-medium text-slate-900">
          {{
            isEmailSent
              ? "Le mail de prospection a déjà été envoyé."
              : "Le mail de prospection est planifié pour envoi automatique."
          }}
        </p>
        <p class="mt-1 text-slate-600">
          <NuxtLink
            :to="scheduledEmailHref"
            class="font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800"
          >
            Voir le contenu du mail planifié
          </NuxtLink>
        </p>
      </div>

      <div
        v-else-if="props.disabled"
        class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900"
      >
        Valide d’abord le positionnement pour débloquer le mail de prospection.
      </div>

      <template v-if="!isEmailQueued && !isEmailSent">
        <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div class="space-y-2">
            <label
              class="text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Destinataire
            </label>
            <UInput
              :model-value="recipientLabel"
              size="md"
              readonly
              disabled
              class="w-full"
            />
          </div>

          <div class="space-y-2 lg:col-span-2">
            <label
              class="text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Objet
            </label>
            <UInput
              v-model="subject"
              size="md"
              placeholder="Objet du mail"
              class="w-full min-w-0"
            />
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between gap-3">
            <label
              class="text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Corps du mail
            </label>
            <div />
          </div>

          <EmailRichTextEditor
            v-model="bodyHtml"
            :disabled="pending || isSaving || isSending"
            :show-header="false"
            min-height="15rem"
          />
          <p class="text-xs leading-5 text-slate-500">
            Les informations du prospect sont déjà intégrées dans les modèles.
            Tu peux partir d'un modèle puis l'éditer librement.
          </p>
        </div>

        <div
          v-if="saveMessage"
          class="rounded-lg border px-3 py-2 text-xs"
          :class="
            saveTone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          "
        >
          {{ saveMessage }}
        </div>
      </template>
    </div>
  </section>
</template>
