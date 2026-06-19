<script setup lang="ts">
import type { LeadScoreSettingsResponse } from "~/types/site-settings";

const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();

const emptySettings: LeadScoreSettingsResponse = {
  shopify: {
    shopify: 2,
    cms: 1,
    other: 0,
  },
  theme: {
    dawn: 2,
    other: 1,
    custom: 0,
  },
  language: {
    french: 8,
    english: 2,
    other: 0,
  },
  companyCountry: {
    france: 8,
    missing: 6,
    other: 0,
  },
  legalNotice: {
    missing: 2,
    found: 0,
  },
  catalog: {
    productCount: {
      thresholds: {
        high: 100,
        medium: 30,
      },
      points: {
        high: 3,
        medium: 2,
        low: 1,
        none: 0,
      },
    },
    medianProductPrice: {
      thresholds: {
        high: 150,
        medium: 80,
        low: 30,
      },
      points: {
        high: 3,
        medium: 2,
        low: 1,
        none: 0,
      },
    },
  },
  lighthouse: {
    thresholds: {
      excellent: 85,
      good: 70,
      average: 55,
      poor: 40,
    },
    points: {
      excellent: 0,
      good: 1,
      average: 2,
      poor: 3,
      critical: 4,
    },
  },
};

const { data, pending, error } = await useFetch<LeadScoreSettingsResponse>(
  () => `${runtimeConfig.public.apiUrl}/site-settings/lead-score`,
  {
    default: () => structuredClone(emptySettings),
  },
);

const settings = ref<LeadScoreSettingsResponse>(structuredClone(emptySettings));
const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
const lastSavedSnapshot = ref("");
const saveError = ref("");

watch(
  () => data.value,
  (value) => {
    if (!value) {
      return;
    }

    settings.value = structuredClone(value);
    lastSavedSnapshot.value = JSON.stringify(settings.value);
  },
  { immediate: true },
);

const hasChanges = computed(
  () => JSON.stringify(settings.value) !== lastSavedSnapshot.value,
);

function normalizeNumber(value: string | number) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? Math.max(0, Math.round(nextValue)) : 0;
}

function updateShopify(
  key: keyof LeadScoreSettingsResponse["shopify"],
  value: string | number,
) {
  settings.value = {
    ...settings.value,
    shopify: {
      ...settings.value.shopify,
      [key]: normalizeNumber(value),
    },
  };
}

function updateSiren(
  key: keyof LeadScoreSettingsResponse["siren"],
  value: string | number,
) {
  settings.value = {
    ...settings.value,
    siren: {
      ...settings.value.siren,
      [key]: normalizeNumber(value),
    },
  };
}

function updateTheme(
  key: keyof LeadScoreSettingsResponse["theme"],
  value: string | number,
) {
  settings.value = {
    ...settings.value,
    theme: {
      ...settings.value.theme,
      [key]: normalizeNumber(value),
    },
  };
}

function updateLanguage(
  key: keyof LeadScoreSettingsResponse["language"],
  value: string | number,
) {
  settings.value = {
    ...settings.value,
    language: {
      ...settings.value.language,
      [key]: normalizeNumber(value),
    },
  };
}

function updateCompanyCountry(
  key: keyof LeadScoreSettingsResponse["companyCountry"],
  value: string | number,
) {
  settings.value = {
    ...settings.value,
    companyCountry: {
      ...settings.value.companyCountry,
      [key]: normalizeNumber(value),
    },
  };
}

function updateLegalNotice(
  key: keyof LeadScoreSettingsResponse["legalNotice"],
  value: string | number,
) {
  settings.value = {
    ...settings.value,
    legalNotice: {
      ...settings.value.legalNotice,
      [key]: normalizeNumber(value),
    },
  };
}

function updateCatalogProductCount(
  section: keyof LeadScoreSettingsResponse["catalog"]["productCount"],
  key: keyof LeadScoreSettingsResponse["catalog"]["productCount"][typeof section],
  value: string | number,
) {
  settings.value = {
    ...settings.value,
    catalog: {
      ...settings.value.catalog,
      productCount: {
        ...settings.value.catalog.productCount,
        [section]: {
          ...settings.value.catalog.productCount[section],
          [key]: normalizeNumber(value),
        },
      },
    },
  };
}

