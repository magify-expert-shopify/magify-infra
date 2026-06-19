<script setup lang="ts">
const { currentProject, setCurrentProject } = useCurrentProject();
const { updateProject } = useProjects();
const { syncShopifyAuthorMetaobjectDefinition } = useSettings();

const form = reactive({
  shopifyStoreDomain: "",
});

const isSavingStoreDomain = ref(false);
const shopifyStoreDomainFeedbackMessage = ref("");
const shopifyStoreDomainError = ref("");
const isSyncingShopifyAuthorDefinition = ref(false);
const shopifyAuthorDefinitionFeedbackMessage = ref("");

const shopifyStoreDomain = computed(
  () => currentProject.value?.shopifyStoreDomain?.trim() ?? "",
);

const shopifyAuthorSettingsUrl = computed(() => {
  if (!shopifyStoreDomain.value) {
    return "https://admin.shopify.com";
  }

  return `https://admin.shopify.com/store/${shopifyStoreDomain.value}/settings/custom_data/metaobjects/author`;
});

const shopifyAdminUrl = computed(() => {
  if (!shopifyStoreDomain.value) {
    return "https://admin.shopify.com";
  }

  return `https://admin.shopify.com/store/${shopifyStoreDomain.value}`;
});

function resetForm() {
  form.shopifyStoreDomain = shopifyStoreDomain.value;
  shopifyStoreDomainFeedbackMessage.value = "";
  shopifyStoreDomainError.value = "";
}

async function saveStoreDomain() {
  const projectId = currentProject.value?.id?.trim();

  if (!projectId) {
    shopifyStoreDomainError.value =
      "Sélectionne d’abord un projet courant pour enregistrer la boutique Shopify.";
    return;
  }

  if (isSavingStoreDomain.value) {
    return;
  }

  isSavingStoreDomain.value = true;
  shopifyStoreDomainError.value = "";
  shopifyStoreDomainFeedbackMessage.value = "";

  try {
    const project = await updateProject(projectId, {
      shopifyStoreDomain: form.shopifyStoreDomain.trim() || null,
    });

    setCurrentProject(project);
    shopifyStoreDomainFeedbackMessage.value =
      "Boutique Shopify enregistrée pour ce projet.";
  } catch (error) {
    shopifyStoreDomainError.value =
      error instanceof Error && error.message
        ? error.message
        : "Impossible d’enregistrer la boutique Shopify.";
  } finally {
    isSavingStoreDomain.value = false;
  }
}

async function syncShopifyAuthorDefinition() {
  if (isSyncingShopifyAuthorDefinition.value) {
    return;
  }

  isSyncingShopifyAuthorDefinition.value = true;
  shopifyAuthorDefinitionFeedbackMessage.value = "";

  try {
    const response = await syncShopifyAuthorMetaobjectDefinition();
    const fieldCount = Array.isArray(
      (response as { fieldDefinitions?: unknown[] }).fieldDefinitions,
    )
      ? (response as { fieldDefinitions: unknown[] }).fieldDefinitions.length
      : 0;

    shopifyAuthorDefinitionFeedbackMessage.value = fieldCount
      ? `Définition Shopify synchronisée (${fieldCount} champs).`
      : "Définition Shopify synchronisée.";
  } finally {
    isSyncingShopifyAuthorDefinition.value = false;
  }
}

watch(
  () => currentProject.value?.shopifyStoreDomain,
  () => {
    resetForm();
  },
  { immediate: true },
);
</script>

<template>
  <div
    class="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
  >
    <div class="space-y-1">
      <h2 class="text-lg font-semibold text-slate-900">Shopify</h2>
      <p class="text-sm leading-6 text-slate-500">
        Le domaine Shopify est rattaché au projet courant. Il sert à charger les
        données Shopify de ce projet et à ouvrir le bon panneau
        d’administration.
      </p>
    </div>

    <div
      v-if="!currentProject"
      class="rounded-2xl border border-slate-200 bg-slate-50 p-4"
    >
      <p class="text-sm text-slate-600">
        Sélectionnez d’abord un projet pour configurer sa boutique Shopify.
      </p>
    </div>

    <form v-else class="space-y-4" @submit.prevent="saveStoreDomain">
      <label class="block space-y-2">
        <span class="text-sm font-medium text-slate-700">
          Domaine Shopify du projet
        </span>
        <input
          v-model="form.shopifyStoreDomain"
          type="text"
          class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
        />
        <p class="text-xs text-slate-500">
          Exemple: <code>magify-ecom.myshopify.com</code>. C’est ce domaine qui
          sera utilisé pour ce projet.
        </p>
      </label>

      <div class="flex flex-wrap items-center gap-3">
        <UButton
          type="submit"
          icon="i-lucide-save"
          :loading="isSavingStoreDomain"
          :disabled="isSavingStoreDomain"
        >
          Enregistrer la boutique
        </UButton>

        <a
          :href="shopifyAdminUrl"
          target="_blank"
          rel="noreferrer"
          :aria-disabled="!shopifyStoreDomain"
          :tabindex="shopifyStoreDomain ? 0 : -1"
          :class="
            !shopifyStoreDomain
              ? 'pointer-events-none cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-50'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          "
          class="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition"
        >
          Ouvrir l’admin Shopify
        </a>
      </div>

      <FeedbackErrorMessage v-if="shopifyStoreDomainError">
        {{ shopifyStoreDomainError }}
      </FeedbackErrorMessage>

      <p
        v-if="shopifyStoreDomainFeedbackMessage"
        class="text-sm text-slate-500"
      >
        {{ shopifyStoreDomainFeedbackMessage }}
      </p>
    </form>

    <div class="space-y-3 border-t border-slate-200 pt-4">
      <div class="space-y-1">
        <p class="text-sm font-medium text-slate-900">
          Définition Shopify de l’auteur
        </p>
        <p class="text-sm leading-6 text-slate-500">
          Gardez cette définition synchronisée pour que les articles puissent
          être publiés avec les bons champs
          <a
            :href="shopifyAuthorSettingsUrl"
            target="_blank"
            rel="noreferrer"
            class="font-medium text-primary underline"
            >auteur</a
          >.
        </p>
      </div>

      <p
        v-if="shopifyAuthorDefinitionFeedbackMessage"
        class="text-sm text-slate-500"
      >
        {{ shopifyAuthorDefinitionFeedbackMessage }}
      </p>

      <UButton
        icon="i-lucide-refresh-cw"
        :loading="isSyncingShopifyAuthorDefinition"
        :disabled="isSyncingShopifyAuthorDefinition"
        @click="syncShopifyAuthorDefinition"
      >
        {{
          isSyncingShopifyAuthorDefinition
            ? "Synchronisation..."
            : "Synchroniser le metaobject author"
        }}
      </UButton>
    </div>
  </div>
</template>
