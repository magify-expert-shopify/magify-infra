<script setup lang="ts">
const {
  getBlogArticleFromSuggestionPrompt,
  getBlogArticleFromSuggestionTone,
  updateBlogArticleFromSuggestionPrompt,
  updateBlogArticleFromSuggestionTone,
} = useSettings();

const {
  data: tone,
  status: toneStatus,
  refresh: refreshTone,
} = await useAsyncData(
  "settings:blog-article-from-suggestion-tone",
  () => getBlogArticleFromSuggestionTone(),
  {
    default: () => "",
  },
);

const isSavingTone = ref(false);

async function handleSaveTone() {
  try {
    isSavingTone.value = true;
    tone.value = await updateBlogArticleFromSuggestionTone(tone.value ?? "");
  } finally {
    isSavingTone.value = false;
  }
}
</script>

<template>
  <div class="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div class="space-y-1">
      <h3 class="text-sm font-semibold text-slate-900">
        Ton souhaité
      </h3>
      <p class="text-xs leading-5 text-slate-500">
        Ce ton sera injecté dans le prompt de génération d’article.
      </p>
    </div>

    <div class="mt-3 space-y-3">
      <UTextarea
        v-model="tone"
        :rows="3"
        placeholder="direct, humain, accessible, dynamique, vulgarisé, avec des exemples concrets et des métaphores simples, sans jargon inutile"
        :loading="toneStatus === 'pending'"
      />

      <div class="flex flex-wrap items-center gap-3">
        <UButton
          color="primary"
          variant="soft"
          icon="i-lucide-save"
          :loading="isSavingTone"
          @click="handleSaveTone"
        >
          Enregistrer le ton
        </UButton>

        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-rotate-ccw"
          :loading="toneStatus === 'pending'"
          @click="refreshTone()"
        >
          Recharger
        </UButton>
      </div>
    </div>
  </div>

  <SettingsPromptConfigEditor
    title="Génération d'article depuis une suggestion"
    description="Ce prompt transforme une suggestion éditoriale en brief et premier jet d’article à partir du groupe de mots-clés."
    input-label="Prompt d’entrée"
    input-placeholder="Ex: suggérer un article éditorial..."
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
      '{{plan}}',
    ]"
    save-label="Enregistrer le prompt article"
    saving-label="Enregistrement..."
    success-message="Prompt de génération d'article enregistré."
    idle-message="Les modifications seront utilisées lors de la prochaine création de page depuis une suggestion."
    :load-settings="getBlogArticleFromSuggestionPrompt"
    :save-settings="updateBlogArticleFromSuggestionPrompt"
  />
</template>