function updateCatalogMedianPrice(
  section: keyof LeadScoreSettingsResponse["catalog"]["medianProductPrice"],
  key: keyof LeadScoreSettingsResponse["catalog"]["medianProductPrice"][typeof section],
  value: string | number,
) {
  settings.value = {
    ...settings.value,
    catalog: {
      ...settings.value.catalog,
      medianProductPrice: {
        ...settings.value.catalog.medianProductPrice,
        [section]: {
          ...settings.value.catalog.medianProductPrice[section],
          [key]: normalizeNumber(value),
        },
      },
    },
  };
}

function updateThreshold(
  key: keyof LeadScoreSettingsResponse["lighthouse"]["thresholds"],
  value: string | number,
) {
  settings.value = {
    ...settings.value,
    lighthouse: {
      ...settings.value.lighthouse,
      thresholds: {
        ...settings.value.lighthouse.thresholds,
        [key]: normalizeNumber(value),
      },
    },
  };
}

function updatePoint(
  key: keyof LeadScoreSettingsResponse["lighthouse"]["points"],
  value: string | number,
) {
  settings.value = {
    ...settings.value,
    lighthouse: {
      ...settings.value.lighthouse,
      points: {
        ...settings.value.lighthouse.points,
        [key]: normalizeNumber(value),
      },
    },
  };
}

