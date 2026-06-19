<script setup lang="ts">
import AgencySitesTable from '~/components/tables/AgencySitesTable.vue';

const {
  useAgencySitesList,
  deleteAgencySite: deleteAgencySiteRequest,
  discoverAgencySiteBlogs,
  discoverAgencySitesBlogs,
} = useAgencySites();
const deletingSiteId = ref<string | null>(null);
const scanningSiteIds = ref<Set<string>>(new Set());
const isScanningAllSites = ref(false);

const { data: agencySites, error, status } = await useAgencySitesList();

async function deleteAgencySite(id: string) {
  if (deletingSiteId.value) {
    return;
  }

  deletingSiteId.value = id;

  try {
    await deleteAgencySiteRequest(id);
    await refreshNuxtData("agency-sites");
  } finally {
    deletingSiteId.value = null;
  }
}

async function rescanAgencySite(id: string) {
  if (scanningSiteIds.value.has(id)) {
    return;
  }

  scanningSiteIds.value = new Set(scanningSiteIds.value).add(id);

  try {
    const response = await discoverAgencySiteBlogs(id, "sync");

    if (response.mode === "sync" && agencySites.value) {
      agencySites.value = agencySites.value.map((site) =>
        site.id === id ? response.competitorAgencySite : site,
      );
    }
  } finally {
    const nextScanningSiteIds = new Set(scanningSiteIds.value);
    nextScanningSiteIds.delete(id);
    scanningSiteIds.value = nextScanningSiteIds;
  }
}

async function rescanAllAgencySites() {
  if (isScanningAllSites.value || !agencySites.value?.length) {
    return;
  }

  isScanningAllSites.value = true;

  try {
    await discoverAgencySitesBlogs(
      agencySites.value.map((site) => site.id),
      "async",
    );
  } finally {
    isScanningAllSites.value = false;
  }
}
</script>

<template>
  <section class="space-y-4">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-slate-900">Agency Sites</h1>
      <p class="text-sm text-slate-500">
        Liste des sites d'agence recuperes depuis l'API.
      </p>
    </header>

    <div class="flex items-center justify-end">
      <UButton
        color="neutral"
        variant="soft"
        :loading="isScanningAllSites"
        :disabled="isScanningAllSites || !(agencySites?.length ?? 0)"
        @click="rescanAllAgencySites"
      >
        {{ isScanningAllSites ? "Scan en cours..." : "Scanner tout" }}
      </UButton>
    </div>

    <FeedbackLoadingMessage v-if="status === 'pending'">
      Chargement des agency sites...
    </FeedbackLoadingMessage>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :details="error.toString()"
      title="Impossible de charger les sites"
      description="Les sites concurrents n'ont pas pu être récupérés."
    />

    <AgencySitesTable
      v-else
      :sites="agencySites ?? []"
      :scanning-site-ids="scanningSiteIds"
      :deleting-site-id="deletingSiteId"
      @rescan="rescanAgencySite"
      @delete="deleteAgencySite"
    />
  </section>
</template>
