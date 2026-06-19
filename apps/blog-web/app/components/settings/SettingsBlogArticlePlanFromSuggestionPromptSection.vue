<script setup lang="ts">
const {
  getBlogArticlePlanFromSuggestionPrompt,
  updateBlogArticlePlanFromSuggestionPrompt,
} = useSettings();
</script>

<template>
  <SettingsPromptConfigEditor
    title="Plan d'article depuis une suggestion"
    description="Ce prompt génère un plan éditorial à éditer avant de lancer la génération complète de l'article."
    input-label="Prompt d’entrée"
    input-placeholder="Ex: proposer un plan détaillé pour un article de blog..."
    instructions-placeholder="Décrivez ici les règles système, le style attendu et les contraintes de sortie..."
    :input-rows="14"
    :instructions-rows="6"
    :input-variables="[
      '{{pageType}}',
      '{{subjectExact}}',
      '{{primaryKeyword}}',
      '{{secondaryKeywords}}',
      '{{target}}',
      '{{conversionObjective}}',
      '{{approxLength}}',
      '{{tone}}',
      '{{groupName}}',
      '{{groupDescription}}',
      '{{keywords}}',
    ]"
    save-label="Enregistrer le prompt plan"
    saving-label="Enregistrement..."
    success-message="Prompt de génération de plan enregistré."
    idle-message="Les modifications seront utilisées lors de la prochaine génération de plan depuis une suggestion."
    :load-settings="getBlogArticlePlanFromSuggestionPrompt"
    :save-settings="updateBlogArticlePlanFromSuggestionPrompt"
  />
</template>
