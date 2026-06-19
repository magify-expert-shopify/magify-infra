<script setup lang="ts">
import type { ScanStepsSettingsResponse } from "~/types/site-settings";
import type {
  ScanLaunchFilters,
  ScanLaunchImportRange,
  ScanLaunchOverwriteMode,
  ScanLaunchProspectScope,
  ScanLaunchPreviewResponse,
  ScanLaunchResponse,
  ScanLaunchStatusResponse,
  ScanLaunchStepKey,
  ScanLaunchThemeType,
} from "~/types/scans";
import { useScanLaunchPreferencesStore } from "~/composables/useScanLaunchPreferences";

const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();
const scanLaunchPreferences = useScanLaunchPreferencesStore();

const defaultFilters: ScanLaunchFilters = {
  cmsName: "",
  importRange: "all",
  themeType: "all",
  prospectScope: "all",
};

const filters = reactive<ScanLaunchFilters>({ ...defaultFilters });

const overwriteMode = ref<ScanLaunchOverwriteMode>("fill_missing");
const launching = ref(false);
const launchError = ref("");
const launchResult = ref<ScanLaunchResponse | null>(null);
const launchDefaultStatus: ScanLaunchStatusResponse = {
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
  changes: [],
};

const { data: stepSettings, refresh: refreshStepSettings } =
  await useFetch<ScanStepsSettingsResponse>(
    () => `${runtimeConfig.public.apiUrl}/site-settings/scan-steps`,
  );

const previewQuery = computed(() => ({
  cmsName: filters.cmsName || undefined,
  importRange: filters.importRange,
  themeType: filters.themeType,
  prospectScope: filters.prospectScope,
  page: 1,
  limit: 1,
}));

const { data: preview, refresh: refreshPreview } =
  await useFetch<ScanLaunchPreviewResponse>(
    () => `${runtimeConfig.public.apiUrl}/scanning/launch/preview`,
    {
      query: previewQuery,
    },
  );

const {
  data: launchStatusData,
  error: launchStatusError,
  refresh: refreshLaunchStatus,
} = await useFetch<ScanLaunchStatusResponse>(
  () => `${runtimeConfig.public.apiUrl}/scanning/launch/status`,
  {
    default: () => structuredClone(launchDefaultStatus),
  },
);

const selectedSteps = ref<ScanLaunchStepKey[]>(["shopify", "cms_detection", "seo_meta"]);
const stepsReady = ref(false);
const launchStatus = ref<ScanLaunchStatusResponse>(
  structuredClone(launchDefaultStatus),
);
const completedLaunchStatus = ref<ScanLaunchStatusResponse | null>(null);
const launchState = ref<"idle" | "running" | "error">("idle");
let launchEventsSource: EventSource | null = null;

onMounted(() => {
  scanLaunchPreferences.hydrate();
  const storedSelection = scanLaunchPreferences.state.value.selectedSteps;

  if (storedSelection.length > 0) {
    selectedSteps.value = storedSelection;
  } else {
    selectedSteps.value = ["shopify", "cms_detection", "seo_meta"];
  }

  Object.assign(
    filters,
    scanLaunchPreferences.state.value.filters || defaultFilters,
  );
  overwriteMode.value =
    scanLaunchPreferences.state.value.overwriteMode || "fill_missing";

  stepsReady.value = true;
});

watch(
  () => launchStatusData.value,
  (value) => {
    if (!value) {
      return;
    }

    launchStatus.value = structuredClone(value);
    if (value.status === "completed" && Array.isArray(value.changes)) {
      completedLaunchStatus.value = structuredClone(value);
    } else if (value.status !== "completed") {
      completedLaunchStatus.value = null;
    }
  },
  { immediate: true },
);

