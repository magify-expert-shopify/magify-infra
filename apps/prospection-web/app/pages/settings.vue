<script setup lang="ts">
import EmailTemplateSettings from "~/components/settings/EmailTemplateSettings.vue";
import EmailSendingSettings from "~/components/settings/EmailSendingSettings.vue";
import DiscordReminderSettings from "~/components/settings/DiscordReminderSettings.vue";
import EmailSignatureSettings from "~/components/settings/EmailSignatureSettings.vue";
import HomepageSettingsBlocks from "~/components/settings/HomepageSettingsBlocks.vue";
import LeadScoreSettings from "~/components/settings/LeadScoreSettings.vue";
import LeadScoreRecalcSettings from "~/components/settings/LeadScoreRecalcSettings.vue";
import ProspectRelaunchSettings from "~/components/settings/ProspectRelaunchSettings.vue";
import ProspectStatusRecalcSettings from "~/components/settings/ProspectStatusRecalcSettings.vue";
import ScanStepsSettings from "~/components/settings/ScanStepsSettings.vue";
import ScanTimeoutSettings from "~/components/settings/ScanTimeoutSettings.vue";
import SiteLinksSettings from "~/components/settings/SiteLinksSettings.vue";
import {
  DEFAULT_HOME_CARD_SETTINGS,
  type HomeCardSetting,
} from "~/lib/homepage-cards";
import type { HomepageCardsResponse } from "~/types/site-settings";
import { PROSPECT_STATUS_CONFIG } from "~/utils/prospect-statuses";

const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();
const settingsSections = [
  { id: "home", label: "Accueil" },
  { id: "lead-score", label: "Score lead" },
  { id: "lead-recalc", label: "Recalcul du score" },
  { id: "scan-steps", label: "Étapes de scan" },
  { id: "scan-timeout", label: "Timeout de scan" },
  { id: "prospect-relaunch", label: "Relance prospects" },
  { id: "prospect-statuses", label: "Statuts prospects" },
  { id: "prospect-status-recalc", label: "Recalcul des statuts" },
  { id: "site-links", label: "Liens du site" },
  { id: "email-sending", label: "Envoi d’emails" },
  { id: "discord-reminder", label: "Rappel Discord" },
  { id: "email-signature", label: "Signature email" },
  { id: "email-templates", label: "Templates email" },
];

function normalizeBlocks(blocks: HomeCardSetting[]) {
  const defaults = new Map(
    DEFAULT_HOME_CARD_SETTINGS.map((block) => [block.key, block]),
  );
  const byKey = new Map<string, HomeCardSetting>();

  for (const block of blocks) {
    const defaultBlock = defaults.get(block.key);
    if (!defaultBlock) {
      continue;
    }

    byKey.set(block.key, {
      key: defaultBlock.key,
      position: Number.isInteger(block.position)
        ? Math.max(0, Math.floor(block.position))
        : defaultBlock.position,
      visible: Boolean(block.visible),
    });
  }

  for (const defaultBlock of DEFAULT_HOME_CARD_SETTINGS) {
    if (!byKey.has(defaultBlock.key)) {
      byKey.set(defaultBlock.key, { ...defaultBlock });
    }
  }

  return [...byKey.values()]
    .sort((left, right) => left.position - right.position)
    .map((block, index) => ({
      key: block.key,
      position: index,
      visible: block.visible,
    }));
}

const { data, pending, error } = await useFetch<HomepageCardsResponse>(
  () => `${runtimeConfig.public.apiUrl}/site-settings/homepage-cards`,
  {
    default: () => ({ blocks: DEFAULT_HOME_CARD_SETTINGS }),
  },
);

const blocks = ref<HomeCardSetting[]>(
  normalizeBlocks(data.value?.blocks || DEFAULT_HOME_CARD_SETTINGS),
);
const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
const lastSavedSnapshot = ref<string>(
  JSON.stringify(
    normalizeBlocks(data.value?.blocks || DEFAULT_HOME_CARD_SETTINGS),
  ),
);
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let statusTimer: ReturnType<typeof setTimeout> | null = null;
let saveRequestId = 0;

watch(
  () => data.value?.blocks,
  (value) => {
    if (!value) {
      return;
    }

    const nextBlocks = normalizeBlocks(value);
    blocks.value = nextBlocks;
    lastSavedSnapshot.value = JSON.stringify(nextBlocks);
  },
  { immediate: true },
);

function formatStatusLabel() {
  if (saveState.value === "saving") return "Enregistrement...";
  if (saveState.value === "saved") return "Modifications enregistrées";
  if (saveState.value === "error") return "Erreur d’enregistrement";
  return "Enregistrement automatique";
}

function scheduleSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    void saveBlocks();
  }, 300);
}

