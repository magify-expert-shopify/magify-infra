<script setup lang="ts">
import type { QueuedProspectEmailsResponse } from "~/types/prospects";

const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();
const removingId = ref<number | null>(null);
const sendingId = ref<number | null>(null);
const sendingAll = ref(false);
const requeueingAll = ref(false);
const stoppingActiveAll = ref(false);
const removingWaitingAll = ref(false);

type RemoveQueuedEmailResponse = {
  success: boolean;
  cancelled: boolean;
  cancelledActiveJobCount: number;
  stillActiveJobIds: string[];
  stillActiveJobCount: number;
  removedQueuedJobCount: number;
  hasActiveJob: boolean;
};

type RequeueQueuedEmailsResponse = {
  success: boolean;
  total: number;
  requeued: number;
  alreadyQueued: number;
  failed: number;
  results: Array<{
    prospectId: number;
    queued: boolean;
    skipped?: boolean;
    reason?: string;
  }>;
};

type BulkQueuedEmailActionResponse = {
  success: boolean;
  total: number;
  processed: number;
  cancelled: number;
  removed: number;
  failed: number;
  results: Array<{
    prospectId: number;
    success: boolean;
    cancelled?: boolean;
    removedQueuedJobCount?: number;
    stillActiveJobCount?: number;
    reason?: string;
  }>;
};

const { data, pending, error, refresh } =
  await useFetch<QueuedProspectEmailsResponse>(
    () => `${runtimeConfig.public.apiUrl}/prospects/email-queue`,
    {
      default: () => ({ items: [], total: 0 }),
    },
  );

const queuedEmails = computed(() => data.value?.items || []);
const activeQueuedEmailsCount = computed(
  () => queuedEmails.value.filter((item) => item.state === "active").length,
);
const waitingQueuedEmailsCount = computed(
  () => queuedEmails.value.filter((item) => item.state !== "sent" && item.state !== "active").length,
);
const sendableQueuedEmails = computed(() =>
  queuedEmails.value.filter((item) => item.state !== "sent"),
);
const sendableQueuedEmailsCount = computed(() => sendableQueuedEmails.value.length);

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatState(value: string) {
  if (value === "sent") return "Envoyé";
  if (value === "active") return "En cours";
  if (value === "delayed") return "Différé";
  if (value === "paused") return "En pause";

  return "En attente";
}

async function requeueQueuedEmails() {
  if (requeueingAll.value) {
    return;
  }

  const confirmed = window.confirm(
    "Remettre en file d’attente tous les emails encore marqués comme en attente dans la base ?",
  );

  if (!confirmed) {
    return;
  }

  requeueingAll.value = true;

  try {
    const response = await $fetch<RequeueQueuedEmailsResponse>(
      `${runtimeConfig.public.apiUrl}/prospects/email-queue/requeue`,
      {
        method: "POST",
      },
    );

    notifications.add(
      response.requeued > 0
        ? {
            kind: "success",
            title: "Emails remis en file",
            message:
              [
                `${response.requeued} email(s) ont été remis en file d’attente.`,
                response.alreadyQueued > 0
                  ? `${response.alreadyQueued} déjà en file ont été ignoré(s).`
                  : null,
                response.failed > 0
                  ? `${response.failed} échec(s) pendant la remise en file.`
                  : null,
              ]
                .filter(Boolean)
                .join(' '),
          }
        : {
            kind: "warning",
            title: "Aucun email remis en file",
            message:
              [
                response.alreadyQueued > 0
                  ? `${response.alreadyQueued} email(s) étaient déjà en file et n’ont pas pu être remis en file.`
                  : null,
                response.failed > 0
                  ? `${response.failed} échec(s) pendant la remise en file.`
                  : null,
              ]
                .filter(Boolean)
                .join(' ') || "Aucun email non envoyé n’a pu être remis en file.",
          },
    );

    await refresh();
  } catch (error) {
    notifications.add({
      kind: "error",
      title: "Remise en file impossible",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de remettre les emails en file d’attente.",
    });
  } finally {
    requeueingAll.value = false;
  }
}

