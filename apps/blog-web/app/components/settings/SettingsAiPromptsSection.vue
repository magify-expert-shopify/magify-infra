<script setup lang="ts">
import { computed, ref } from "vue";
import SettingsBusinessPositioningKeywordExtractionPromptSection from "~/components/settings/SettingsBusinessPositioningKeywordExtractionPromptSection.vue";
import SettingsBlogArticleFromSuggestionPromptSection from "~/components/settings/SettingsBlogArticleFromSuggestionPromptSection.vue";
import SettingsBlogArticlePlanFromSuggestionPromptSection from "~/components/settings/SettingsBlogArticlePlanFromSuggestionPromptSection.vue";
import SettingsBlogArticleSecondaryKeywordsSuggestionPromptSection from "~/components/settings/SettingsBlogArticleSecondaryKeywordsSuggestionPromptSection.vue";
import SettingsCustomerProblemKeywordExtractionPromptSection from "~/components/settings/SettingsCustomerProblemKeywordExtractionPromptSection.vue";
import SettingsKeywordAnalysisPromptSection from "~/components/settings/SettingsKeywordAnalysisPromptSection.vue";
import SettingsKeywordAnalysisMiniScanPromptSection from "~/components/settings/SettingsKeywordAnalysisMiniScanPromptSection.vue";
import SettingsKeywordGroupDeduplicationPromptSection from "~/components/settings/SettingsKeywordGroupDeduplicationPromptSection.vue";
import SettingsKeywordGroupTemplatePromptSection from "~/components/settings/SettingsKeywordGroupTemplatePromptSection.vue";
import SettingsKeywordGroupingPromptSection from "~/components/settings/SettingsKeywordGroupingPromptSection.vue";
import SettingsSeoClusterSuggestionPromptSection from "~/components/settings/SettingsSeoClusterSuggestionPromptSection.vue";

const promptOptions = [
  {
    key: "keyword-analysis",
    label: "Analyse de mot-clé",
    description: "Diagnostic IA à partir d’un mot-clé et de sa SERP.",
    component: SettingsKeywordAnalysisPromptSection,
  },
  {
    key: "keyword-analysis-mini-scan",
    label: "Mini scan de mot-clé",
    description: "Résumé très court généré après l’analyse principale.",
    component: SettingsKeywordAnalysisMiniScanPromptSection,
  },
  {
    key: "customer-problem-keywords",
    label: "Problèmes clients",
    description: "Extraction de mots-clés à partir des problèmes clients.",
    component: SettingsCustomerProblemKeywordExtractionPromptSection,
  },
  {
    key: "business-positioning-keywords",
    label: "Positionnement business",
    description: "Extraction de mots-clés à partir de votre offre et de vos différenciateurs.",
    component: SettingsBusinessPositioningKeywordExtractionPromptSection,
  },
  {
    key: "keyword-grouping",
    label: "Regroupement des mots-clés",
    description: "Proposition de groupes cohérents à partir d’une liste de mots-clés.",
    component: SettingsKeywordGroupingPromptSection,
  },
  {
    key: "keyword-group-template",
    label: "Template des groupes",
    description: "Choix du template à appliquer à tout un groupe de mots-clés.",
    component: SettingsKeywordGroupTemplatePromptSection,
  },
  {
    key: "keyword-group-deduplication",
    label: "Dédoublonnage des groupes",
    description: "Détection des groupes redondants à fusionner.",
    component: SettingsKeywordGroupDeduplicationPromptSection,
  },
  {
    key: "seo-cluster-suggestion",
    label: "Suggestion de cluster",
    description: "Choix du cluster le plus pertinent pour un KeywordGroup orphelin.",
    component: SettingsSeoClusterSuggestionPromptSection,
  },
  {
    key: "blog-article-from-suggestion",
    label: "Génération d'article",
    description: "Brief et premier jet d'article créés depuis une suggestion éditoriale.",
    component: SettingsBlogArticleFromSuggestionPromptSection,
  },
  {
    key: "blog-article-plan-from-suggestion",
    label: "Plan d'article",
    description: "Plan éditorial généré avant la rédaction de l'article.",
    component: SettingsBlogArticlePlanFromSuggestionPromptSection,
  },
  {
    key: "blog-article-secondary-keywords-suggestion",
    label: "Mots-clés secondaires",
    description: "Suggestions de mots-clés secondaires à partir d’une suggestion éditoriale.",
    component: SettingsBlogArticleSecondaryKeywordsSuggestionPromptSection,
  },
] as const;

const selectedPromptKey = ref<(typeof promptOptions)[number]["key"]>(
  promptOptions[0].key,
);

const activePrompt = computed(
  () =>
    promptOptions.find((option) => option.key === selectedPromptKey.value) ??
    promptOptions[0],
);
</script>

<template>
  <section class="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-sm">
    <div class="space-y-1">
      <h2 class="text-xl font-semibold text-slate-900">
        Prompts IA
      </h2>
      <p class="text-sm leading-6 text-slate-500">
        Regroupez ici les instructions métier envoyées aux différents usages IA
        de la plateforme.
      </p>
    </div>

    <div class="mt-5 space-y-4">
      <label class="block md:hidden">
        <span class="mb-2 block text-sm font-medium text-slate-700">
          Prompt à éditer
        </span>

        <select
          v-model="selectedPromptKey"
          class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
        >
          <option
            v-for="option in promptOptions"
            :key="option.key"
            :value="option.key"
          >
            {{ option.label }}
          </option>
        </select>
      </label>

      <div class="hidden flex-wrap gap-2 md:flex">
        <button
          v-for="option in promptOptions"
          :key="option.key"
          type="button"
          class="rounded-2xl border px-4 py-3 text-left text-sm transition"
          :class="
            option.key === selectedPromptKey
              ? 'border-violet-300 bg-violet-50 text-violet-800 shadow-sm'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
          "
          @click="selectedPromptKey = option.key"
        >
          <span class="block font-medium">
            {{ option.label }}
          </span>
          <span class="mt-1 block text-xs leading-5 opacity-80">
            {{ option.description }}
          </span>
        </button>
      </div>

      <div class="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-500">
        {{ activePrompt.description }}
      </div>

      <div>
        <component :is="activePrompt.component" />
      </div>
    </div>
  </section>
</template>
