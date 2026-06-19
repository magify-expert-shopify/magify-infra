<script setup lang="ts">
import KeywordSuggestionsPage from "~/components/suggestions/KeywordSuggestionsPage.vue";

const breadcrumbItems = [
  {
    label: "Accueil",
    to: "/",
  },
  {
    label: "Suggestions",
    to: "/suggestions",
  },
  {
    label: "Guides",
  },
];
</script>

<template>
  <KeywordSuggestionsPage
    data-key="suggestions:guides"
    :breadcrumb-items="breadcrumbItems"
    title="Suggestions de guides"
    description="Affiche uniquement les groupes suggérés pour les guides."
    page-type-filter="GUIDE"
    :show-template-filter="false"
    :show-dedup-button="false"
    :show-ideas-box="false"
  />
</template>
