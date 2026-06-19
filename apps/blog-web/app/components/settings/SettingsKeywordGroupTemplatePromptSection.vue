<script setup lang="ts">
const { getKeywordGroupTemplatePrompt, updateKeywordGroupTemplatePrompt } =
  useSettings();
</script>

<template>
  <SettingsPromptConfigEditor
    title="Template automatique des groupes"
    description="Ce prompt choisit le template le plus pertinent pour un groupe de mots-clés à partir de son nom et de sa description."
    input-label="Template d’entrée"
    input-placeholder="Ex: groupe de mots-clés..."
    :input-rows="10"
    :instructions-rows="6"
    :input-variables="[
      '{{groupName}}',
      '{{groupDescription}}',
      '{{pageTypes}}',
    ]"
    save-label="Enregistrer le prompt du groupe"
    saving-label="Enregistrement..."
    success-message="Prompt de template des groupes enregistré."
    idle-message="Les modifications seront utilisées lors du prochain auto-assign de groupe."
    :load-settings="getKeywordGroupTemplatePrompt"
    :save-settings="updateKeywordGroupTemplatePrompt"
  />
</template>
