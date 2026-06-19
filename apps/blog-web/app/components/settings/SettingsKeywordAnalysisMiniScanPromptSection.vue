<script setup lang="ts">
const {
  getKeywordAnalysisMiniScanPrompt,
  updateKeywordAnalysisMiniScanPrompt,
} = useSettings();
</script>

<template>
  <SettingsPromptConfigEditor
    title="Mini scan IA de mot-clé"
    description="Ce prompt génère un résumé ultra-court après l’analyse DataForSEO pour compléter la phrase affichée dans la page d’étude."
    input-label="Template d’entrée"
    input-placeholder="Ex: mini scan..."
    :input-rows="10"
    :instructions-rows="6"
    :input-variables="[
      '{{keyword}}',
      '{{volume}}',
      '{{difficulty}}',
      '{{intent}}',
      '{{serp_results}}',
    ]"
    save-label="Enregistrer le mini scan"
    saving-label="Enregistrement..."
    success-message="Prompt du mini scan enregistré."
    idle-message="Les modifications seront utilisées lors de la prochaine analyse."
    :load-settings="getKeywordAnalysisMiniScanPrompt"
    :save-settings="updateKeywordAnalysisMiniScanPrompt"
  />
</template>
