<script setup lang="ts">
const {
  getBlogArticleSecondaryKeywordsSuggestionPrompt,
  updateBlogArticleSecondaryKeywordsSuggestionPrompt,
} = useSettings();
</script>

<template>
  <SettingsPromptConfigEditor
    title="Suggestion de mots-clés secondaires"
    description="Ce prompt génère les mots-clés secondaires proposés depuis une suggestion éditoriale avant la rédaction d’un article."
    input-label="Prompt d’entrée"
    input-placeholder="Ex: proposer entre 8 et 12 mots-clés secondaires pertinents..."
    :input-rows="15"
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
    save-label="Enregistrer le prompt"
    saving-label="Enregistrement..."
    success-message="Prompt de suggestion de mots-clés secondaires enregistré."
    idle-message="Ce prompt est utilisé quand on génère des mots-clés secondaires depuis une suggestion éditoriale."
    :load-settings="getBlogArticleSecondaryKeywordsSuggestionPrompt"
    :save-settings="updateBlogArticleSecondaryKeywordsSuggestionPrompt"
  />
</template>
