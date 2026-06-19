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
    label: "Tutoriels",
  },
];
</script>

<template>
  <KeywordSuggestionsPage
    data-key="suggestions:tutorials"
    :breadcrumb-items="breadcrumbItems"
    title="Suggestions de tutoriels"
    description="Affiche uniquement les groupes suggérés pour les tutoriels."
    page-type-filter="TUTORIAL"
    :show-template-filter="false"
    :show-dedup-button="false"
    :show-ideas-box="false"
  />
</template>