async function saveBlocks() {
  const requestId = ++saveRequestId;
  const payloadBlocks = blocks.value.map((block, index) => ({
    key: block.key,
    visible: block.visible,
    position: index,
  }));
  const snapshot = JSON.stringify(payloadBlocks);

  if (snapshot === lastSavedSnapshot.value) {
    saveState.value = "idle";
    return;
  }

  saveState.value = "saving";

  try {
    const result = await $fetch<HomepageCardsResponse>(
      `${runtimeConfig.public.apiUrl}/site-settings/homepage-cards`,
      {
        method: "PUT",
        body: {
          blocks: payloadBlocks,
        },
      },
    );

    if (requestId !== saveRequestId) {
      return;
    }

    blocks.value = normalizeBlocks(result.blocks);
    lastSavedSnapshot.value = JSON.stringify(
      blocks.value.map((block, index) => ({
        key: block.key,
        visible: block.visible,
        position: index,
      })),
    );
    saveState.value = "saved";
  } catch (saveError) {
    if (requestId !== saveRequestId) {
      return;
    }

    saveState.value = "error";
    notifications.add({
      kind: "error",
      title: "Paramètres de l’accueil",
      message:
        saveError instanceof Error
          ? saveError.message
          : "Impossible d’enregistrer les réglages.",
    });
  } finally {
    if (requestId === saveRequestId) {
      if (statusTimer) {
        clearTimeout(statusTimer);
      }

      statusTimer = window.setTimeout(() => {
        if (saveState.value === "saved" || saveState.value === "error") {
          saveState.value = "idle";
        }
      }, 1800);
    }
  }
}

onBeforeUnmount(() => {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  if (statusTimer) {
    clearTimeout(statusTimer);
  }
});
</script>

<template>
  <LayoutPageShell
    eyebrow="Paramètres"
    title="Paramètres du site"
    description="Réorganise les cards de l’accueil, règle les étapes de scan et leur timeout par défaut, définit le délai avant de relancer un prospect, renseigne les liens du site utilisés dans les templates d’emails, ajuste les modèles de messages du composeur et personnalise les règles du score lead. L’ordre et la visibilité de l’accueil sont enregistrés automatiquement."
    max-width="6xl"
  >
    <template #actions>
      <UButton to="/" color="neutral" variant="soft" icon="i-lucide-arrow-left">
        Retour à l’accueil
      </UButton>
    </template>

    <section class="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
      <aside class="sticky top-32 hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:block">
        <div class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Sommaire
        </div>
        <nav class="mt-4 space-y-1">
          <a
            v-for="section in settingsSections"
            :key="section.id"
            :href="`#${section.id}`"
            class="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <span class="font-medium">{{ section.label }}</span>
            <UIcon name="i-lucide-chevron-right" class="h-4 w-4 text-slate-400" />
          </a>
        </nav>
      </aside>

      <div class="space-y-4">
      <section
        v-if="pending"
        class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div class="text-muted-sm">
          Chargement des paramètres de l’accueil...
        </div>
      </section>

      <UAlert
        v-else-if="error"
        color="error"
        variant="soft"
        icon="i-lucide-alert-circle"
        title="Impossible de charger les paramètres de l’accueil"
      />

      <section id="home" class="scroll-mt-24" v-else>
        <HomepageSettingsBlocks v-model="blocks" @change="scheduleSave">
          <template #status>
            <div class="text-xs font-medium text-slate-500">
              {{ formatStatusLabel() }}
            </div>
          </template>
        </HomepageSettingsBlocks>
      </section>

      <section id="lead-score" class="scroll-mt-24">
        <LeadScoreSettings />
      </section>

      <section id="lead-recalc" class="scroll-mt-24">
        <LeadScoreRecalcSettings />
      </section>

      <section id="scan-steps" class="scroll-mt-24">
        <ScanStepsSettings />
      </section>

      <section id="scan-timeout" class="scroll-mt-24">
        <ScanTimeoutSettings />
      </section>

      <section id="prospect-relaunch" class="scroll-mt-24">
        <ProspectRelaunchSettings />
      </section>

      <section
        id="prospect-statuses"
        class="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div
              class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
            >
              Statuts prospects
            </div>
            <h2 class="mt-1 text-lg font-semibold text-slate-900">
              Règles associées aux statuts
            </h2>
            <p class="mt-1 text-muted-sm">
              Chaque carte rappelle la règle métier qui déclenche ou définit le
              statut prospect.
            </p>
          </div>
          <UBadge color="neutral" variant="soft">
            {{ PROSPECT_STATUS_CONFIG.length }} statuts
          </UBadge>
        </div>

        <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="status in PROSPECT_STATUS_CONFIG"
            :key="status.status"
            class="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-xs font-semibold text-slate-900">
                  {{ status.status }}
                </div>
                <div
                  class="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-400"
                >
                  {{ status.label }}
                </div>
              </div>
              <span
                class="inline-flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-inset"
                :class="status.tone"
              >
                <UIcon :name="status.icon" class="h-4 w-4" />
              </span>
            </div>

            <p class="mt-3 body-muted">
              {{ status.rule }}
            </p>
          </article>
        </div>
      </section>

      <section id="prospect-status-recalc" class="scroll-mt-24">
        <ProspectStatusRecalcSettings />
      </section>

      <section id="site-links" class="scroll-mt-24">
        <SiteLinksSettings />
      </section>

      <section id="email-sending" class="scroll-mt-24">
        <EmailSendingSettings />
      </section>

      <section id="discord-reminder" class="scroll-mt-24">
        <DiscordReminderSettings />
      </section>

      <section id="email-signature" class="scroll-mt-24">
        <EmailSignatureSettings />
      </section>

      <section id="email-templates" class="scroll-mt-24">
        <EmailTemplateSettings />
      </section>
      </div>
    </section>
  </LayoutPageShell>
</template>
