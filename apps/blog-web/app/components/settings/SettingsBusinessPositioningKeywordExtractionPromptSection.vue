<script setup lang="ts">
const {
  getBusinessPositioningKeywordExtractionPrompt,
  updateBusinessPositioningKeywordExtractionPrompt,
} = useSettings();
</script>

<template>
  <SettingsPromptConfigEditor
    title="Prompt IA pour l’extraction de mots-clés du positionnement business"
    description="Ce prompt est utilisé quand vous enregistrez les réponses métier dans l’onboarding ou dans la section positionnement business."
    input-label="Template d’input"
    input-placeholder="Saisissez ici le message utilisateur envoyé à l’IA pour extraire les mots-clés du positionnement business..."
    instructions-placeholder="Décrivez ici les règles système, le format JSON attendu et les contraintes de sortie..."
    :input-rows="14"
    :instructions-rows="6"
    :input-variables="[
      '{{offering}}',
      '{{differentiator}}',
      '{{problemsSolved}}',
    ]"
    save-label="Enregistrer le prompt d’extraction"
    saving-label="Enregistrement..."
    success-message="Configuration IA du positionnement business enregistrée."
    idle-message="Les modifications seront utilisées au prochain enregistrement du positionnement business."
    :load-settings="getBusinessPositioningKeywordExtractionPrompt"
    :save-settings="updateBusinessPositioningKeywordExtractionPrompt"
  />
</template>
