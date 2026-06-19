<script setup lang="ts">
import {
  getShopifyErrorType,
  isShopifyUnavailableError,
  isProjectShopifyStoreNotLinkedError,
} from "~/utils/shopify-errors";

const props = defineProps<{
  error?: unknown;
}>();

const { currentProject } = useCurrentProject();

const isShopifyStoreNotLinked = computed(() => {
  return isProjectShopifyStoreNotLinkedError(props.error);
});

const isShopifyUnavailable = computed(() => {
  return isShopifyUnavailableError(props.error);
});

const shopifyErrorType = computed(() => getShopifyErrorType(props.error));

const shopifyStoreDomain = computed(() => {
  return currentProject.value?.shopifyStoreDomain?.trim() ?? "";
});

const shopifyAdminUrl = computed(() => {
  if (!shopifyStoreDomain.value) {
    return "";
  }

  return `https://admin.shopify.com/store/${shopifyStoreDomain.value}`;
});

const noticeContent = computed(() => {
  if (isShopifyUnavailable.value) {
    return {
      title: "Shopify indisponible",
      description:
        "L’API Shopify ne répond pas correctement pour le moment. Réessaie un peu plus tard ou vérifie la connexion de la boutique dans les paramètres Shopify du projet.",
      ctaLabel: "Aller aux paramètres Shopify",
      ctaHref: "/settings/shopify",
    };
  }

  if (shopifyErrorType.value === 'SHOPIFY_TOKEN_INVALID_CLIENT') {
    return {
      title: 'Identifiants Shopify invalides',
      description:
        'Shopify a refusé la demande de token parce que les identifiants client ne sont pas valides. Vérifiez la configuration d’authentification Shopify.',
    };
  }

  if (shopifyErrorType.value === 'SHOPIFY_TOKEN_INVALID_REQUEST') {
    return {
      title: 'Demande Shopify invalide',
      description:
        'La requête de connexion Shopify n’a pas été acceptée. Vérifiez le domaine de boutique et la configuration de l’application Shopify.',
    };
  }

  if (shopifyErrorType.value === 'SHOPIFY_APP_NOT_INSTALLED') {
    return {
      title: 'Application Shopify non installée',
      description:
        "La boutique Shopify existe bien, mais l’application n’est pas installée sur ce shop. Installez l’application Shopify du projet pour continuer.",
      ctaLabel: 'Ouvrir les apps Shopify',
      ctaHref:
        'https://admin.shopify.com/?organization_id=100614162&no_redirect=true&redirect=/oauth/redirect_from_developer_dashboard?client_id%3D3aee7eecb9810776ac5094087c51a1ab',
    };
  }

  if (shopifyErrorType.value === 'SHOPIFY_TOKEN_UNAUTHORIZED') {
    return {
      title: 'Connexion Shopify non autorisée',
      description:
        'Shopify a refusé l’accès à la boutique. Réauthentifiez ou reconnectez la boutique du projet.',
    };
  }

  if (shopifyErrorType.value === 'SHOPIFY_TOKEN_REQUEST_FAILED') {
    return {
      title: 'Connexion Shopify à réinitialiser',
      description:
        'Le projet est bien lié à une boutique Shopify, mais la connexion technique n’a pas pu être récupérée. Vérifiez les identifiants Shopify puis relancez la synchronisation.',
    };
  }

  return {
    title: 'Boutique Shopify non connectée au projet',
    description:
      'Ce projet n’a pas encore de boutique Shopify associée. Liez d’abord la boutique du projet pour accéder aux blogs, aux articles et aux auteurs.',
    ctaLabel: 'Aller aux paramètres Shopify',
    ctaHref: '/settings/shopify',
  };
});

const isExternalCta = computed(() => {
  return Boolean(
    noticeContent.value.ctaHref &&
      noticeContent.value.ctaHref.startsWith("https://"),
  );
});
</script>

<template>
  <div
    v-if="isShopifyStoreNotLinked || isShopifyUnavailable"
    class="shopify-store-not-linked-notice rounded-2xl border border-amber-200 bg-amber-50 p-6"
  >
    <div class="flex items-start gap-4">
      <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
        <svg viewBox="0 0 24 24" aria-hidden="true" class="h-5 w-5 fill-none stroke-current stroke-[1.8]">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
      </div>

      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-slate-900">
          {{ noticeContent.title }}
        </p>
        <p class="mt-1 text-sm leading-6 text-slate-600">
          {{ noticeContent.description }}
        </p>

        <div class="mt-4">
          <NuxtLink
            v-if="!isExternalCta"
            :to="noticeContent.ctaHref ?? '/settings/shopify'"
            class="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {{ noticeContent.ctaLabel ?? 'Aller aux paramètres Shopify' }}
          </NuxtLink>
          <a
            v-else
            :href="noticeContent.ctaHref"
            target="_blank"
            rel="noreferrer"
            class="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {{ noticeContent.ctaLabel ?? 'Aller aux paramètres Shopify' }}
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
