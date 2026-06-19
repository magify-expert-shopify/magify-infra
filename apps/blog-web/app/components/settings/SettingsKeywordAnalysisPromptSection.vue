<script setup lang="ts">
const { getKeywordAnalysisPrompt, updateKeywordAnalysisPrompt } = useSettings();
</script>

<template>
  <SettingsPromptConfigEditor
    title="Prompt IA pour l’analyse de mot-clé"
    description="Ce prompt est utilisé pour générer l’analyse IA affichée depuis la page keyword-research."
    input-label="Template d’input"
    input-placeholder="Saisissez ici le message utilisateur envoyé à l’IA pour l’analyse de mot-clé..."
    instructions-placeholder="Décrivez ici le rôle, le ton et les règles système de l’IA..."
    :input-rows="18"
    :instructions-rows="8"
    :input-variables="[
      '{{keyword}}',
      '{{volume}}',
      '{{difficulty}}',
      '{{intent}}',
      '{{serp_results}}',
    ]"
    save-label="Enregistrer les réglages IA"
    saving-label="Enregistrement..."
    success-message="Configuration IA d’analyse de mot-clé enregistrée."
    idle-message="Les modifications seront utilisées lors de la prochaine analyse IA."
    :load-settings="getKeywordAnalysisPrompt"
    :save-settings="updateKeywordAnalysisPrompt"
  />
</template>