const stepItems = computed(() => stepSettings.value?.steps || []);
const selectedCount = computed(() => selectedSteps.value.length);
const launchIsActive = computed(() =>
  ["queued", "running"].includes(launchStatus.value.status),
);
const displayedLaunchStatus = computed(
  () => completedLaunchStatus.value || launchStatus.value,
);
const selectedStepLabels = computed(() =>
  stepItems.value
    .filter((step) =>
      selectedSteps.value.includes(step.key as ScanLaunchStepKey),
    )
    .map((step) => step.label),
);
const launchProgressPercent = computed(() => {
  if (displayedLaunchStatus.value.totalUrls <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.round(
      (displayedLaunchStatus.value.processedUrls /
        displayedLaunchStatus.value.totalUrls) *
        100,
    ),
  );
});

const launchChangeRows = computed(
  () => displayedLaunchStatus.value.changes || [],
);

const scanLaunchFieldMap: Record<ScanLaunchStepKey, string[]> = {
  shopify: [
    "shopify_status",
    "shopify_checked_at",
    "http_status",
    "site_name",
    "cms_name",
    "shopify_theme_name",
    "shopify_theme_id",
    "shopify_theme_schema_name",
    "shopify_theme_json",
    "redesign_status",
    "site_country_code",
    "site_country_name",
    "site_language_code",
    "site_language_name",
    "scan_ttfb_ms",
    "scan_total_ms",
    "scan_html_bytes",
  ],
  cms_detection: ["cms_name"],
  legal_notice: [
    "shopify_legal_notice_status",
    "shopify_legal_notice_url",
    "shopify_legal_notice_checked_at",
  ],
  seo_meta: [
    "seo_meta_checked_at",
  ],
  catalog: [
    "product_count",
    "median_product_price",
    "gift_card_detected",
    "catalog_checked_at",
  ],
  contact: [
    "contact_status",
    "contact_checked_at",
    "contact_email",
    "contact_phone",
    "contact_siret",
    "contact_siren",
    "contact_first_name",
    "contact_last_name",
    "contact_owner_name",
    "contact_company_name",
    "contact_source_url",
    "contact_evidence",
    "contact_linkedin_url",
    "contact_company_linkedin_url",
    "contact_social_links_json",
  ],
  linkedin: [
    "contact_linkedin_url",
    "contact_company_linkedin_url",
    "contact_social_links_json",
  ],
  social: ["contact_social_links_json"],
  technical: [
    "shopify_theme_name",
    "shopify_theme_id",
    "shopify_theme_schema_name",
    "shopify_theme_json",
    "redesign_status",
  ],
  lighthouse: [
    "lighthouse_checked_at",
    "lighthouse_score",
    "lighthouse_performance_score",
    "lighthouse_accessibility_score",
    "lighthouse_best_practices_score",
    "lighthouse_seo_score",
    "lighthouse_report_json",
    "lighthouse_observations_json",
  ],
};

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

const importRangeOptions: { label: string; value: ScanLaunchImportRange }[] = [
  { label: "Aujourd’hui", value: "today" },
  { label: "Cette semaine", value: "week" },
  { label: "Depuis toujours", value: "all" },
];

const themeTypeOptions: { label: string; value: ScanLaunchThemeType }[] = [
  { label: "Tous les thèmes", value: "all" },
  { label: "Shopify gratuit", value: "free" },
  { label: "Shopify payant", value: "paid" },
  { label: "Custom", value: "custom" },
];

const prospectScopeOptions: {
  label: string;
  value: ScanLaunchProspectScope;
}[] = [
  { label: "Tous", value: "all" },
  { label: "Sans prospect", value: "without" },
  { label: "Avec prospect", value: "with" },
];

const overwriteModeOptions: Array<{
  label: string;
  value: ScanLaunchOverwriteMode;
  description: string;
}> = [
  {
    label: "Remplacer le champ",
    value: "merge",
    description: "Remplace le champ ciblé sauf si la nouvelle valeur est vide.",
  },
  {
    label: "Remplacer toujours",
    value: "clear",
    description: "Remplace le champ même si la nouvelle valeur est vide.",
  },
  {
    label: "Compléter les manques",
    value: "fill_missing",
    description: "Ne remplace le champ que s’il est vide.",
  },
];

