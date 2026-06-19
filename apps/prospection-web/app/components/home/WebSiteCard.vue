<script setup lang="ts">
import type { HomeProspect } from "~/types/home-prospect";
import { getWebsiteCategoryConfig } from "~/utils/home-website-categories";
import { getProspectWorkflowStep } from "~/utils/prospect-process";

const props = defineProps<{
  prospect: HomeProspect;
}>();

const sourceUrl = computed(
  () => props.prospect.url?.url || props.prospect.sourceUrl || "",
);

const shopifyStatus = computed(() => {
  const normalized = String(
    props.prospect.url?.shopifyStatus || "",
  ).toLowerCase();

  if (normalized === "shopify") {
    return {
      label: "Shopify détecté",
      tone: "bg-emerald-100 text-emerald-700 ring-emerald-200",
      icon: "i-lucide-circle-check-big",
      accentBar: "bg-emerald-500",
    };
  }

  if (normalized === "not_shopify") {
    return {
      label: "Non Shopify",
      tone: "bg-amber-100 text-amber-700 ring-amber-200",
      icon: "i-lucide-circle-x",
      accentBar: "bg-amber-500",
    };
  }

  if (normalized === "error") {
    return {
      label: "Défectueux",
      tone: "bg-red-100 text-red-700 ring-red-200",
      icon: "i-lucide-circle-x",
      accentBar: "bg-red-500",
    };
  }

  return {
    label: "À vérifier",
    tone: "bg-slate-100 text-slate-700 ring-slate-200",
    icon: "i-lucide-circle-help",
    accentBar: "bg-slate-400",
  };
});

const category = computed(() => {
  const redesignStatus = String(
    props.prospect.url?.redesignStatus || "",
  ).toLowerCase();

  if (redesignStatus === "candidat refonte") {
    const config = getWebsiteCategoryConfig("refonte");

    return {
      label: "Candidat refonte",
      tone: config.filterTone,
      accent: config.cardAccent,
      accentBar: config.cardAccentBar,
      note: `Le thème utilisé est ${themeLabel.value}.`,
    };
  }

  if (redesignStatus === "candidat migration") {
    const config = getWebsiteCategoryConfig("migration");

    return {
      label: "Candidat migration",
      tone: config.filterTone,
      accent: config.cardAccent,
      accentBar: config.cardAccentBar,
      note: "Le site semble ne pas être sous Shopify.",
    };
  }

  const config = getWebsiteCategoryConfig("support");

  return {
    label: "Standard",
    tone: config.filterTone,
    accent: config.cardAccent,
    accentBar: config.cardAccentBar,
    note: "Le site ne montre pas de signal fort de refonte ou migration.",
  };
});

const themeLabel = computed(
  () => props.prospect.url?.shopifyThemeSchemaName?.trim() || "—",
);

const bannerImage = computed(
  () => props.prospect.avatarUrl || props.prospect.linkedinImageUrl || "",
);

const scoreLabel = computed(
  () => `${Math.max(0, Number(props.prospect.leadScore || 0))}`,
);

function toneFromScore(score: number | null) {
  const normalized = Math.max(0, Math.min(100, Number(score || 0)));

  if (normalized >= 85) {
    return "bg-emerald-100 text-emerald-700 ring-emerald-200";
  }

  if (normalized >= 60) {
    return "bg-amber-100 text-amber-700 ring-amber-200";
  }

  return "bg-slate-100 text-slate-500 ring-slate-200";
}

const lighthouseMetrics = computed(() => [
  {
    label: "Performance",
    value: props.prospect.url?.lighthousePerformanceScore ?? null,
  },
  {
    label: "Accessibilité",
    value: props.prospect.url?.lighthouseAccessibilityScore ?? null,
  },
  {
    label: "Best practices",
    value: props.prospect.url?.lighthouseBestPracticesScore ?? null,
  },
  {
    label: "SEO",
    value: props.prospect.url?.lighthouseSeoScore ?? null,
  },
]);

const contactAction = computed(() => {
  const workflow = getProspectWorkflowStep(props.prospect.status);

  return {
    label: workflow.actionLabel,
    href: `/prospects/${props.prospect.id}`,
    icon: "i-lucide-route",
    external: false,
    note: workflow.description,
  };
});

const workflowStep = computed(() =>
  getProspectWorkflowStep(props.prospect.status),
);

function openProcess() {
  return navigateTo(contactAction.value.href);
}
</script>

