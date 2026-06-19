<script setup lang="ts">
import type { LighthouseObservation, UrlDetail } from "~/types/urls";

const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const id = computed(() => Number(route.params.id));
const notifications = useNotificationsStore();
const togglingBlacklist = ref(false);

const { data, pending, error, refresh } = await useFetch<UrlDetail>(
  () => `${runtimeConfig.public.apiUrl}/urls/${id.value}`,
  {
    watch: [id],
  },
);

function formatDate(value: string | null) {
  if (!value) return "Jamais";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Jamais";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function badgeTone(
  value: string | null,
  kind: "shopify" | "contact" | "redesign",
) {
  const normalized = String(value || "").toLowerCase();

  if (kind === "shopify") {
    if (normalized === "shopify")
      return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    if (normalized === "not_shopify")
      return "bg-amber-100 text-amber-700 ring-amber-200";
    if (normalized === "error") return "bg-red-100 text-red-700 ring-red-200";
    return "bg-slate-100 text-slate-700 ring-slate-200";
  }

  if (kind === "contact") {
    if (normalized === "found")
      return "bg-blue-100 text-blue-700 ring-blue-200";
    if (normalized === "error") return "bg-red-100 text-red-700 ring-red-200";
    if (normalized === "not_found")
      return "bg-slate-100 text-slate-700 ring-slate-200";
    return "bg-slate-100 text-slate-700 ring-slate-200";
  }

  if (normalized === "cible") return "bg-sky-100 text-sky-700 ring-sky-200";
  if (normalized === "candidat")
    return "bg-indigo-100 text-indigo-700 ring-indigo-200";
  if (normalized.includes("migration"))
    return "bg-amber-100 text-amber-700 ring-amber-200";
  if (normalized.includes("refonte"))
    return "bg-sky-100 text-sky-700 ring-sky-200";
  if (normalized === "ignore") return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

const lighthouseObservations = computed(() => {
  try {
    const parsed = JSON.parse(
      data.value?.lighthouseObservationsJson || "[]",
    ) as LighthouseObservation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
});

function observationTone(severity: LighthouseObservation["severity"]) {
  if (severity === "critical")
    return "border-rose-200 bg-rose-50 text-rose-900";
  if (severity === "warning")
    return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-800";
}

const socialLinks = computed(() => {
  try {
    return JSON.parse(data.value?.contactSocialLinksJson || "[]") as string[];
  } catch {
    return [];
  }
});

function socialLinkLabel(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./i, "");
  } catch {
    return "Réseau";
  }
}

function getShopifyLabel(value: string | null) {
  const normalized = String(value || "").toLowerCase();

  if (normalized === "shopify") return "Shopify";
  if (normalized === "not_shopify") return "Non Shopify";
  if (normalized === "error") return "Défectueux";

  return value || "—";
}

const isBlacklisted = computed(() => Boolean(data.value?.blacklistedAt));

function blacklistActionLabel() {
  return isBlacklisted.value ? "Sortir de la black list" : "Blacklister l'URL";
}

async function toggleBlacklist() {
  if (!data.value || togglingBlacklist.value) {
    return;
  }

  const wasBlacklisted = isBlacklisted.value;
  togglingBlacklist.value = true;

  try {
    await $fetch(
      `${runtimeConfig.public.apiUrl}/urls/${data.value.id}/${wasBlacklisted ? "unblacklist" : "blacklist"}`,
      {
        method: "PATCH",
      },
    );

    await refresh();

    notifications.add({
      kind: "success",
      title: wasBlacklisted ? "URL sortie de la black list" : "URL blacklistée",
      message: data.value.siteName || data.value.siteKey || data.value.url,
    });
  } catch (error) {
    notifications.add({
      kind: "error",
      title: wasBlacklisted
        ? "Sortie de black list échouée"
        : "Blacklist échouée",
      message:
        error instanceof Error
          ? error.message
          : "Impossible de modifier la black list de cette URL.",
    });
  } finally {
    togglingBlacklist.value = false;
  }
}
</script>