async function resetStepSelection() {
  scanLaunchPreferences.reset();
  selectedSteps.value = ["shopify", "cms_detection", "seo_meta"];
  Object.assign(filters, defaultFilters);
}

async function refreshAll() {
  await Promise.all([
    refreshStepSettings(),
    refreshPreview(),
    refreshLaunchStatus(),
  ]);
}

watch(
  filters,
  () => {
    if (!stepsReady.value) {
      return;
    }

    scanLaunchPreferences.setFilters({ ...filters });
  },
  { deep: true },
);

watch(overwriteMode, (value) => {
  if (!stepsReady.value) {
    return;
  }

  scanLaunchPreferences.setOverwriteMode(value);
});

function toggleStep(stepKey: ScanLaunchStepKey, enabled: boolean) {
  if (enabled) {
    const nextSteps = new Set(selectedSteps.value);
    nextSteps.add(stepKey);

    if (stepKey === "contact") {
      nextSteps.add("shopify");
    }

    selectedSteps.value = [...nextSteps];
    scanLaunchPreferences.setSelectedSteps(selectedSteps.value);
    return;
  }

  selectedSteps.value = selectedSteps.value.filter((key) => key !== stepKey);
  scanLaunchPreferences.setSelectedSteps(selectedSteps.value);
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

function themeTypeLabel(value: string) {
  if (value === "free") return "Gratuit";
  if (value === "paid") return "Payant";
  if (value === "custom") return "Custom";
  return "—";
}

function formatDiffValue(value: string | null) {
  return value && value.trim().length > 0 ? value : "—";
}

function formatScanFieldName(field: string) {
  return field.replace(/_/g, " ");
}

const selectedScanFieldGroups = computed(() =>
  selectedSteps.value
    .map((stepKey) => {
      const step = stepItems.value.find((item) => item.key === stepKey);
      return step
        ? {
            key: step.key,
            label: step.label,
            fields: scanLaunchFieldMap[stepKey] || [],
          }
        : null;
    })
    .filter(
      (
        value,
      ): value is { key: ScanLaunchStepKey; label: string; fields: string[] } =>
        Boolean(value),
    ),
);

const impactedScanFields = computed(() => {
  const fields = new Set<string>();

  for (const group of selectedScanFieldGroups.value) {
    for (const field of group.fields) {
      fields.add(field);
    }
  }

  return [...fields];
});

async function launchScans() {
  if (selectedSteps.value.length === 0) {
    launchError.value = "Sélectionne au moins une étape de scan.";
    return;
  }

  if (launchState.value === "running" || launchIsActive.value) {
    return;
  }

  launchState.value = "running";
  launching.value = true;
  launchError.value = "";
  launchResult.value = null;
  completedLaunchStatus.value = null;

  try {
    const result = await $fetch<{
      run: ScanLaunchStatusResponse;
      queued: number;
    }>(`${runtimeConfig.public.apiUrl}/scanning/launch`, {
      method: "POST",
      body: {
        filters: {
          cmsName: filters.cmsName || undefined,
          importRange: filters.importRange,
          themeType: filters.themeType,
          prospectScope: filters.prospectScope,
        },
        steps: selectedSteps.value,
        overwriteMode: overwriteMode.value,
      },
    });

    launchStatus.value = structuredClone(result.run);
    completedLaunchStatus.value =
      result.run.status === "completed" ? structuredClone(result.run) : null;
    launchResult.value = {
      scanned: 0,
      total: result.queued,
      results: [],
      launchId: result.run.id,
    };
    await refreshLaunchStatus();

    notifications.add({
      kind: "success",
      title: "Scans lancés",
      message: `${result.queued} URL(s) ont été placées dans la queue de scan.`,
    });
  } catch (error) {
    launchError.value =
      error instanceof Error
        ? error.message
        : "Impossible de lancer les scans.";
    notifications.add({
      kind: "error",
      title: "Lancement échoué",
      message: launchError.value,
    });
  } finally {
    launchState.value = "idle";
    launching.value = false;
  }
}

function stopLaunchEvents() {
  if (launchEventsSource) {
    launchEventsSource.close();
    launchEventsSource = null;
  }
}

function syncLaunchEvents() {
  if (!import.meta.client) {
    return;
  }

  stopLaunchEvents();

  if (!launchIsActive.value || typeof EventSource === "undefined") {
    return;
  }

  launchEventsSource = new EventSource(
    `${runtimeConfig.public.apiUrl}/scanning/launch/events`,
  );
  for (const eventName of [
    "scan-launch.snapshot",
    "scan-launch.queued",
    "scan-launch.updated",
    "scan-launch.completed",
  ]) {
    launchEventsSource.addEventListener(eventName, (event) => {
      try {
        const parsed = JSON.parse(
          (event as MessageEvent).data as string,
        ) as ScanLaunchStatusResponse;
        launchStatus.value = parsed;
        if (parsed.status === "completed") {
          completedLaunchStatus.value = structuredClone(parsed);
          void refreshLaunchStatus();
        }
        launchResult.value = {
          scanned: parsed.processedUrls,
          total: parsed.totalUrls,
          results: [],
          launchId: parsed.id,
        };
      } catch {
        void refreshLaunchStatus();
      }
    });
  }
}

watch(
  launchIsActive,
  () => {
    syncLaunchEvents();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  stopLaunchEvents();
});
</script>

<template>
  <div class="mx-auto w-full max-w-6xl space-y-8 px-5 py-6 lg:px-8">
    <UPageHeader
      title="Lancement des scans"
      description="Filtre les URLs, choisis les étapes à exécuter puis lance un scan ciblé sur la base."
      icon="i-lucide-rocket"
    >
      <template #actions>
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-refresh-cw"
          @click="refreshAll"
        >
          Rafraîchir
        </UButton>
      </template>
    </UPageHeader>

    <UCard class="rounded-3xl border border-slate-200/80 bg-white/95 shadow-sm">
      <template #header>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="eyebrow-muted">Filtres</p>
            <h2 class="mt-1 text-lg font-semibold text-slate-900">
              Cibler les URLs à scanner
            </h2>
          </div>
          <div
            class="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            {{ preview?.total || 0 }} URL(s) sélectionnée(s)
          </div>
        </div>
      </template>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <UFormField label="CMS" class="space-y-1">
          <UInput
            v-model="filters.cmsName"
            placeholder="Shopify, WooCommerce, ..."
            class="w-full min-w-0 rounded-xl bg-white"
          />
        </UFormField>

        <UFormField label="Import" class="space-y-1">
          <USelect
            v-model="filters.importRange"
            :items="importRangeOptions"
            value-attribute="value"
            option-attribute="label"
            class="w-full min-w-0 rounded-xl bg-white/95 shadow-sm"
            color="neutral"
            size="md"
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
          />
        </UFormField>

        <UFormField label="Thème" class="space-y-1">
          <USelect
            v-model="filters.themeType"
            :items="themeTypeOptions"
            value-attribute="value"
            option-attribute="label"
            class="w-full min-w-0 rounded-xl bg-white/95 shadow-sm"
            color="neutral"
            size="md"
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
          />
        </UFormField>

        <UFormField label="Prospect" class="space-y-1">
          <USelect
            v-model="filters.prospectScope"
            :items="prospectScopeOptions"
            value-attribute="value"
            option-attribute="label"
            class="w-full min-w-0 rounded-xl bg-white/95 shadow-sm"
            color="neutral"
            size="md"
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
          />
        </UFormField>
      </div>
    </UCard>

    <UCard
      v-if="stepsReady"
      class="rounded-3xl border border-slate-200/80 bg-white/95 shadow-sm"
    >
      <template #header>
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div
              class="text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Étapes de scan
            </div>
            <h2 class="mt-1 text-lg font-semibold text-slate-900">
              Actions exécutées par défaut lors d’un scan
            </h2>
            <p class="mt-1 text-xs text-slate-600">
              Active ou désactive les étapes lancées automatiquement quand un
              site est scanné.
            </p>
          </div>

          <UBadge color="neutral" variant="soft">
            {{ selectedCount }} / {{ stepItems.length || 0 }} actives
          </UBadge>

          <UButton
            color="neutral"
            variant="soft"
            size="sm"
            icon="i-lucide-rotate-ccw"
            @click="resetStepSelection"
          >
            Réinitialiser
          </UButton>
        </div>
      </template>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label
          v-for="step in stepItems"
          :key="step.key"
          class="flex cursor-pointer items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition hover:border-emerald-300 hover:bg-white"
          role="button"
          tabindex="0"
          @click="
            toggleStep(
              step.key as ScanLaunchStepKey,
              !selectedSteps.includes(step.key as ScanLaunchStepKey),
            )
          "
          @keydown.enter.prevent="
            toggleStep(
              step.key as ScanLaunchStepKey,
              !selectedSteps.includes(step.key as ScanLaunchStepKey),
            )
          "
          @keydown.space.prevent="
            toggleStep(
              step.key as ScanLaunchStepKey,
              !selectedSteps.includes(step.key as ScanLaunchStepKey),
            )
          "
        >
          <div class="min-w-0 flex-1">
            <div class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Étape de scan
            </div>
            <div class="mt-1 flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h3 class="text-sm font-semibold text-slate-900">
                  {{ step.label }}
                </h3>
                <p class="mt-1 body-muted">
                  {{ step.description }}
                </p>
              </div>
              <span
                :class="[
                  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
                  selectedSteps.includes(step.key as ScanLaunchStepKey)
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                    : 'bg-slate-100 text-slate-600 ring-slate-200',
                ]"
              >
                {{
                  selectedSteps.includes(step.key as ScanLaunchStepKey)
                    ? "ON"
                    : "OFF"
                }}
              </span>
            </div>
          </div>
        </label>
      </div>
    </UCard>

    <UCard
      v-else
      class="rounded-3xl border border-slate-200/80 bg-white/95 shadow-sm"
    >
      <template #header>
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div
              class="text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Étapes de scan
            </div>
            <h2 class="mt-1 text-lg font-semibold text-slate-900">
              Actions exécutées par défaut lors d’un scan
            </h2>
            <p class="mt-1 text-xs text-slate-600">Chargement des étapes...</p>
          </div>
        </div>
      </template>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="index in 6"
          :key="index"
          class="h-32 animate-pulse rounded-2xl border border-slate-200 bg-slate-50"
        />
      </div>
    </UCard>

    <UCard class="rounded-3xl border border-slate-200/80 bg-white/95 shadow-sm">
      <template #header>
        <div>
          <p class="eyebrow-muted">Mise à jour</p>
          <h2 class="mt-1 text-lg font-semibold text-slate-900">
            Comment écrire les données
          </h2>
        </div>
      </template>

      <div class="grid gap-3 md:grid-cols-3">
        <button
          v-for="mode in overwriteModeOptions"
          :key="mode.value"
          type="button"
          class="rounded-2xl border p-4 text-left transition"
          :class="
            overwriteMode === mode.value
              ? 'border-sky-300 bg-sky-50 ring-2 ring-sky-200'
              : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
          "
          @click="overwriteMode = mode.value"
        >
          <div class="flex items-center justify-between gap-3">
            <p class="text-xs font-semibold text-slate-900">
              {{ mode.label }}
            </p>
            <UIcon
              :name="
                overwriteMode === mode.value
                  ? 'i-lucide-check-circle-2'
                  : 'i-lucide-circle'
              "
              class="size-5"
              :class="
                overwriteMode === mode.value ? 'text-sky-600' : 'text-slate-400'
              "
            />
          </div>
          <p class="mt-2 body-muted">
            {{ mode.description }}
          </p>
        </button>
      </div>
    </UCard>

    <UCard class="rounded-3xl border border-slate-200/80 bg-white/95 shadow-sm">
      <template #header>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="eyebrow-muted">Lancement</p>
            <h2 class="mt-1 text-lg font-semibold text-slate-900">
              Exécuter les scans sélectionnés
            </h2>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <div
              class="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              {{ stepsReady ? `${selectedCount} étape(s) cochée(s)` : "…" }}
            </div>
            <UButton
              color="primary"
              icon="i-lucide-play"
              :loading="launching"
              :disabled="launching || launchIsActive"
              @click="launchScans"
            >
              Lancer les scans
            </UButton>
          </div>
        </div>
      </template>

      <div
        v-if="launchError"
        class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
      >
        {{ launchError }}
      </div>

      <UAlert
        v-if="launchStatusError"
        class="mt-4"
        color="error"
        variant="soft"
        icon="i-lucide-alert-circle"
        title="Impossible de charger l’état du lancement des scans"
        :description="launchStatusError.message || 'Une erreur est survenue.'"
      />

      <div
        class="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700 shadow-sm"
      >
        <p class="font-semibold text-slate-900">Vérification avant lancement</p>
        <p class="mt-1 leading-6 text-slate-600">
          Le scan va cibler
          <span class="font-semibold text-slate-900"
            >{{ preview?.total || 0 }} URL(s)</span
          >
          avec les filtres actuels, puis exécuter les étapes cochées dans
          l’ordre de scan.
        </p>
        <div class="mt-3 flex flex-wrap gap-2 text-xs">
          <span
            class="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700"
          >
            CMS: {{ filters.cmsName.trim() || "Tous" }}
          </span>
          <span
            class="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700"
          >
            Import:
            {{
              importRangeOptions.find(
                (item) => item.value === filters.importRange,
              )?.label || "Depuis toujours"
            }}
          </span>
          <span
            class="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700"
          >
            Thème:
            {{
              themeTypeOptions.find((item) => item.value === filters.themeType)
                ?.label || "Tous les thèmes"
            }}
          </span>
          <span
            class="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700"
          >
            Prospect:
            {{
              prospectScopeOptions.find(
                (item) => item.value === filters.prospectScope,
              )?.label || "Tous"
            }}
          </span>
          <span
            class="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700"
          >
            Étapes:
            {{
              selectedStepLabels.length > 0
                ? selectedStepLabels.join(", ")
                : "Aucune"
            }}
          </span>
        </div>

        <div
          class="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
        >
          <div
            class="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Champs BDD impactés
          </div>
          <p class="mt-1 body-muted">
            Le mode de mise à jour s’applique uniquement à ces colonnes, selon
            les étapes cochées.
          </p>
          <div class="mt-3 space-y-3">
            <div
              v-for="group in selectedScanFieldGroups"
              :key="group.key"
              class="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
            >
              <div
                class="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {{ group.label }}
              </div>
              <div class="mt-2 flex flex-wrap gap-2">
                <span
                  v-for="field in group.fields"
                  :key="`${group.key}-${field}`"
                  class="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-700"
                >
                  {{ formatScanFieldName(field) }}
                </span>
              </div>
            </div>
            <div
              v-if="impactedScanFields.length === 0"
              class="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-muted-sm"
            >
              Aucune colonne ne sera modifiée tant qu’aucune étape n’est
              sélectionnée.
            </div>
          </div>
        </div>
      </div>

      <div class="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div
              class="text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Progression
            </div>
            <p class="mt-1 text-xs text-slate-600">
              Suivi live du lancement en cours.
            </p>
          </div>

          <div
            class="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
          >
            {{ launchProgressPercent }}%
          </div>
        </div>

        <div class="mt-4 space-y-3">
          <div
            class="flex h-6 overflow-hidden rounded-full bg-slate-200 text-[11px] font-semibold text-white"
          >
            <div
              class="flex h-full items-center justify-center overflow-hidden bg-emerald-500 transition-[width] duration-500"
              :style="getProgressSegmentStyle(launchStatus.processedUrls)"
              title="Traitées"
            >
              <span class="truncate px-1">{{
                launchStatus.processedUrls
              }}</span>
            </div>
            <div
              class="flex h-full items-center justify-center overflow-hidden bg-sky-500 transition-[width] duration-500"
              :style="getProgressSegmentStyle(launchStatus.runningUrls)"
              title="En cours"
            >
              <span class="truncate px-1">{{ launchStatus.runningUrls }}</span>
            </div>
            <div
              class="flex h-full items-center justify-center overflow-hidden bg-slate-300 text-slate-700 transition-[width] duration-500"
              :style="getProgressSegmentStyle(launchStatus.pendingUrls)"
              title="En attente"
            >
              <span class="truncate px-1">{{ launchStatus.pendingUrls }}</span>
            </div>
          </div>

          <div class="flex flex-wrap gap-3 text-xs text-slate-600">
            <div class="flex items-center gap-2">
              <span class="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>Traitées</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="h-2.5 w-2.5 rounded-full bg-sky-500" />
              <span>En cours</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="h-2.5 w-2.5 rounded-full bg-slate-300" />
              <span>En attente</span>
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
                  launchStatus.totalUrls
                }}</span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-slate-500">Statut</span>
                <span class="font-semibold text-slate-900">
                  {{
                    launchStatus.status === "running"
                      ? "En cours"
                      : launchStatus.status === "queued"
                        ? "En file"
                        : launchStatus.status === "completed"
                          ? "Terminé"
                          : "Inactif"
                  }}
                </span>
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div
              class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3"
            >
              <div>
                <div
                  class="text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                  Diff des changements
                </div>
                <p class="mt-1 text-xs text-slate-600">
                  Les valeurs supprimées s’affichent en rouge et les valeurs
                  ajoutées en vert.
                </p>
              </div>
              <div
                class="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                {{ launchChangeRows.length }} changement(s)
              </div>
            </div>

            <div v-if="launchChangeRows.length > 0" class="overflow-x-auto">
              <table
                class="min-w-full divide-y divide-slate-200 text-left text-xs"
              >
                <thead
                  class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"
                >
                  <tr>
                    <th class="px-4 py-3 font-semibold">URL</th>
                    <th class="px-4 py-3 font-semibold">Champ</th>
                    <th class="px-4 py-3 font-semibold">Supprimé</th>
                    <th class="px-4 py-3 font-semibold">Ajouté</th>
                    <th class="px-4 py-3 font-semibold">Étape</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 bg-white">
                  <tr
                    v-for="change in launchChangeRows"
                    :key="`${change.urlId}-${change.field}`"
                  >
                    <td class="px-4 py-3 align-top">
                      <div class="font-medium text-slate-900">
                        {{ change.siteName || change.url }}
                      </div>
                      <div class="mt-0.5 text-xs text-slate-500">
                        {{ change.url }}
                      </div>
                    </td>
                    <td class="px-4 py-3 align-top">
                      <div class="font-medium text-slate-900">
                        {{ change.fieldLabel }}
                      </div>
                      <div class="mt-0.5 font-mono text-xs text-slate-500">
                        {{ change.field }}
                      </div>
                    </td>
                    <td class="px-4 py-3 align-top">
                      <span
                        class="inline-flex max-w-full rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
                        :class="
                          change.before
                            ? 'bg-rose-50 text-rose-700 ring-rose-200'
                            : 'bg-slate-100 text-slate-500 ring-slate-200'
                        "
                      >
                        {{ formatDiffValue(change.before) }}
                      </span>
                    </td>
                    <td class="px-4 py-3 align-top">
                      <span
                        class="inline-flex max-w-full rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
                        :class="
                          change.after
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : 'bg-slate-100 text-slate-500 ring-slate-200'
                        "
                      >
                        {{ formatDiffValue(change.after) }}
                      </span>
                    </td>
                    <td class="px-4 py-3 align-top">
                      <span
                        class="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                      >
                        {{ change.stepLabel }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-else class="px-4 py-5 text-muted-sm">
              Aucun changement détecté pour le moment.
            </div>
          </div>

          <p v-if="launchStatus.lastError" class="text-xs text-rose-600">
            {{ launchStatus.lastError }}
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>
