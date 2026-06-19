<script setup lang="ts">
import AuthorsTable from "~/components/tables/AuthorsTable.vue";

const { useAuthorsList } = useAuthors();

const { data: authors, error, status } = await useAuthorsList();
</script>

<template>
  <section class="space-y-4">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-slate-900">Authors</h1>
      <p class="text-sm text-slate-500">
        Liste des auteurs recuperes depuis l'API.
      </p>
    </header>

    <FeedbackLoadingMessage v-if="status === 'pending'">
      Chargement des auteurs...
    </FeedbackLoadingMessage>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :details="error.toString()"
      title="Impossible de charger les auteurs"
      description="Les auteurs concurrents n'ont pas pu être récupérés."
    />

    <AuthorsTable v-else :authors="authors ?? []" />
  </section>
</template>
