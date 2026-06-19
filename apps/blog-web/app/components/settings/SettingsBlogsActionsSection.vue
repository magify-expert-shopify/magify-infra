<script setup lang="ts">
const { currentProject } = useCurrentProject();
const { syncBlogArticleRelationsFromShopify } = useBlogs();
const { showErrorToast, showSuccessToast } = useAppToast();

const isShopifySyncModalOpen = ref(false);
const isSyncingRelations = ref(false);

const hasProject = computed(() => Boolean(currentProject.value?.id));

async function handleSyncBlogArticleRelations() {
  if (!currentProject.value?.id || isSyncingRelations.value) {
    return;
  }

  isSyncingRelations.value = true;

  try {
    const result = await syncBlogArticleRelationsFromShopify();

    await Promise.all([
      refreshNuxtData("blogs"),
      refreshNuxtData("blog-articles"),
    ]);

    showSuccessToast(
      "Relations synchronisées",
      `${result.updatedCount} article(s) de blog ont été reliés à leur blog Shopify correspondant.`,
    );
  } catch (error: any) {
    showErrorToast(
      "Impossible de synchroniser les relations",
      error?.message || "Une erreur inattendue est survenue.",
    );
  } finally {
    isSyncingRelations.value = false;
  }
}
</script>

<template>
  <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Blogs
        </p>
        <h2 class="text-lg font-semibold text-slate-900">
          Synchroniser les blogs Shopify
        </h2>
        <p class="max-w-2xl text-sm leading-6 text-slate-500">
          Prévisualise les blogs Shopify à importer ou à aligner avec la base locale, puis
          décide blog par blog quoi créer, associer, synchroniser ou ignorer.
        </p>
      </div>

      <UButton
        color="primary"
        variant="solid"
        icon="i-lucide-refresh-cw"
        :disabled="!hasProject"
        @click="isShopifySyncModalOpen = true"
      >
        Ouvrir la synchronisation
      </UButton>
    </div>

    <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <UButton
        color="neutral"
        variant="soft"
        icon="i-lucide-link-2"
        :loading="isSyncingRelations"
        :disabled="!hasProject || isSyncingRelations"
        @click="handleSyncBlogArticleRelations"
      >
        Synchroniser les relations articles / blogs
      </UButton>

      <p class="text-sm text-slate-500">
        Recale les articles de blog locaux sur leur blog local quand le
        `shopifyBlogId` correspond au blog Shopify importé.
      </p>
    </div>

    <FeedbackInlineMessage v-if="!hasProject" tone="info" class="mt-4">
      Sélectionne d’abord un projet actif pour lancer cette action.
    </FeedbackInlineMessage>
  </section>

  <SettingsBlogsShopifySyncModal
    v-model:open="isShopifySyncModalOpen"
  />
</template>
