<script setup lang="ts">
const {
  getKeywordGroupDeduplicationPrompt,
  updateKeywordGroupDeduplicationPrompt,
} = useSettings();
</script>

<template>
  <SettingsPromptConfigEditor
    title="Dédoublonnage des KeywordGroups"
    description="Ce prompt détecte les groupes redondants à partir de leur nom, de leur description et de la liste des groupes candidats."
    input-label="Prompt d’entrée"
    input-placeholder="Ex: identifier les groupes doublons..."
    :input-rows="14"
    :instructions-rows="6"
    :input-variables="['{{keywordGroups}}']"
    save-label="Enregistrer le prompt de dédoublonnage"
    saving-label="Enregistrement..."
    success-message="Prompt de dédoublonnage enregistré."
    idle-message="Les modifications seront utilisées lors du prochain scan de dédoublonnage."
    :load-settings="getKeywordGroupDeduplicationPrompt"
    :save-settings="updateKeywordGroupDeduplicationPrompt"
  />
</template>
