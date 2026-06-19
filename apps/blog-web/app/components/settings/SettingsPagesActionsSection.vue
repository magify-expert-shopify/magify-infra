<script setup lang="ts">
const { rebuildBlogArticlePageUrls } = usePages();
const { currentProject } = useCurrentProject();
const { showErrorToast, showSuccessToast } = useAppToast();

const isRebuildingBlogArticleUrls = ref(false);

const hasProject = computed(() => Boolean(currentProject.value?.id));

async function handleRebuildBlogArticleUrls() {
  if (isRebuildingBlogArticleUrls.value || !currentProject.value?.id) {
    return;
  }

  try {
    isRebuildingBlogArticleUrls.value = true;
    const result = await rebuildBlogArticlePageUrls(currentProject.value.id);

    showSuccessToast(
      "URLs régénérées",
      `${result.updatedCount} page(s) mise(s) à jour, ${result.skippedCount} ignorée(s).`,
    );
  } catch (error) {
    showErrorToast(
      "Impossible de régénérer les URLs",
      error instanceof Error
        ? error.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    isRebuildingBlogArticleUrls.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900">
        Actions de maintenance
      </h1>
      <p class="text-sm text-slate-500">
        Lance des opérations utiles pour remettre les données en cohérence sans passer par plusieurs écrans.
      </p>
    </header>

    <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pages
          </p>
          <h2 class="text-lg font-semibold text-slate-900">
            Régénérer les URLs des pages d’articles
          </h2>
          <p class="max-w-2xl text-sm leading-6 text-slate-500">
            Recalcule l’URL de toutes les pages associées à un article de blog à partir du
            slug du blog, du slug de l’article et du domaine Shopify du projet.
          </p>
        </div>

        <UButton
          color="primary"
          variant="solid"
          icon="i-lucide-refresh-cw"
          :loading="isRebuildingBlogArticleUrls"
          :disabled="!hasProject"
          @click="handleRebuildBlogArticleUrls"
        >
          Régénérer les URLs
        </UButton>
      </div>

      <FeedbackInlineMessage v-if="!hasProject" tone="info" class="mt-4">
        Sélectionne d’abord un projet actif pour lancer cette action.
      </FeedbackInlineMessage>
    </section>
  </div>
</template>