async function stopActiveQueuedEmails() {
  if (stoppingActiveAll.value || activeQueuedEmailsCount.value === 0) {
    return;
  }

  const confirmed = window.confirm(
    `Stopper ${activeQueuedEmailsCount.value} tâche(s) d’envoi active(s) ?`,
  );

  if (!confirmed) {
    return;
  }

  stoppingActiveAll.value = true;

  try {
    const response = await $fetch<BulkQueuedEmailActionResponse>(
      `${runtimeConfig.public.apiUrl}/prospects/email-queue/stop-active`,
      {
        method: "POST",
      },
    );

    notifications.add(
      response.cancelled > 0
        ? {
            kind: "success",
            title: "Tâches actives stoppées",
            message:
              [
                `${response.cancelled} tâche(s) active(s) ont été stoppée(s).`,
                response.removed > 0
                  ? `${response.removed} tâche(s) ont aussi été retirée(s) de la file.`
                  : null,
                response.failed > 0
                  ? `${response.failed} échec(s) pendant l’arrêt.`
                  : null,
              ]
                .filter(Boolean)
                .join(" "),
          }
        : {
            kind: "warning",
            title: "Aucune tâche stoppée",
            message:
              [
                response.failed > 0
                  ? `${response.failed} échec(s) pendant l’arrêt.`
                  : null,
                response.removed > 0
                  ? `${response.removed} tâche(s) ont été retirée(s) de la file sans arrêt complet.`
                  : null,
              ]
                .filter(Boolean)
                .join(" ") || "Aucune tâche active n’a pu être stoppée.",
          },
    );

    await refresh();
  } catch (error) {
    notifications.add({
      kind: "error",
      title: "Arrêt impossible",
      message:
        error instanceof Error
          ? error.message
          : "Impossible d’arrêter les tâches actives.",
    });
  } finally {
    stoppingActiveAll.value = false;
  }
}

async function removeWaitingQueuedEmails() {
  if (removingWaitingAll.value || waitingQueuedEmailsCount.value === 0) {
    return;
  }

  const confirmed = window.confirm(
    `Retirer ${waitingQueuedEmailsCount.value} tâche(s) en attente ?`,
  );

  if (!confirmed) {
    return;
  }

  removingWaitingAll.value = true;

  try {
    const response = await $fetch<BulkQueuedEmailActionResponse>(
      `${runtimeConfig.public.apiUrl}/prospects/email-queue/remove-waiting`,
      {
        method: "POST",
      },
    );

    notifications.add(
      response.removed > 0
        ? {
            kind: "success",
            title: "Tâches retirées",
            message:
              [
                `${response.removed} tâche(s) en attente ont été retirée(s).`,
                response.failed > 0
                  ? `${response.failed} échec(s) pendant le retrait.`
                  : null,
              ]
                .filter(Boolean)
                .join(" "),
          }
        : {
            kind: "warning",
            title: "Aucune tâche retirée",
            message:
              response.failed > 0
                ? `${response.failed} échec(s) pendant le retrait.`
                : "Aucune tâche en attente n’a pu être retirée.",
          },
    );

    await refresh();
  } catch (error) {
    notifications.add({
      kind: "error",
      title: "Retrait impossible",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de retirer les tâches en attente.",
    });
  } finally {
    removingWaitingAll.value = false;
  }
}

async function removeQueuedEmail(
  item: QueuedProspectEmailsResponse["items"][number],
) {
  if (removingId.value === item.prospect.id) {
    return;
  }

  const confirmed = window.confirm(
    `Retirer le mail planifié pour "${item.prospect.siteName || item.prospect.name || `Prospect #${item.prospect.id}`}" ?`,
  );

  if (!confirmed) {
    return;
  }

  removingId.value = item.prospect.id;

  try {
    const response = await $fetch<RemoveQueuedEmailResponse>(
      `${runtimeConfig.public.apiUrl}/prospects/${item.prospect.id}/email/queue`,
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
              message: "Le mail planifié a été retiré de la file d’attente.",
            },
    );

    await refresh();
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
    removingId.value = null;
  }
}

