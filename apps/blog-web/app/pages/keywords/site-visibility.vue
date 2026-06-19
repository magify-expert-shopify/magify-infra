<script setup lang="ts">
import KeywordSiteVisibilityTable from "~/components/keywords/KeywordSiteVisibilityTable.vue";
import type { KeywordSiteVisibilityResponse } from "~/types/keyword-site-visibility";

const { searchSiteVisibility } = useKeywords();

const siteUrl = ref("https://magify.fr");
const visibilityResult = ref<KeywordSiteVisibilityResponse | null>(null);
const isLoading = ref(false);
const error = ref("");
const breadcrumbItems = [
  {
    label: "Mots-clés",
    to: "/keywords/list",
  },
  {
    label: "Visibilité SERP",
  },
];

async function loadVisibility() {
  const normalizedSiteUrl = siteUrl.value.trim();

  if (!normalizedSiteUrl || isLoading.value) {
    return;
  }

  isLoading.value = true;
  error.value = "";

  try {
    visibilityResult.value = await searchSiteVisibility(normalizedSiteUrl);
  } catch (requestError) {
    visibilityResult.value = null;
    error.value =
      requestError instanceof Error
        ? requestError.message
        : "Impossible de lire le cache DataForSEO.";
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  void loadVisibility();
});
</script>

<template>
  <section class="space-y-6">
    <UBreadcrumb :items="breadcrumbItems" class="text-slate-500" />

    <!-- <div class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900">
        Visibilité SERP
      </h1>
      <p class="text-sm text-slate-500">
        Liste les mots-clés pour lesquels un site apparaît dans la SERP à
        partir du cache DataForSEO.
      </p>
    </div> -->

    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end">
        <label class="block flex-1 text-sm font-medium text-slate-700">
          <span class="mb-2 block">Site à rechercher dans le cache</span>

          <UInput
            v-model="siteUrl"
            size="xl"
            icon="i-lucide-globe"
            placeholder="https://magify.fr"
            autocomplete="off"
            @keyup.enter="loadVisibility"
          />
        </label>

        <UButton
          size="xl"
          icon="i-lucide-database-search"
          :loading="isLoading"
          :disabled="!siteUrl.trim()"
          @click="loadVisibility"
        >
          {{ isLoading ? "Recherche..." : "Rechercher dans le cache DataForSEO" }}
        </UButton>
      </div>
    </div>

    <FeedbackRichMessage
      v-if="!visibilityResult && !isLoading && !error"
      tone="info"
      title="Prêt à interroger le cache"
      description="La recherche utilise uniquement les résultats SERP déjà stockés dans DataForSEO."
    />

    <FeedbackInlineMessage v-else-if="error" tone="error" class="animate-pulse">
      {{ error }}
    </FeedbackInlineMessage>

    <div
      v-else-if="visibilityResult"
      class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 class="text-lg font-semibold text-slate-900">
            Visibilité pour {{ visibilityResult.siteBaseUrl }}
          </h2>
          <p class="text-sm text-slate-500">
            {{ visibilityResult.totalKeywords }} mot(s)-clé(s) trouvé(s) dans le
            cache, sur {{ visibilityResult.scannedCacheEntries }} entrée(s)
            DataForSEO.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <UBadge color="neutral" variant="soft">
            Site: {{ visibilityResult.siteUrl }}
          </UBadge>
        </div>
      </div>

      <template v-if="visibilityResult.items.length">
        <KeywordSiteVisibilityTable :items="visibilityResult.items" />
      </template>

      <FeedbackRichMessage
        v-else
        tone="warning"
        title="Aucun résultat trouvé dans le cache"
        description="Aucune SERP mise en cache ne contient ce site pour le moment."
        class="mt-5"
      />
    </div>
  </section>
</template>
