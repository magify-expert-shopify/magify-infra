<script setup lang="ts">
import type { ProspectRelaunchSettingsResponse } from "~/types/site-settings";
import type { ProspectRelaunchItem } from "~/types/prospects";

const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();
const relaunchingAll = ref(false);
const relaunchingId = ref<number | null>(null);

const { data: relaunchSettings } =
  await useFetch<ProspectRelaunchSettingsResponse>(
    () => `${runtimeConfig.public.apiUrl}/site-settings/prospect-relaunch`,
    {
      default: () => ({ afterDays: 14 }),
    },
  );

const { data, pending, error, refresh } = await useFetch<
  ProspectRelaunchItem[]
>(() => `${runtimeConfig.public.apiUrl}/prospects/relaunch`, {
  default: () => [],
});

const relaunchableProspects = computed(() => data.value || []);
const relaunchAfterDays = computed(() =>
  Math.min(
    365,
    Math.max(1, Math.floor(Number(relaunchSettings.value?.afterDays) || 14)),
  ),
);
const relaunchDurationLabel = computed(() =>
  formatDurationLabel(relaunchAfterDays.value),
);
const relaunchDescription = computed(
  () =>
    `Cette liste regroupe les prospects dont le dernier email de prospection a été envoyé il y a plus de ${relaunchDurationLabel.value}.`,
);

function formatDurationLabel(days: number) {
  if (days % 7 === 0) {
    const weeks = days / 7;
    if (weeks === 1) return "1 semaine";
    return `${weeks} semaines`;
  }

  if (days === 1) return "1 jour";
  return `${days} jours`;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getAgeLabel(value: string | null | undefined) {
  if (!value) {
    return "Date inconnue";
  }

  const sentAt = new Date(value).getTime();
  const diffDays = Math.max(
    0,
    Math.floor((Date.now() - sentAt) / (1000 * 60 * 60 * 24)),
  );

  if (diffDays <= 0) return "Aujourd’hui";
  if (diffDays === 1) return "Il y a 1 jour";
  return `Il y a ${diffDays} jours`;
}

async function relaunchOne(item: ProspectRelaunchItem) {
  if (relaunchingId.value === item.id) {
    return;
  }

  relaunchingId.value = item.id;

  try {
    await $fetch(
      `${runtimeConfig.public.apiUrl}/prospects/${item.id}/relaunch`,
      {
        method: "POST",
      },
    );

    notifications.add({
      kind: "success",
      title: "Relance en file",
      message: `${item.siteName || item.name || `Prospect #${item.id}`} a été relancé.`,
    });
    await refresh();
  } catch (error) {
    notifications.add({
      kind: "error",
      title: "Relance échouée",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de relancer ce prospect.",
    });
  } finally {
    relaunchingId.value = null;
  }
}

async function relaunchAll() {
  if (relaunchingAll.value || relaunchableProspects.value.length === 0) {
    return;
  }

  relaunchingAll.value = true;

  try {
    const result = await $fetch<{
      total: number;
      queued: number;
      failed: number;
    }>(`${runtimeConfig.public.apiUrl}/prospects/relaunch`, {
      method: "POST",
      body: {
        ids: relaunchableProspects.value.map((item) => item.id),
      },
    });

    notifications.add({
      kind: "success",
      title: "Relances en file",
      message: `${result.queued}/${result.total} prospect(s) relancé(s).`,
    });
    await refresh();
  } catch (error) {
    notifications.add({
      kind: "error",
      title: "Relance globale échouée",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de relancer les prospects.",
    });
  } finally {
    relaunchingAll.value = false;
  }
}
</script>

<template>
  <LayoutPageShell
    title="Prospects à relancer"
    :description="relaunchDescription"
    max-width="5xl"
  >
    <template #actions>
      <UButton to="/" color="neutral" variant="soft" icon="i-lucide-arrow-left">
        Retour
      </UButton>
      <UButton
        color="primary"
        variant="solid"
        icon="i-lucide-repeat-2"
        :loading="relaunchingAll"
        :disabled="relaunchableProspects.length === 0"
        @click="relaunchAll"
      >
        Relancer tous
      </UButton>
    </template>

    <section
      v-if="pending && relaunchableProspects.length === 0"
      class="rounded-xl border border-slate-200 bg-white p-5 text-muted-sm shadow-sm"
    >
      Chargement des prospects à relancer...
    </section>

    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-alert-circle"
      title="Impossible de charger la liste des relances"
      :description="error.message || 'Une erreur est survenue.'"
    />

    <section
      v-else-if="relaunchableProspects.length === 0"
      class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm"
    >
      <div class="mx-auto flex max-w-md flex-col items-center gap-3">
        <div
          class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200"
        >
          <UIcon name="i-lucide-inbox" class="h-5 w-5" />
        </div>
        <div class="space-y-1">
          <h2 class="text-lg font-semibold text-slate-900">Aucune relance</h2>
          <p class="body-muted">
            Aucun prospect n’a un email de prospection envoyé depuis plus de
            {{ relaunchDurationLabel }}.
          </p>
        </div>
      </div>
    </section>

    <div v-else class="grid gap-4">
      <div
        v-for="item in relaunchableProspects"
        :key="item.id"
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-700 ring-1 ring-sky-200"
              >
                <UIcon name="i-lucide-mail" class="h-4 w-4" />
              </span>
              <div>
                <p
                  class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500"
                >
                  Prospect #{{ item.id }}
                </p>
                <h2 class="text-lg font-semibold text-slate-900">
                  {{ item.siteName || item.name || "Prospect" }}
                </h2>
              </div>
            </div>

            <div class="space-y-1 text-xs text-slate-600">
              <p>
                <span class="font-medium text-slate-900">Email:</span>
                {{ item.email || "—" }}
              </p>
              <p>
                <span class="font-medium text-slate-900">Dernier envoi:</span>
                {{ formatDate(item.firstContactEmailSentAt) }}
                <span class="text-slate-500"
                  >({{ getAgeLabel(item.firstContactEmailSentAt) }})</span
                >
              </p>
              <p>
                <span class="font-medium text-slate-900">Objet:</span>
                {{ item.firstContactEmailSubject || "—" }}
              </p>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <UButton
              :to="`/prospects/${item.id}`"
              color="neutral"
              variant="soft"
              icon="i-lucide-pencil"
            >
              Modifier le mail
            </UButton>
            <UButton
              color="primary"
              variant="solid"
              icon="i-lucide-repeat-2"
              :loading="relaunchingId === item.id"
              @click="relaunchOne(item)"
            >
              Relancer
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </LayoutPageShell>
</template>
