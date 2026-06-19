<script setup lang="ts">
const {
  getCustomerProblemKeywordExtractionPrompt,
  updateCustomerProblemKeywordExtractionPrompt,
} = useSettings();
</script>

<template>
  <SettingsPromptConfigEditor
    title="Prompt IA pour l’extraction de mots-clés des problèmes clients"
    description="Ce prompt est utilisé quand vous lancez une extraction de mots-clés depuis la page problems."
    input-label="Template d’input"
    input-placeholder="Saisissez ici le message utilisateur envoyé à l’IA pour extraire les mots-clés d’un problème client..."
    instructions-placeholder="Décrivez ici les contraintes système, le format attendu et les règles de sortie..."
    :input-rows="14"
    :instructions-rows="6"
    :input-variables="[
      '{{title}}',
      '{{description}}',
      '{{source}}',
      '{{intention}}',
    ]"
    save-label="Enregistrer le prompt d’extraction"
    saving-label="Enregistrement..."
    success-message="Configuration IA d’extraction des problèmes clients enregistrée."
    idle-message="Les modifications seront utilisées lors de la prochaine extraction IA de mots-clés."
    :load-settings="getCustomerProblemKeywordExtractionPrompt"
    :save-settings="updateCustomerProblemKeywordExtractionPrompt"
  />
</template>
