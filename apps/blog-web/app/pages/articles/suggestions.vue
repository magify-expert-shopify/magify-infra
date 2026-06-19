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
    label: "Articles",
  },
];
</script>

<template>
  <KeywordSuggestionsPage
    data-key="suggestions:articles"
    :breadcrumb-items="breadcrumbItems"
    title="Suggestions d'articles"
    description="Affiche uniquement les groupes suggérés pour les articles de blog."
    page-type-filter="BLOG_ARTICLE"
    :show-template-filter="false"
    :show-dedup-button="false"
    :show-ideas-box="false"
  />
</template>