<template>
  <main class="min-h-screen bg-background text-slate-900">
    <section class="w-full px-5 py-6 lg:px-8">
      <div class="w-full">
        <div
          class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
        >
          <div class="space-y-2">
            <div class="flex items-center gap-3">
              <UButton
                to="/urls"
                color="neutral"
                variant="outline"
                icon="i-lucide-arrow-left"
                size="sm"
              >
                Retour
              </UButton>
              <p
                class="text-[11px] font-medium uppercase tracking-[0.18em] text-sky-700"
              >
                Détail URL
              </p>
            </div>
            <div class="space-y-1">
              <h1 class="page-title">
                {{ data?.siteName || data?.siteKey || data?.url || "URL" }}
              </h1>
              <p class="max-w-3xl body-muted">
                Fiche complète de l’URL avec les statuts, les mesures de scan et
                les informations de contact extraites par l’API.
              </p>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="data?.url"
              color="neutral"
              variant="soft"
              icon="i-lucide-external-link"
              as="a"
              :href="data.url"
              target="_blank"
              rel="noreferrer"
            >
              Ouvrir le site
            </UButton>
            <UButton
              :color="isBlacklisted ? 'warning' : 'error'"
              variant="soft"
              :icon="isBlacklisted ? 'i-lucide-circle-off' : 'i-lucide-ban'"
              :loading="togglingBlacklist"
              :disabled="pending"
              @click="toggleBlacklist"
            >
              {{ blacklistActionLabel() }}
            </UButton>
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-refresh-cw"
              :loading="pending"
              @click="refresh()"
            >
              Rafraîchir
            </UButton>
          </div>
        </div>
      </div>
    </section>

    <section class="w-full px-5 pb-6 lg:px-8">
      <div
        v-if="pending"
        class="rounded-lg border border-slate-200 bg-white px-6 py-12 text-muted-sm"
      >
        Chargement du détail...
      </div>

      <div
        v-else-if="error"
        class="rounded-lg border border-red-200 bg-white px-6 py-12 text-xs text-red-600"
      >
        Impossible de charger cette URL.
      </div>

      <template v-else-if="data">
        <div class="grid gap-4 lg:grid-cols-3">
          <div class="rounded-xl border border-slate-200 bg-white p-5">
            <div
              class="text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Statuts
            </div>
            <div class="mt-4 space-y-3">
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-sm">Shopify</span>
                <span
                  class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset"
                  :class="badgeTone(data.shopifyStatus, 'shopify')"
                >
                  {{ getShopifyLabel(data.shopifyStatus) }}
                </span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-sm">Contact</span>
                <span
                  class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset"
                  :class="badgeTone(data.contactStatus, 'contact')"
                >
                  {{ data.contactStatus }}
                </span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-sm">Refonte</span>
                <span
                  class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset"
                  :class="badgeTone(data.redesignStatus, 'redesign')"
                >
                  {{ data.redesignStatus || "none" }}
                </span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-muted-sm">Blacklist</span>
                <span
                  class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset"
                  :class="
                    isBlacklisted
                      ? 'bg-red-100 text-red-700 ring-red-200'
                      : 'bg-emerald-100 text-emerald-700 ring-emerald-200'
                  "
                >
                  {{ isBlacklisted ? "Black listée" : "Active" }}
                </span>
              </div>
            </div>
          </div>

          <div
            class="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2"
          >
            <div
              class="text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Résumé
            </div>
            <dl class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <dt class="text-xs text-slate-500">URL</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900 break-all">
                  {{ data.url }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">Nom du site</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{ data.siteName || "—" }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">Source file</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{ data.sourceFile }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">Site key</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{ data.siteKey || "—" }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">Créée</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{ formatDate(data.createdAt) }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">Dernier check Shopify</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{ formatDate(data.shopifyCheckedAt) }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">Black listée</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{ formatDate(data.blacklistedAt) }}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div class="mt-4 grid gap-4 lg:grid-cols-2">
          <div class="rounded-xl border border-slate-200 bg-white p-5">
            <div
              class="text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Scan
            </div>
            <dl class="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt class="text-xs text-slate-500">HTTP status</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{ data.httpStatus ?? "—" }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">TTFB</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{ data.scanTtfbMs ?? "—" }} ms
                </dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">Total</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{ data.scanTotalMs ?? "—" }} ms
                </dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">Poids HTML</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{ data.scanHtmlBytes ?? "—" }} bytes
                </dd>
              </div>
            </dl>
            <div class="mt-4 space-y-3">
              <div>
                <div class="text-xs text-slate-500">CMS</div>
                <div class="mt-1 text-xs text-slate-900">
                  {{ data.cmsName || "—" }}
                </div>
              </div>
              <div>
                <div class="text-xs text-slate-500">Thème</div>
                <div class="mt-1 text-xs text-slate-900">
                  {{
                    data.shopifyThemeName || data.shopifyThemeSchemaName || "—"
                  }}
                </div>
              </div>
              <div>
                <div class="text-xs text-slate-500">Type de thème</div>
                <div class="mt-1 text-xs text-slate-900">
                  {{
                    data.shopifyThemeStoreType === "free"
                      ? "Gratuit Shopify"
                      : data.shopifyThemeStoreType === "paid"
                        ? "Payant Shopify"
                        : data.shopifyThemeStoreType === "custom"
                          ? "Hors store Shopify"
                          : "—"
                  }}
                </div>
              </div>
              <div class="pt-2">
                <div
                  class="text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                  Durées des étapes
                </div>
                <dl class="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt class="text-xs text-slate-500">Shopify</dt>
                    <dd class="mt-1 text-xs font-medium text-slate-900">
                      {{ data.scanShopifyMs ?? "—" }} ms
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-slate-500">CMS</dt>
                    <dd class="mt-1 text-xs font-medium text-slate-900">
                      {{ data.scanCmsDetectionMs ?? "—" }} ms
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-slate-500">Langue</dt>
                    <dd class="mt-1 text-xs font-medium text-slate-900">
                      {{ data.scanLanguageMs ?? "—" }} ms
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-slate-500">SEO meta</dt>
                    <dd class="mt-1 text-xs font-medium text-slate-900">
                      {{ data.scanSeoMetaMs ?? "—" }} ms
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-slate-500">Mentions légales</dt>
                    <dd class="mt-1 text-xs font-medium text-slate-900">
                      {{ data.scanLegalNoticeMs ?? "—" }} ms
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-slate-500">Catalogue</dt>
                    <dd class="mt-1 text-xs font-medium text-slate-900">
                      {{ data.scanCatalogMs ?? "—" }} ms
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-slate-500">Contact</dt>
                    <dd class="mt-1 text-xs font-medium text-slate-900">
                      {{ data.scanContactMs ?? "—" }} ms
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-slate-500">LinkedIn</dt>
                    <dd class="mt-1 text-xs font-medium text-slate-900">
                      {{ data.scanLinkedinMs ?? "—" }} ms
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-slate-500">Autres réseaux</dt>
                    <dd class="mt-1 text-xs font-medium text-slate-900">
                      {{ data.scanSocialMs ?? "—" }} ms
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-slate-500">Technique</dt>
                    <dd class="mt-1 text-xs font-medium text-slate-900">
                      {{ data.scanTechnicalMs ?? "—" }} ms
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-slate-500">Lighthouse</dt>
                    <dd class="mt-1 text-xs font-medium text-slate-900">
                      {{ data.scanLighthouseMs ?? "—" }} ms
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-slate-500">Total workflow</dt>
                    <dd class="mt-1 text-xs font-medium text-slate-900">
                      {{ data.scanWorkflowTotalMs ?? "—" }} ms
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-slate-200 bg-white p-5">
            <div
              class="text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Lighthouse
            </div>
            <dl class="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt class="text-xs text-slate-500">Score global</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{ data.lighthouseScore ?? "—" }} / 100
                </dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">Performance</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{ data.lighthousePerformanceScore ?? "—" }} / 100
                </dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">Accessibilité</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{ data.lighthouseAccessibilityScore ?? "—" }} / 100
                </dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">Bonnes pratiques</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{ data.lighthouseBestPracticesScore ?? "—" }} / 100
                </dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">SEO</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{ data.lighthouseSeoScore ?? "—" }} / 100
                </dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">Dernier audit</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{ formatDate(data.lighthouseCheckedAt) }}
                </dd>
              </div>
            </dl>
          </div>

          <div class="rounded-xl border border-slate-200 bg-white p-5">
            <div
              class="text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Observations exploitables
            </div>
            <div v-if="lighthouseObservations.length" class="mt-4 space-y-3">
              <div
                v-for="observation in lighthouseObservations"
                :key="`${observation.category}-${observation.title}`"
                class="rounded-lg border p-4"
                :class="observationTone(observation.severity)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="text-xs font-semibold">
                      {{ observation.title }}
                    </div>
                    <div class="mt-1 text-xs leading-6 opacity-90">
                      {{ observation.detail }}
                    </div>
                  </div>
                  <span
                    class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset"
                  >
                    {{ observation.category }}
                  </span>
                </div>
                <div
                  v-if="observation.evidence"
                  class="mt-2 text-xs opacity-80"
                >
                  {{ observation.evidence }}
                </div>
              </div>
            </div>
            <div
              v-else
              class="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-muted-sm"
            >
              Aucune observation forte détectée sur ce scan.
            </div>
          </div>

          <div class="rounded-xl border border-slate-200 bg-white p-5">
            <div
              class="text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Contact
            </div>
            <dl class="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt class="text-xs text-slate-500">Statut</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{ data.contactStatus }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">Dernière vérification</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{ formatDate(data.contactCheckedAt) }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">Email</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{ data.contactEmail || "—" }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">Téléphone</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{ data.contactPhone || "—" }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">Prénom / Nom</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{
                    [data.contactFirstName, data.contactLastName]
                      .filter(Boolean)
                      .join(" ") || "—"
                  }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">SIRET / SIREN</dt>
                <dd class="mt-1 text-xs font-medium text-slate-900">
                  {{ data.contactSiret || "—" }} /
                  {{ data.contactSiren || "—" }}
                </dd>
              </div>
            </dl>
            <div class="mt-4 space-y-3">
              <div>
                <div class="text-xs text-slate-500">Entreprise</div>
                <div class="mt-1 text-xs text-slate-900">
                  {{ data.contactCompanyName || "—" }}
                </div>
              </div>
              <div>
                <div class="text-xs text-slate-500">Responsable</div>
                <div class="mt-1 text-xs text-slate-900">
                  {{ data.contactOwnerName || "—" }}
                </div>
              </div>
              <div>
                <div class="text-xs text-slate-500">Source contact</div>
                <div class="mt-1 text-xs text-slate-900 break-all">
                  {{ data.contactSourceUrl || "—" }}
                </div>
              </div>
              <div>
                <div class="text-xs text-slate-500">Evidence contact</div>
                <div class="mt-1 text-xs text-slate-900">
                  {{ data.contactEvidence || "—" }}
                </div>
              </div>
              <div>
                <div class="text-xs text-slate-500">Réseaux détectés</div>
                <div class="mt-2 flex flex-wrap gap-2">
                  <UButton
                    v-for="link in socialLinks"
                    :key="link"
                    color="neutral"
                    variant="soft"
                    size="xs"
                    icon="i-lucide-share-2"
                    as="a"
                    :href="link"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ socialLinkLabel(link) }}
                  </UButton>
                  <span v-if="!socialLinks.length" class="text-muted-sm"
                    >—</span
                  >
                </div>
              </div>
              <div class="flex flex-wrap gap-2 pt-1">
                <UButton
                  v-if="data.contactLinkedinUrl"
                  color="neutral"
                  variant="soft"
                  size="sm"
                  icon="i-lucide-linkedin"
                  as="a"
                  :href="data.contactLinkedinUrl"
                  target="_blank"
                  rel="noreferrer"
                >
                  LinkedIn perso
                </UButton>
                <UButton
                  v-if="data.contactCompanyLinkedinUrl"
                  color="neutral"
                  variant="soft"
                  size="sm"
                  icon="i-lucide-linkedin"
                  as="a"
                  :href="data.contactCompanyLinkedinUrl"
                  target="_blank"
                  rel="noreferrer"
                >
                  LinkedIn société
                </UButton>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-4 rounded-xl border border-slate-200 bg-white p-5">
          <div
            class="text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            JSON thème Shopify
          </div>
          <pre
            class="mt-4 overflow-x-auto rounded-lg bg-slate-50 p-4 text-xs leading-6 text-slate-700"
            >{{ data.shopifyThemeJson || "—" }}</pre
          >
        </div>
      </template>
    </section>
  </main>
</template>
