<script setup lang="ts">
import EmailRichTextEditor from "~/components/email/EmailRichTextEditor.vue";
import type { EmailSendingSettingsResponse } from "~/types/site-settings";
import type { ProspectEmailComposerResponse } from "~/types/prospects";

const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();
const id = computed(() => Number(route.params.id));
const isRemovingFromQueue = ref(false);
const isMarkingAsSent = ref(false);

type RemoveQueuedEmailResponse = {
  success: boolean;
  cancelled: boolean;
  cancelledActiveJobCount: number;
  stillActiveJobIds: string[];
  stillActiveJobCount: number;
  removedQueuedJobCount: number;
  hasActiveJob: boolean;
};

const {
  data: emailData,
  pending: emailPending,
  error: emailError,
  refresh,
} = await useFetch<ProspectEmailComposerResponse>(
  () => `${runtimeConfig.public.apiUrl}/prospects/${id.value}/email`,
  {
    watch: [id],
  },
);

const { data: sendingSettings } = await useFetch<EmailSendingSettingsResponse>(
  () => `${runtimeConfig.public.apiUrl}/site-settings/email-sending`,
);

const selectedTemplateLabel = computed(() => {
  if (!emailData.value) {
    return "—";
  }

  return (
    emailData.value.templates.find(
      (template) => template.key === emailData.value?.draft.templateKey,
    )?.label || "Message libre"
  );
});

const scheduleSummary = computed(() => {
  const settings = sendingSettings.value;
  if (!settings) {
    return "Le planning d’envoi est en cours de chargement.";
  }

  return `Envoi automatique les jours ouvrés à ${String(settings.sendAtHour).padStart(2, "0")}h, jusqu’à ${settings.dailyLimit} email(s) par jour.`;
});

async function removeQueuedEmail() {
  if (!emailData.value) {
    return;
  }

  const confirmed = window.confirm("Retirer ce mail de la file d’attente ?");
  if (!confirmed) {
    return;
  }

  isRemovingFromQueue.value = true;

  try {
    const response = await $fetch<RemoveQueuedEmailResponse>(
      `${runtimeConfig.public.apiUrl}/prospects/${id.value}/email/queue`,
      {
        method: "DELETE",
      },
    );

    notifications.add(
      response.hasActiveJob && response.cancelled
        ? {
            kind: "success",
            title: "Tâche annulée",
            message: "L’envoi en cours a été interrompu et retiré de la file.",
          }
        : response.hasActiveJob
          ? {
              kind: "warning",
              title: "Annulation incomplète",
              message:
                "Le mail a été retiré de la file, mais la tâche en cours n’a pas pu être annulée.",
            }
          : {
              kind: "success",
              title: "Mail retiré",
              message: "Le mail de prospection a été retiré de la file d’attente.",
            },
    );

    await navigateTo(`/prospects/${id.value}`);
  } catch (error) {
    notifications.add({
      kind: "error",
      title: "Retrait impossible",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de retirer le mail de la file.",
    });
  } finally {
    isRemovingFromQueue.value = false;
  }
}

async function forceMarkQueuedEmailAsSent() {
  if (!emailData.value) {
    return;
  }

  const confirmed = window.confirm(
    "Marquer ce mail comme envoyé et retirer la tâche de la file d’attente ?",
  );
  if (!confirmed) {
    return;
  }

  isMarkingAsSent.value = true;

  try {
    await $fetch(`${runtimeConfig.public.apiUrl}/prospects/${id.value}/email/queue/sent`, {
      method: "PATCH",
    });

    notifications.add({
      kind: "success",
      title: "Mail marqué comme envoyé",
      message: "Le mail a été marqué comme envoyé et la tâche a été retirée de la queue.",
    });

    await refresh();
  } catch (error) {
    notifications.add({
      kind: "error",
      title: "Action impossible",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de forcer l’état envoyé de ce mail.",
    });
  } finally {
    isMarkingAsSent.value = false;
  }
}
</script>

<template>
  <section
    class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-6 lg:px-8"
  >
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div
            class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
          >
            Mail planifié
          </div>
          <h1 class="mt-1 text-2xl font-semibold text-slate-900">
            Contenu du mail de prospection
          </h1>
          <p class="mt-1 text-muted-sm">
            Voici le contenu qui sera envoyé automatiquement par la file
            d’envoi.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton
            :to="`/prospects/${id}`"
            color="neutral"
            variant="soft"
            icon="i-lucide-arrow-left"
          >
            Voir le prospect
          </UButton>

          <UButton
            v-if="
              emailData?.prospect.firstContactEmailQueuedAt &&
              !emailData?.prospect.firstContactEmailSentAt
            "
            color="error"
            variant="soft"
            icon="i-lucide-trash-2"
            :loading="isRemovingFromQueue"
            @click="removeQueuedEmail"
          >
            Retirer de la file
          </UButton>
        </div>
      </div>
    </div>

    <UAlert
      v-if="emailPending"
      color="neutral"
      variant="soft"
      icon="i-lucide-loader"
      title="Chargement du mail planifié"
      description="Récupération du sujet et du corps du message..."
    />

    <UAlert
      v-else-if="emailError"
      color="error"
      variant="soft"
      icon="i-lucide-alert-circle"
      title="Impossible de charger le mail planifié"
      :description="emailError.message || 'Une erreur est survenue.'"
    />

    <template v-else-if="emailData">
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div
            class="text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            Sujet
          </div>
          <div class="mt-2 text-lg font-semibold text-slate-900">
            {{ emailData.draft.subject || "—" }}
          </div>

          <div
            class="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            Corps du mail
          </div>
          <div class="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <EmailRichTextEditor
              :model-value="emailData.draft.body"
              :disabled="true"
              :show-header="false"
              min-height="22rem"
            />
          </div>
        </div>

        <div class="space-y-4">
          <div
            class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div
              class="text-xs font-semibold uppercase tracking-wide text-slate-400"
            >
              Statut
            </div>
            <div class="mt-2 body-muted">
              {{
                emailData.prospect.firstContactEmailSentAt
                  ? "Le mail a déjà été envoyé."
                  : "Le mail est en file d’attente."
              }}
            </div>
            <div
              v-if="
                emailData.prospect.firstContactEmailQueuedAt &&
                !emailData.prospect.firstContactEmailSentAt
              "
              class="mt-3"
            >
              <UButton
                color="primary"
                variant="soft"
                icon="i-lucide-check-check"
                :loading="isMarkingAsSent"
                block
                @click="forceMarkQueuedEmailAsSent"
              >
                Marquer comme envoyé
              </UButton>
            </div>
            <div
              class="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600"
            >
              {{ scheduleSummary }}
            </div>
          </div>

          <div
            class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div
              class="text-xs font-semibold uppercase tracking-wide text-slate-400"
            >
              Modèle
            </div>
            <div class="mt-2 text-xs font-semibold text-slate-900">
              {{ selectedTemplateLabel }}
            </div>
            <div class="mt-1 text-xs leading-6 text-slate-500">
              Le contenu ci-dessus correspond au message enregistré dans la
              file.
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
