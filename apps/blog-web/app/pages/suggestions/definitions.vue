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
    label: "Définitions",
  },
];
</script>

<template>
  <KeywordSuggestionsPage
    data-key="suggestions:definitions"
    :breadcrumb-items="breadcrumbItems"
    title="Suggestions de définitions"
    description="Affiche uniquement les groupes suggérés pour les définitions."
    page-type-filter="DEFINITION"
    :show-template-filter="false"
    :show-dedup-button="false"
    :show-ideas-box="false"
  />
</template>