async function sendQueuedEmailNow(
  item: QueuedProspectEmailsResponse["items"][number],
) {
  if (sendingAll.value || sendingId.value === item.prospect.id || item.state === "sent") {
    return;
  }

  const confirmed = window.confirm(
    `Envoyer maintenant le mail pour "${item.prospect.siteName || item.prospect.name || `Prospect #${item.prospect.id}`}" ?`,
  );

  if (!confirmed) {
    return;
  }

  sendingId.value = item.prospect.id;

  try {
    await $fetch(
      `${runtimeConfig.public.apiUrl}/prospects/${item.prospect.id}/email/queue/send-now`,
      {
        method: "POST",
      },
    );

    notifications.add({
      kind: "success",
      title: "Mail envoyé",
      message: "Le mail a été envoyé, retiré de la file et le prospect a été marqué comme contacté.",
    });

    await refresh();
  } catch (error) {
    notifications.add({
      kind: "error",
      title: "Correction impossible",
      message:
        error instanceof Error
          ? error.message
          : "Impossible d’envoyer ce mail maintenant.",
    });
  } finally {
    sendingId.value = null;
  }
}

async function sendAllQueuedEmailsNow() {
  if (sendingAll.value || sendableQueuedEmailsCount.value === 0) {
    return;
  }

  const confirmed = window.confirm(
    `Envoyer maintenant les ${sendableQueuedEmailsCount.value} email(s) de la liste ?`,
  );

  if (!confirmed) {
    return;
  }

  const itemsToSend = [...sendableQueuedEmails.value];
  let sentCount = 0;
  let failedCount = 0;

  sendingAll.value = true;

  try {
    for (const item of itemsToSend) {
      sendingId.value = item.prospect.id;

      try {
        await $fetch(
          `${runtimeConfig.public.apiUrl}/prospects/${item.prospect.id}/email/queue/send-now`,
          {
            method: "POST",
          },
        );

        sentCount += 1;
      } catch {
        failedCount += 1;
      } finally {
        sendingId.value = null;
      }
    }

    notifications.add(
      failedCount === 0
        ? {
            kind: "success",
            title: "Emails envoyés",
            message: `${sentCount} email(s) ont été envoyés immédiatement.`,
          }
        : sentCount > 0
          ? {
              kind: "warning",
              title: "Envoi partiel",
              message: `${sentCount} email(s) envoyés, ${failedCount} en échec.`,
            }
          : {
              kind: "error",
              title: "Envoi impossible",
              message: "Aucun email de la liste n’a pu être envoyé maintenant.",
            },
    );

    await refresh();
  } finally {
    sendingId.value = null;
    sendingAll.value = false;
  }
}
</script>

