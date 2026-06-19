<script setup lang="ts">
import KeywordSuggestionsPage from "~/components/suggestions/KeywordSuggestionsPage.vue";

const breadcrumbItems = [
  {
    label: "Accueil",
    to: "/",
  },
  {
    label: "Suggestions",
  },
];
</script>

<template>
  <KeywordSuggestionsPage
    data-key="suggestions:all"
    :breadcrumb-items="breadcrumbItems"
    title="Suggestions"
    description="Consulte les groupes suggérés pour détecter rapidement les opportunités à rédiger."
    :show-dedup-button="true"
    :show-ideas-box="false"
  />
</template>
