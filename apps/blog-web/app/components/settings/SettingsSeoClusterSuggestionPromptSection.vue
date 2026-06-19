<script setup lang="ts">
const {
  getSeoClusterSuggestionPrompt,
  updateSeoClusterSuggestionPrompt,
} = useSettings();
</script>

<template>
  <SettingsPromptConfigEditor
    title="Suggestion de cluster pour KeywordGroup"
    description="Ce prompt aide l’IA à choisir le cluster le plus pertinent pour un KeywordGroup orphelin à partir de sa description et de la liste des clusters existants."
    input-label="Prompt d’entrée"
    input-placeholder="Ex: choisir le cluster le plus pertinent..."
    :input-rows="14"
    :instructions-rows="6"
    :input-variables="[
      '{{keywordGroupName}}',
      '{{keywordGroupDescription}}',
      '{{clusters}}',
    ]"
    save-label="Enregistrer le prompt de suggestion"
    saving-label="Enregistrement..."
    success-message="Prompt de suggestion de cluster enregistré."
    idle-message="Les modifications seront utilisées lors du prochain scan de suggestion sur une carte orpheline."
    :load-settings="getSeoClusterSuggestionPrompt"
    :save-settings="updateSeoClusterSuggestionPrompt"
  />
</template>