<template>
  <LayoutPageShell
    eyebrow="Prospect"
    title="Emails planifiés"
    description="Voici la liste des emails de prospection actuellement en file d’envoi."
    max-width="6xl"
  >
    <template #actions>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <UButton
          color="success"
          variant="soft"
          icon="i-lucide-send"
          :loading="sendingAll"
          :disabled="sendingAll || sendableQueuedEmailsCount === 0"
          @click="sendAllQueuedEmailsNow"
        >
          Envoyer toute la liste maintenant
        </UButton>
        <UButton
          color="primary"
          variant="soft"
          icon="i-lucide-refresh-ccw"
          :loading="requeueingAll"
          :disabled="requeueingAll"
          @click="requeueQueuedEmails"
        >
          Tout remettre en file
        </UButton>
        <UButton
          color="error"
          variant="soft"
          icon="i-lucide-square-stop"
          :loading="stoppingActiveAll"
          :disabled="stoppingActiveAll || activeQueuedEmailsCount === 0"
          @click="stopActiveQueuedEmails"
        >
          Stopper les tâches actives
        </UButton>
        <UButton
          color="warning"
          variant="soft"
          icon="i-lucide-trash-2"
          :loading="removingWaitingAll"
          :disabled="removingWaitingAll || waitingQueuedEmailsCount === 0"
          @click="removeWaitingQueuedEmails"
        >
          Retirer les tâches en attente
        </UButton>
        <UButton to="/" color="neutral" variant="soft" icon="i-lucide-arrow-left">
          Retour à l’accueil
        </UButton>
      </div>
    </template>

    <UAlert
      v-if="pending && queuedEmails.length === 0"
      color="neutral"
      variant="soft"
      icon="i-lucide-loader"
      title="Chargement de la file"
      description="Récupération des emails planifiés..."
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-alert-circle"
      title="Impossible de charger la file"
      :description="error.message || 'Une erreur est survenue.'"
    />

    <section
      v-else-if="queuedEmails.length === 0"
      class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm"
    >
      <div class="mx-auto flex max-w-md flex-col items-center gap-3">
        <div
          class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200"
        >
          <UIcon name="i-lucide-inbox" class="h-5 w-5" />
        </div>
        <div class="space-y-1">
          <h2 class="text-lg font-semibold text-slate-900">File vide</h2>
          <p class="body-muted">
            Aucun email de prospection n’est actuellement en file d’envoi.
          </p>
        </div>
      </div>
    </section>

    <div
      v-else
      class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div class="border-b border-slate-200 px-6 py-4">
        <div class="text-muted-sm">
          {{ data?.total || queuedEmails.length }} email(s) planifié(s)
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-xs">
          <thead class="bg-slate-50">
            <tr
              class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              <th class="px-6 py-3">Prospect</th>
              <th class="px-6 py-3">Email</th>
              <th class="px-6 py-3">Objet</th>
              <th class="px-6 py-3">État</th>
              <th class="px-6 py-3">Mis en file le</th>
              <th class="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 bg-white">
            <tr
              v-for="item in queuedEmails"
              :key="item.prospect.id"
              class="align-top"
            >
              <td class="px-6 py-4">
                <div class="font-medium text-slate-900">
                  {{
                    item.prospect.siteName ||
                    item.prospect.name ||
                    `Prospect #${item.prospect.id}`
                  }}
                </div>
                <div
                  class="mt-1 text-xs uppercase tracking-wide text-slate-400"
                >
                  Prospect #{{ item.prospect.id }}
                </div>
              </td>
              <td class="px-6 py-4 text-slate-700">
                {{ item.prospect.email || "—" }}
              </td>
              <td class="px-6 py-4 text-slate-700">
                {{ item.subject || "—" }}
              </td>
              <td class="px-6 py-4">
                <UBadge
                  :color="item.state === 'sent' ? 'success' : 'neutral'"
                  class="whitespace-nowrap"
                  variant="soft"
                >
                  {{ formatState(item.state) }}
                </UBadge>
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-slate-700">
                {{ formatDate(item.queuedAt) }}
              </td>
              <td class="px-6 py-4">
                <div class="flex flex-col items-start gap-2">
                  <UButton
                    :to="`/prospects/${item.prospect.id}/email-planifie`"
                    color="neutral"
                    variant="soft"
                    icon="i-lucide-eye"
                    class="whitespace-nowrap"
                  >
                    Voir le contenu du mail planifié
                  </UButton>
                  <UButton
                    v-if="item.state !== 'sent'"
                    color="success"
                    variant="soft"
                    icon="i-lucide-send"
                    :loading="sendingId === item.prospect.id"
                    :disabled="sendingAll || sendingId === item.prospect.id"
                    class="whitespace-nowrap"
                    @click="sendQueuedEmailNow(item)"
                  >
                    Envoyer maintenant
                  </UButton>
                  <UButton
                    color="error"
                    variant="soft"
                    icon="i-lucide-trash-2"
                    :loading="removingId === item.prospect.id"
                    :disabled="removingId === item.prospect.id"
                    class="whitespace-nowrap"
                    @click="removeQueuedEmail(item)"
                  >
                    Retirer de la file d’attente
                  </UButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </LayoutPageShell>
</template>
