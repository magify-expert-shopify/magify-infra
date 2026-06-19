<script setup lang="ts">
import HomeActionCard from "~/components/home/HomeActionCard.vue";
import HomeKpiSection from "~/components/home/HomeKpiSection.vue";
import {
  DEFAULT_HOME_CARD_SETTINGS,
  HOME_CARD_DEFINITIONS,
} from "~/lib/homepage-cards";
import type { CountResponse } from "~/types/common";
import type { StatsDashboardResponse, StatsKpi } from "~/types/stats";
import type { HomepageCardsResponse } from "~/types/site-settings";

const runtimeConfig = useRuntimeConfig();

const { data: coldProspectsCountResponse, pending: coldProspectsPending } =
  await useFetch<CountResponse>(
    () => `${runtimeConfig.public.apiUrl}/prospects/count`,
    {
      default: () => ({ total: 0 }),
      query: {
        status: "Prospect froid",
      },
    },
  );

const { data: importsInProgressCountResponse } = await useFetch<CountResponse>(
  () => `${runtimeConfig.public.apiUrl}/imports/count`,
  {
    default: () => ({ total: 0 }),
    query: {
      status: "queued,processing",
    },
  },
);

const { data: prospectsToRelaunchCountResponse } =
  await useFetch<CountResponse>(
    () => `${runtimeConfig.public.apiUrl}/prospects/relaunch/count`,
    {
      default: () => ({ total: 0 }),
    },
  );

const { data: queuedEmailsCountResponse } = await useFetch<CountResponse>(
  () => `${runtimeConfig.public.apiUrl}/prospects/email-queue/count`,
  {
    default: () => ({ total: 0 }),
  },
);

const { data: homepageCards } = await useFetch<HomepageCardsResponse>(
  () => `${runtimeConfig.public.apiUrl}/site-settings/homepage-cards`,
  {
    default: () => ({ blocks: DEFAULT_HOME_CARD_SETTINGS }),
  },
);

const { data: statsResponse } = await useFetch<StatsDashboardResponse>(
  () => `${runtimeConfig.public.apiUrl}/stats/dashboard`,
  {
    default: () => ({
      period: { range: "week", label: "La semaine", days: 7, from: "", to: "" },
      charts: [],
      durationCharts: [],
      kpis: [],
    }),
    query: {
      range: "week",
    },
  },
);

const activeImportsCount = computed(
  () => importsInProgressCountResponse.value?.total || 0,
);
const relaunchProspectsCount = computed(
  () => prospectsToRelaunchCountResponse.value?.total || 0,
);
const coldProspectsCount = computed(
  () => coldProspectsCountResponse.value?.total || 0,
);
const queuedEmailsCount = computed(
  () => queuedEmailsCountResponse.value?.total || 0,
);
const statsKpis = computed<StatsKpi[]>(() => {
  const kpis = statsResponse.value?.kpis || [];
  const wantedKeys = new Set([
    "shopifyDetectionRate",
    "contactFoundRate",
    "exploitablesRate",
    "leadScoreAverage",
    "contactedProspectsRate",
    "responseRate",
  ]);

  return kpis.filter((kpi) => wantedKeys.has(kpi.key)).slice(0, 6);
});

const homepageCardsMap = computed(() => {
  const settings = homepageCards.value?.blocks || DEFAULT_HOME_CARD_SETTINGS;
  return new Map(settings.map((item) => [item.key, item]));
});

const orderedHomepageCards = computed(() =>
  [...HOME_CARD_DEFINITIONS]
    .map((card) => {
      const settings = homepageCardsMap.value.get(card.key);
      return {
        ...card,
        position: settings?.position ?? 0,
        visible: settings?.visible ?? true,
      };
    })
    .sort((left, right) => left.position - right.position)
    .filter((card) => card.visible)
    .filter(
      (card) =>
        card.key !== "imports-in-progress" || activeImportsCount.value > 0,
    )
    .filter(
      (card) =>
        card.key !== "prospects-to-relaunch" ||
        relaunchProspectsCount.value > 0,
    )
    .filter(
      (card) => card.key !== "cold-prospects" || coldProspectsCount.value > 0,
    ),
);

function renderHomeCardDescription(cardKey: string) {
  if (cardKey === "imports-in-progress") {
    return activeImportsCount.value > 0
      ? `${activeImportsCount.value} import(s) sont en train d'être analysé(s) en arrière-plan.`
      : "Aucun import n’est en cours pour le moment.";
  }

  if (cardKey === "prospects-to-relaunch") {
    return relaunchProspectsCount.value > 0
      ? `${relaunchProspectsCount.value} prospect(s) doivent être relancés.`
      : "Aucune relance en attente.";
  }

  if (cardKey === "cold-prospects") {
    return coldProspectsPending.value
      ? "Chargement du compteur..."
      : "Les prospects froids sont prêts à être traités.";
  }

  if (cardKey === "queued-emails") {
    return queuedEmailsCount.value > 0
      ? `${queuedEmailsCount.value} email(s) sont actuellement en file d’envoi.`
      : "Aucun email n’est en file d’envoi pour le moment.";
  }

  return (
    HOME_CARD_DEFINITIONS.find((card) => card.key === cardKey)?.description ||
    ""
  );
}

function renderHomeCardBadgeValue(cardKey: string) {
  if (cardKey === "imports-in-progress") return activeImportsCount.value;
  if (cardKey === "prospects-to-relaunch") return relaunchProspectsCount.value;
  if (cardKey === "cold-prospects") return coldProspectsCount.value;
  if (cardKey === "queued-emails") return queuedEmailsCount.value;
  return undefined;
}

function renderHomeCardBadgeLabel(cardKey: string) {
  if (cardKey === "imports-in-progress") return "En cours";
  if (cardKey === "prospects-to-relaunch") return "À relancer";
  if (cardKey === "cold-prospects") return "A traiter";
  if (cardKey === "queued-emails") return "En file";
  return undefined;
}
</script>

<template>
  <LayoutPageShell eyebrow="Tableau de bord" title="Accueil" max-width="5xl">
    <section class="mt-6 space-y-4">
      <div class="flex items-end justify-between gap-3">
        <div>
          <p class="eyebrow-primary">Actions rapides</p>
          <p class="mt-1 body-muted">
            Les cartes ci-dessous regroupent les raccourcis utiles pour avancer
            vite dans la prospection.
          </p>
        </div>
        <UButton
          to="/settings"
          color="neutral"
          variant="soft"
          icon="i-lucide-settings-2"
        >
          Paramètres de l'accueil
        </UButton>
      </div>

      <div
        v-if="orderedHomepageCards.length > 0"
        class="grid gap-4 lg:grid-cols-3"
      >
        <HomeActionCard
          v-for="card in orderedHomepageCards"
          :key="card.key"
          :to="card.to"
          :eyebrow="card.eyebrow"
          :title="card.title"
          :description="renderHomeCardDescription(card.key)"
          :cta-label="card.ctaLabel"
          :icon="card.icon"
          :badge-label="renderHomeCardBadgeLabel(card.key)"
          :badge-value="renderHomeCardBadgeValue(card.key)"
          :badge-tone="card.badgeTone || 'slate'"
        />
      </div>

      <section
        v-else
        class="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-xs text-slate-600 shadow-sm"
      >
        Aucune card n’est visible pour l’instant. Va dans les paramètres de
        l’accueil pour en afficher.
      </section>
    </section>

    <HomeKpiSection
      class="mt-6"
      v-if="statsKpis.length > 0"
      :kpis="statsKpis"
    />
  </LayoutPageShell>
</template>