async function saveSettings() {
  if (!hasChanges.value || saveState.value === "saving") {
    return;
  }

  saveState.value = "saving";
  saveError.value = "";

  try {
    const result = await $fetch<LeadScoreSettingsResponse>(
      `${runtimeConfig.public.apiUrl}/site-settings/lead-score`,
      {
        method: "PUT",
        body: settings.value,
      },
    );

    settings.value = structuredClone(result);
    lastSavedSnapshot.value = JSON.stringify(settings.value);
    saveState.value = "saved";
    notifications.add({
      kind: "success",
      title: "Score lead enregistré",
      message: "Les règles de calcul du lead score ont été mises à jour.",
    });
  } catch (error) {
    saveState.value = "error";
    saveError.value =
      error instanceof Error
        ? error.message
        : "Impossible d’enregistrer les règles de score.";
    notifications.add({
      kind: "error",
      title: "Enregistrement du score lead échoué",
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
          Poids du score lead
        </div>
        <p class="mt-1 text-xs text-slate-600">
          Ajuste ici les poids utilisés pour construire le score lead: Shopify,
          CMS, SIREN, thème, langue du site, pays de l'entreprise, catalogue,
          mentions légales et Lighthouse.
        </p>
      </div>

      <UButton
        color="primary"
        variant="solid"
        size="sm"
        icon="i-lucide-save"
        :loading="saveState === 'saving'"
        :disabled="pending || !hasChanges"
        @click="saveSettings"
      >
        Enregistrer
      </UButton>
    </div>

    <UAlert
      v-if="error"
      class="mt-4"
      color="error"
      variant="soft"
      icon="i-lucide-alert-circle"
      title="Impossible de charger les règles de score"
      :description="error.message || 'Une erreur est survenue.'"
    />

    <div
      v-if="saveError"
      class="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"
    >
      {{ saveError }}
    </div>

    <div class="mt-6 grid gap-4 lg:grid-cols-3">
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div class="text-xs font-semibold text-slate-900">Shopify</div>
        <p class="mt-1 text-xs text-slate-500">
          Points appliqués selon que la boutique soit Shopify, un CMS détecté,
          ou autre.
        </p>

        <div class="mt-4 grid gap-3">
          <UFormField label="Shopify" class="space-y-1">
            <UInput
              type="number"
              min="0"
              step="1"
              :model-value="settings.shopify.shopify"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updateShopify('shopify', $event)"
            />
          </UFormField>

          <UFormField
            label="CMS (WooCommerce, PrestaShop...)"
            class="space-y-1"
          >
            <UInput
              type="number"
              min="0"
              step="1"
              :model-value="settings.shopify.cms"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updateShopify('cms', $event)"
            />
          </UFormField>

          <UFormField label="Autre" class="space-y-1">
            <UInput
              type="number"
              min="0"
              step="1"
              :model-value="settings.shopify.other"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updateShopify('other', $event)"
            />
          </UFormField>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div class="text-xs font-semibold text-slate-900">SIREN</div>
        <p class="mt-1 text-xs text-slate-500">
          Les points sont appliqués si un SIREN est trouvé sur le site.
        </p>

        <div class="mt-4 grid gap-3">
          <UFormField label="SIREN trouvé" class="space-y-1">
            <UInput
              type="number"
              min="0"
              step="1"
              :model-value="settings.siren.found"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updateSiren('found', $event)"
            />
          </UFormField>

          <UFormField label="SIREN absent" class="space-y-1">
            <UInput
              type="number"
              min="0"
              step="1"
              :model-value="settings.siren.missing"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updateSiren('missing', $event)"
            />
          </UFormField>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div class="text-xs font-semibold text-slate-900">Thème</div>
        <p class="mt-1 text-xs text-slate-500">
          Ajuste les points selon le type de thème détecté.
        </p>

        <div class="mt-4 grid gap-3">
          <UFormField label="Thème gratuit Shopify" class="space-y-1">
            <UInput
              type="number"
              min="0"
              step="1"
              :model-value="settings.theme.dawn"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updateTheme('dawn', $event)"
            />
          </UFormField>

          <UFormField label="Autre" class="space-y-1">
            <UInput
              type="number"
              min="0"
              step="1"
              :model-value="settings.theme.other"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updateTheme('other', $event)"
            />
          </UFormField>

          <UFormField label="Custom" class="space-y-1">
            <UInput
              type="number"
              min="0"
              step="1"
              :model-value="settings.theme.custom"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updateTheme('custom', $event)"
            />
          </UFormField>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div class="text-xs font-semibold text-slate-900">Langue du site</div>
        <p class="mt-1 text-xs text-slate-500">
          Les points sont appliqués selon la langue principale détectée sur le
          site.
        </p>

        <div class="mt-4 grid gap-3">
          <UFormField label="Français" class="space-y-1">
            <UInput
              type="number"
              min="0"
              step="1"
              :model-value="settings.language.french"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updateLanguage('french', $event)"
            />
          </UFormField>

          <UFormField label="Anglais" class="space-y-1">
            <UInput
              type="number"
              min="0"
              step="1"
              :model-value="settings.language.english"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updateLanguage('english', $event)"
            />
          </UFormField>

          <UFormField label="Autre langue" class="space-y-1">
            <UInput
              type="number"
              min="0"
              step="1"
              :model-value="settings.language.other"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updateLanguage('other', $event)"
            />
          </UFormField>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div class="text-xs font-semibold text-slate-900">
          Pays de l'entreprise
        </div>
        <p class="mt-1 text-xs text-slate-500">
          Les points sont appliqués selon le pays de l’entreprise détecté dans
          la fiche prospect.
        </p>

        <div class="mt-4 grid gap-3">
          <UFormField label="France" class="space-y-1">
            <UInput
              type="number"
              min="0"
              step="1"
              :model-value="settings.companyCountry.france"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updateCompanyCountry('france', $event)"
            />
          </UFormField>

          <UFormField label="Non trouvé" class="space-y-1">
            <UInput
              type="number"
              min="0"
              step="1"
              :model-value="settings.companyCountry.missing"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updateCompanyCountry('missing', $event)"
            />
          </UFormField>

          <UFormField label="Autre pays" class="space-y-1">
            <UInput
              type="number"
              min="0"
              step="1"
              :model-value="settings.companyCountry.other"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updateCompanyCountry('other', $event)"
            />
          </UFormField>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div class="text-xs font-semibold text-slate-900">
          Catalogue produits
        </div>
        <p class="mt-1 text-xs text-slate-500">
          Les points sont calculés selon le nombre de produits et le prix médian
          détectés dans le catalogue.
        </p>

        <div class="mt-4 grid gap-5">
          <div class="rounded-xl border border-slate-200 bg-white p-3">
            <div
              class="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Nombre de produits
            </div>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <UFormField label="≥ Haut" class="space-y-1">
                <UInput
                  type="number"
                  min="0"
                  step="1"
                  :model-value="settings.catalog.productCount.thresholds.high"
                  class="w-full min-w-0 rounded-xl bg-white"
                  @update:model-value="
                    updateCatalogProductCount('thresholds', 'high', $event)
                  "
                />
              </UFormField>

              <UFormField label="Points haut" class="space-y-1">
                <UInput
                  type="number"
                  min="0"
                  step="1"
                  :model-value="settings.catalog.productCount.points.high"
                  class="w-full min-w-0 rounded-xl bg-white"
                  @update:model-value="
                    updateCatalogProductCount('points', 'high', $event)
                  "
                />
              </UFormField>

              <UFormField label="≥ Moyen" class="space-y-1">
                <UInput
                  type="number"
                  min="0"
                  step="1"
                  :model-value="settings.catalog.productCount.thresholds.medium"
                  class="w-full min-w-0 rounded-xl bg-white"
                  @update:model-value="
                    updateCatalogProductCount('thresholds', 'medium', $event)
                  "
                />
              </UFormField>

              <UFormField label="Points moyen" class="space-y-1">
                <UInput
                  type="number"
                  min="0"
                  step="1"
                  :model-value="settings.catalog.productCount.points.medium"
                  class="w-full min-w-0 rounded-xl bg-white"
                  @update:model-value="
                    updateCatalogProductCount('points', 'medium', $event)
                  "
                />
              </UFormField>

              <UFormField label="Points faible" class="space-y-1">
                <UInput
                  type="number"
                  min="0"
                  step="1"
                  :model-value="settings.catalog.productCount.points.low"
                  class="w-full min-w-0 rounded-xl bg-white"
                  @update:model-value="
                    updateCatalogProductCount('points', 'low', $event)
                  "
                />
              </UFormField>

              <UFormField label="Points aucun produit" class="space-y-1">
                <UInput
                  type="number"
                  min="0"
                  step="1"
                  :model-value="settings.catalog.productCount.points.none"
                  class="w-full min-w-0 rounded-xl bg-white"
                  @update:model-value="
                    updateCatalogProductCount('points', 'none', $event)
                  "
                />
              </UFormField>
            </div>
          </div>

          <div class="rounded-xl border border-slate-200 bg-white p-3">
            <div
              class="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Prix médian produit
            </div>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <UFormField label="≥ Haut" class="space-y-1">
                <UInput
                  type="number"
                  min="0"
                  step="1"
                  :model-value="
                    settings.catalog.medianProductPrice.thresholds.high
                  "
                  class="w-full min-w-0 rounded-xl bg-white"
                  @update:model-value="
                    updateCatalogMedianPrice('thresholds', 'high', $event)
                  "
                />
              </UFormField>

              <UFormField label="Points haut" class="space-y-1">
                <UInput
                  type="number"
                  min="0"
                  step="1"
                  :model-value="settings.catalog.medianProductPrice.points.high"
                  class="w-full min-w-0 rounded-xl bg-white"
                  @update:model-value="
                    updateCatalogMedianPrice('points', 'high', $event)
                  "
                />
              </UFormField>

              <UFormField label="≥ Moyen" class="space-y-1">
                <UInput
                  type="number"
                  min="0"
                  step="1"
                  :model-value="
                    settings.catalog.medianProductPrice.thresholds.medium
                  "
                  class="w-full min-w-0 rounded-xl bg-white"
                  @update:model-value="
                    updateCatalogMedianPrice('thresholds', 'medium', $event)
                  "
                />
              </UFormField>

              <UFormField label="Points moyen" class="space-y-1">
                <UInput
                  type="number"
                  min="0"
                  step="1"
                  :model-value="
                    settings.catalog.medianProductPrice.points.medium
                  "
                  class="w-full min-w-0 rounded-xl bg-white"
                  @update:model-value="
                    updateCatalogMedianPrice('points', 'medium', $event)
                  "
                />
              </UFormField>

              <UFormField label="≥ Faible" class="space-y-1">
                <UInput
                  type="number"
                  min="0"
                  step="1"
                  :model-value="
                    settings.catalog.medianProductPrice.thresholds.low
                  "
                  class="w-full min-w-0 rounded-xl bg-white"
                  @update:model-value="
                    updateCatalogMedianPrice('thresholds', 'low', $event)
                  "
                />
              </UFormField>

              <UFormField label="Points faible" class="space-y-1">
                <UInput
                  type="number"
                  min="0"
                  step="1"
                  :model-value="settings.catalog.medianProductPrice.points.low"
                  class="w-full min-w-0 rounded-xl bg-white"
                  @update:model-value="
                    updateCatalogMedianPrice('points', 'low', $event)
                  "
                />
              </UFormField>

              <UFormField
                label="Points aucun prix"
                class="space-y-1 sm:col-span-2"
              >
                <UInput
                  type="number"
                  min="0"
                  step="1"
                  :model-value="settings.catalog.medianProductPrice.points.none"
                  class="w-full min-w-0 rounded-xl bg-white"
                  @update:model-value="
                    updateCatalogMedianPrice('points', 'none', $event)
                  "
                />
              </UFormField>
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div class="text-xs font-semibold text-slate-900">Mentions légales</div>
        <p class="mt-1 text-xs text-slate-500">
          Récompense la présence ou l’absence d’une page de mentions légales sur
          les sites Shopify.
        </p>

        <div class="mt-4 grid gap-3">
          <UFormField label="Si la page est absente" class="space-y-1">
            <UInput
              type="number"
              min="0"
              step="1"
              :model-value="settings.legalNotice.missing"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updateLegalNotice('missing', $event)"
            />
          </UFormField>

          <UFormField label="Si la page est présente" class="space-y-1">
            <UInput
              type="number"
              min="0"
              step="1"
              :model-value="settings.legalNotice.found"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updateLegalNotice('found', $event)"
            />
          </UFormField>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div class="text-xs font-semibold text-slate-900">Lighthouse</div>
        <p class="mt-1 text-xs text-slate-500">
          Les paliers définissent le nombre de points ajoutés selon la moyenne
          des scores Lighthouse.
        </p>

        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <UFormField label="≥ Excellent" class="space-y-1">
            <UInput
              type="number"
              min="0"
              max="100"
              step="1"
              :model-value="settings.lighthouse.thresholds.excellent"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updateThreshold('excellent', $event)"
            />
          </UFormField>

          <UFormField label="Points excellent" class="space-y-1">
            <UInput
              type="number"
              min="0"
              step="1"
              :model-value="settings.lighthouse.points.excellent"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updatePoint('excellent', $event)"
            />
          </UFormField>

          <UFormField label="≥ Bon" class="space-y-1">
            <UInput
              type="number"
              min="0"
              max="100"
              step="1"
              :model-value="settings.lighthouse.thresholds.good"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updateThreshold('good', $event)"
            />
          </UFormField>

          <UFormField label="Points bon" class="space-y-1">
            <UInput
              type="number"
              min="0"
              step="1"
              :model-value="settings.lighthouse.points.good"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updatePoint('good', $event)"
            />
          </UFormField>

          <UFormField label="≥ Moyen" class="space-y-1">
            <UInput
              type="number"
              min="0"
              max="100"
              step="1"
              :model-value="settings.lighthouse.thresholds.average"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updateThreshold('average', $event)"
            />
          </UFormField>

          <UFormField label="Points moyen" class="space-y-1">
            <UInput
              type="number"
              min="0"
              step="1"
              :model-value="settings.lighthouse.points.average"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updatePoint('average', $event)"
            />
          </UFormField>

          <UFormField label="≥ Faible" class="space-y-1">
            <UInput
              type="number"
              min="0"
              max="100"
              step="1"
              :model-value="settings.lighthouse.thresholds.poor"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updateThreshold('poor', $event)"
            />
          </UFormField>

          <UFormField label="Points faible" class="space-y-1">
            <UInput
              type="number"
              min="0"
              step="1"
              :model-value="settings.lighthouse.points.poor"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updatePoint('poor', $event)"
            />
          </UFormField>

          <UFormField label="Points critique" class="space-y-1 sm:col-span-2">
            <UInput
              type="number"
              min="0"
              step="1"
              :model-value="settings.lighthouse.points.critical"
              class="w-full min-w-0 rounded-xl bg-white"
              @update:model-value="updatePoint('critical', $event)"
            />
          </UFormField>
        </div>
      </div>
    </div>

    <div
      class="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600"
    >
      Score final = points Shopify + points CMS + points SIREN + points thème +
      points langue + points pays entreprise + points catalogue + points
      mentions légales + points Lighthouse. Les valeurs affichées ici sont
      celles appliquées au recalcul du lead score.
    </div>
    <p v-if="saveState === 'saved'" class="mt-4 text-xs text-emerald-600">
      Règles de score enregistrées.
    </p>
  </section>
</template>
