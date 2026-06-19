<script setup lang="ts">
const { getKeywordGroupingPrompt, updateKeywordGroupingPrompt } = useSettings();
</script>

<template>
  <SettingsPromptConfigEditor
    title="Regroupement des mots-clés"
    description="Ce prompt aide l’IA à regrouper une liste de mots-clés en groupes cohérents avec un nom et une description."
    input-label="Template d’entrée"
    input-placeholder="Ex: mots-clés à regrouper..."
    :input-variables="[
      '{{keywords}}',
      '{{existingKeywordGroups}}',
      '{{keywordCount}}',
    ]"
    instructions-placeholder="Décris ici le format de sortie attendu pour les groupes."
    :instructions-rows="8"
    save-label="Enregistrer le prompt de regroupement"
    saving-label="Enregistrement..."
    success-message="Prompt de regroupement enregistré."
    idle-message="Modifiez les instructions et le template pour ajuster la génération des groupes."
    :load-settings="getKeywordGroupingPrompt"
    :save-settings="updateKeywordGroupingPrompt"
  />
</template>
