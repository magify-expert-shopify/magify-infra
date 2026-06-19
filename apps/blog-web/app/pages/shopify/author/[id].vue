<script setup lang="ts">
import MagifyAuthorFormFields from "~/components/settings/MagifyAuthorFormFields.vue";
import type { UpsertMagifyAuthorInput } from "~/types/authors";
import { getShopifyAuthorDisplayName, toShopifyAuthorFormInput } from "~/utils/shopify-authors";

const route = useRoute();
const authorId = computed(() => String(route.params.id || ""));
const { getAuthorMetaobject, updateAuthorMetaobject } = useShopify();

const breadcrumbItems = computed(() => [
  {
    label: "Shopify",
    to: "/shopify/blogs",
  },
  {
    label: "Authors",
    to: "/shopify/author",
  },
  {
    label: author.value ? getShopifyAuthorDisplayName(author.value) : "Edition",
  },
]);

const {
  data: author,
  error,
  status,
  refresh,
} = await useAsyncData(
  () => `shopify-author-metaobject:${authorId.value}`,
  () => getAuthorMetaobject(authorId.value),
);

const form = reactive<UpsertMagifyAuthorInput>({
  displayName: "",
  jobTitle: "",
  avatarUrl: "",
  shopifyAvatarId: "",
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  bio: "",
  shopifyPageId: "",
  linkedinProfileUrl: "",
  slug: "",
});

const isSaving = ref(false);
const feedbackMessage = ref("");

function resetForm() {
  const nextValues = author.value
    ? toShopifyAuthorFormInput(author.value)
    : {
        displayName: "",
        jobTitle: "",
        avatarUrl: "",
        shopifyAvatarId: "",
        firstName: "",
        lastName: "",
        email: "",
        phoneNumber: "",
        bio: "",
        shopifyPageId: "",
        linkedinProfileUrl: "",
        slug: "",
      };

  form.displayName = nextValues.displayName ?? "";
  form.jobTitle = nextValues.jobTitle ?? "";
  form.avatarUrl = nextValues.avatarUrl ?? "";
  form.shopifyAvatarId = nextValues.shopifyAvatarId ?? "";
  form.firstName = nextValues.firstName ?? "";
  form.lastName = nextValues.lastName ?? "";
  form.email = nextValues.email ?? "";
  form.phoneNumber = nextValues.phoneNumber ?? "";
  form.bio = nextValues.bio ?? "";
  form.shopifyPageId = nextValues.shopifyPageId ?? "";
  form.linkedinProfileUrl = nextValues.linkedinProfileUrl ?? "";
  form.slug = nextValues.slug ?? "";
}

async function saveAuthor() {
  if (!author.value || isSaving.value) {
    return;
  }

  isSaving.value = true;
  feedbackMessage.value = "";

  try {
    const updatedAuthor = await updateAuthorMetaobject(author.value.id, {
      displayName: form.displayName,
      jobTitle: form.jobTitle,
      avatarUrl: form.avatarUrl,
      shopifyAvatarId: form.shopifyAvatarId,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phoneNumber: form.phoneNumber,
      bio: form.bio,
      shopifyPageId: form.shopifyPageId,
      linkedinProfileUrl: form.linkedinProfileUrl,
      slug: form.slug,
    });

    author.value = updatedAuthor;
    resetForm();
    feedbackMessage.value = "Auteur Shopify mis à jour.";
    await refreshNuxtData("shopify-author-metaobjects");
  } finally {
    isSaving.value = false;
  }
}

watch(
  author,
  () => {
    resetForm();
  },
  { immediate: true },
);
</script>

<template>
  <section class="space-y-4">
    <UBreadcrumb :items="breadcrumbItems" />

    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-slate-900">
        {{
          author ? getShopifyAuthorDisplayName(author) : "Auteur Shopify"
        }}
      </h1>
      <p class="text-sm text-slate-500">
        Modifiez ici les champs du métaobject Shopify <code>author</code>.
      </p>
    </header>

    <p v-if="status === 'pending'" class="text-sm text-slate-500">
      Chargement de l’auteur Shopify...
    </p>

    <p v-else-if="error" class="text-sm text-rose-600">
      Impossible de charger cet auteur Shopify.
    </p>

    <div
      v-else
      class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div class="space-y-4">
        <div class="space-y-1">
          <p class="text-sm font-medium text-slate-900">
            Handle Shopify
          </p>
          <p class="text-sm text-slate-500">
            {{ author?.handle || "-" }}
          </p>
        </div>

        <MagifyAuthorFormFields :form="form" />

        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm text-slate-500">
            {{ feedbackMessage || "Les modifications seront enregistrées directement dans Shopify." }}
          </p>

          <UButton
            icon="i-lucide-save"
            :loading="isSaving"
            @click="saveAuthor"
          >
            {{ isSaving ? "Enregistrement..." : "Enregistrer l’auteur" }}
          </UButton>
        </div>
      </div>
    </div>
  </section>
</template>
