<script setup lang="ts">
import type { LeadScoreRecalcStatusResponse } from "~/types/site-settings";

const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();
const recalcDefaultStatus: LeadScoreRecalcStatusResponse = {
  id: 0,
  status: "idle",
  totalUrls: 0,
  processedUrls: 0,
  runningUrls: 0,
  pendingUrls: 0,
  queuedAt: null,
  startedAt: null,
  finishedAt: null,
  lastError: null,
  currentUrlId: null,
  updatedAt: null,
};

const {
  data: recalcStatusData,
  error: recalcStatusError,
  refresh: refreshRecalcStatus,
} = await useFetch<LeadScoreRecalcStatusResponse>(
  () => `${runtimeConfig.public.apiUrl}/urls/lead-score/recalculate/status`,
  {
    default: () => structuredClone(recalcDefaultStatus),
  },
);

const recalcStatus = ref<LeadScoreRecalcStatusResponse>(
  structuredClone(recalcDefaultStatus),
);
const recalcState = ref<"idle" | "running" | "error">("idle");
let recalcEventsSource: EventSource | null = null;

watch(
  () => recalcStatusData.value,
  (value) => {
    if (!value) {
      return;
    }

    recalcStatus.value = structuredClone(value);
  },
  { immediate: true },
);

const recalcIsActive = computed(() =>
  ["queued", "running"].includes(recalcStatus.value.status),
);
const recalcProgressPercent = computed(() => {
  if (recalcStatus.value.totalUrls <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.round(
      (recalcStatus.value.processedUrls / recalcStatus.value.totalUrls) * 100,
    ),
  );
});

function getProgressSegmentStyle(value: number) {
  if (value <= 0) {
    return {
      flexGrow: 0,
      flexBasis: "0px",
      minWidth: "0px",
    };
  }

  return {
    flexGrow: value,
    flexBasis: "0px",
    minWidth: "2rem",
  };
}

function syncRecalcPolling() {
  if (!import.meta.client) {
    return;
  }

  if (recalcEventsSource) {
    recalcEventsSource.close();
    recalcEventsSource = null;
  }

  if (!recalcIsActive.value) {
    return;
  }

  recalcEventsSource = new EventSource(
    `${runtimeConfig.public.apiUrl}/urls/lead-score/recalculate/events`,
  );
  for (const eventName of [
    "lead-score-recalc.snapshot",
    "lead-score-recalc.queued",
    "lead-score-recalc.updated",
    "lead-score-recalc.completed",
  ]) {
    recalcEventsSource.addEventListener(eventName, (event) => {
      try {
        recalcStatus.value = JSON.parse(
          (event as MessageEvent).data as string,
        ) as LeadScoreRecalcStatusResponse;
      } catch {
        void refreshRecalcStatus();
      }
    });
  }
}

watch(
  recalcIsActive,
  () => {
    syncRecalcPolling();
  },
  { immediate: true },
);

async function startLeadScoreRecalculation() {
  if (recalcState.value === "running" || recalcIsActive.value) {
    return;
  }

  recalcState.value = "running";

  try {
    const result = await $fetch<{
      run: LeadScoreRecalcStatusResponse;
      queued: number;
    }>(`${runtimeConfig.public.apiUrl}/urls/lead-score/recalculate`, {
      method: "POST",
    });

    recalcStatus.value = structuredClone(result.run);
    await refreshRecalcStatus();

    notifications.add({
      kind: "success",
      title: "Recalcul lancé",
      message: `${result.queued} URL(s) ont été placées dans la queue de recalcul.`,
    });
  } catch (error) {
    recalcState.value = "error";
    notifications.add({
      kind: "error",
      title: "Recalcul impossible",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de lancer le recalcul des scores.",
    });
  } finally {
    recalcState.value = "idle";
    await refreshRecalcStatus();
  }
}

onBeforeUnmount(() => {
  if (recalcEventsSource) {
    recalcEventsSource.close();
  }
});
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="text-xs font-medium uppercase tracking-wide text-slate-500">
          Recalcul des scores
        </div>
        <p class="mt-1 text-xs text-slate-600">
          Les URLs sont recalculées depuis les données déjà présentes en base,
          sans relancer les scans.
        </p>
      </div>

      <UButton
        color="neutral"
        variant="soft"
        size="sm"
        icon="i-lucide-refresh-cw"
        :loading="recalcState === 'running'"
        :disabled="recalcState === 'running' || recalcIsActive"
        @click="startLeadScoreRecalculation"
      >
        Recalculer tous les scores
      </UButton>
    </div>

    <UAlert
      v-if="recalcStatusError"
      class="mt-4"
      color="error"
      variant="soft"
      icon="i-lucide-alert-circle"
      title="Impossible de charger l’état du recalcul des scores"
      :description="recalcStatusError.message || 'Une erreur est survenue.'"
    />

    <div class="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div
            class="text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            Progression
          </div>
          <p class="mt-1 text-xs text-slate-600">
            Suivi live du batch en cours.
          </p>
        </div>

        <div
          class="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
        >
          {{ recalcProgressPercent }}%
        </div>
      </div>

      <div class="mt-4 space-y-3">
        <div
          class="flex h-6 overflow-hidden rounded-full bg-slate-200 text-[11px] font-semibold text-white"
        >
          <div
            class="flex h-full items-center justify-center overflow-hidden bg-emerald-500 transition-[width] duration-500"
            :style="getProgressSegmentStyle(recalcStatus.processedUrls)"
            title="Recalculé"
          >
            <span class="truncate px-1">{{ recalcStatus.processedUrls }}</span>
          </div>
          <div
            class="flex h-full items-center justify-center overflow-hidden bg-sky-500 transition-[width] duration-500"
            :style="getProgressSegmentStyle(recalcStatus.runningUrls)"
            title="En cours"
          >
            <span class="truncate px-1">{{ recalcStatus.runningUrls }}</span>
          </div>
          <div
            class="flex h-full items-center justify-center overflow-hidden bg-slate-300 text-slate-700 transition-[width] duration-500"
            :style="getProgressSegmentStyle(recalcStatus.pendingUrls)"
            title="Non recalculé"
          >
            <span class="truncate px-1">{{ recalcStatus.pendingUrls }}</span>
          </div>
        </div>

        <div class="flex flex-wrap gap-3 text-xs text-slate-600">
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span>Recalculé</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full bg-sky-500" />
            <span>En cours</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span>Non recalculé</span>
          </div>
        </div>

        <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div
            class="text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            Détails
          </div>
          <div class="mt-2 grid gap-2 text-xs">
            <div class="flex items-center justify-between gap-3">
              <span class="text-slate-500">URLs totales</span>
              <span class="font-semibold text-slate-900">{{
                recalcStatus.totalUrls
              }}</span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-slate-500">Statut</span>
              <span class="font-semibold text-slate-900">
                {{
                  recalcStatus.status === "running"
                    ? "En cours"
                    : recalcStatus.status === "queued"
                      ? "En file"
                      : recalcStatus.status === "completed"
                        ? "Terminé"
                        : "Inactif"
                }}
              </span>
            </div>
          </div>
        </div>

        <p v-if="recalcStatusError" class="text-xs text-rose-600">
          {{
            recalcStatusError.message ||
            "Impossible de charger l’état du recalcul."
          }}
        </p>
      </div>
    </div>
  </section>
</template>