<template>
  <article
    class="cursor-pointer w-full overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-300"
    :class="category.accent"
    role="link"
    tabindex="0"
    @click="openProcess"
    @keydown.enter.prevent="openProcess"
    @keydown.space.prevent="openProcess"
  >
    <div class="h-1.5" :class="category.accentBar">
      <span class="sr-only">Accent</span>
    </div>

    <div class="p-4">
      <div
        class="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm"
      >
        <div class="relative aspect-[16/8] w-full">
          <img
            v-if="bannerImage"
            :src="bannerImage"
            :alt="prospect.siteName || prospect.name"
            class="h-full w-full object-cover object-center"
          />
          <div
            v-else
            class="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 via-slate-100 to-slate-50 px-6 text-center"
          >
            <div class="space-y-2">
              <div
                class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-base font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200"
              >
                {{
                  (prospect.siteName || prospect.name || "URL")
                    .slice(0, 2)
                    .toUpperCase()
                }}
              </div>
              <div class="text-xs font-medium text-slate-500">
                {{ prospect.siteName || prospect.name || "URL" }}
              </div>
            </div>
          </div>

          <div class="absolute right-3 top-3" @click.stop>
            <UButton
              color="neutral"
              variant="solid"
              size="xl"
              icon="i-lucide-external-link"
              as="a"
              :href="sourceUrl"
              target="_blank"
              rel="noreferrer"
              class="shadow-sm"
            />
          </div>
        </div>
      </div>

      <div class="mt-4 flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="truncate text-lg font-semibold text-slate-900">
            {{ prospect.siteName || prospect.name }}
          </div>
        </div>
      </div>

      <!-- liste des informations, on les caches pour le moments car par encore définitive -->
      <div
        v-if="false"
        class="mt-4 grid grid-cols-[auto_max-content_1fr] items-center justify-items-start gap-x-3 gap-y-3"
      >
        <div
          class="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-500"
        >
          <UIcon name="i-lucide-link" class="h-4 w-4" />
        </div>
        <div class="min-w-0">
          <div class="text-[13px] font-medium text-slate-500">URL</div>
        </div>
        <div class="truncate text-xs font-medium text-slate-900">
          {{ sourceUrl || "—" }}
        </div>

        <div
          class="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-500"
        >
          <UIcon name="i-lucide-user" class="h-4 w-4" />
        </div>
        <div class="min-w-0">
          <div class="text-[13px] font-medium text-slate-500">
            Statut Shopify
          </div>
        </div>
        <span
          class="inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium ring-1 ring-inset"
          :class="shopifyStatus.tone"
        >
          <UIcon :name="shopifyStatus.icon" class="h-4 w-4" />
          {{ shopifyStatus.label }}
        </span>

        <div
          class="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-500"
        >
          <UIcon name="i-lucide-square-stack" class="h-4 w-4" />
        </div>
        <div class="min-w-0">
          <div class="text-[13px] font-medium text-slate-500">
            Thème Shopify
          </div>
        </div>
        <span
          class="inline-flex shrink-0 rounded-lg bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200"
        >
          {{ themeLabel }}
        </span>

        <div
          class="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-500"
        >
          <UIcon name="i-lucide-gauge" class="h-4 w-4" />
        </div>
        <div class="min-w-0">
          <div class="text-[13px] font-medium text-slate-500">
            Score Lighthouse
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span
            v-for="metric in lighthouseMetrics"
            :key="metric.label"
            class="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ring-1 ring-inset"
            :class="toneFromScore(metric.value)"
            :title="`${metric.label}: ${metric.value ?? '—'}`"
          >
            {{ metric.value ?? "—" }}
          </span>
        </div>
      </div>

      <div class="mt-4 rounded-2xl border p-4" :class="category.accent">
        <div class="flex items-start gap-3">
          <UIcon
            name="i-lucide-sparkles"
            class="mt-0.5 h-5 w-5 shrink-0"
            :class="category.tone.split(' ')[1] || 'text-slate-500'"
          />
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="text-xs font-semibold"
                :class="category.tone.split(' ')[1] || 'text-slate-900'"
              >
                Statut suggéré
              </span>
              <span
                class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
                :class="category.tone"
              >
                {{ category.label }}
              </span>
            </div>
            <p class="mt-2 text-xs leading-6 text-slate-700">
              {{ category.note }}
            </p>
          </div>
        </div>
      </div>

      <div
        class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 text-xs text-slate-500"
      >
        <a
          v-if="sourceUrl"
          :href="sourceUrl"
          target="_blank"
          rel="noreferrer"
          class="truncate hover:text-sky-700"
        >
          {{ sourceUrl }}
        </a>
        <span>Score lead {{ scoreLabel }}</span>
      </div>
    </div>
  </article>
</template>
