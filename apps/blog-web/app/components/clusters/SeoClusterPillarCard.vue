<script setup lang="ts">
import { computed } from "vue";
import SeoClusterPillarProgressCard from "~/components/clusters/SeoClusterPillarProgressCard.vue";
import { pageTypeLabels, seoRoleLabels } from "~/constants/pages";
import type { BlogArticle, ClusterPage } from "~/types/domain";

const props = defineProps<{
  pillarPage: ClusterPage | null;
  pillarArticle?: BlogArticle | null;
  pillarKeywordGroup?: {
    id: string;
    name: string;
    primaryKeyword?: string | null;
  } | null;
  hasClusterArticles: boolean;
  hasAvailableKeywordGroups: boolean;
  isCreatingPillarArticle: boolean;
  isSelectingPillarArticle: boolean;
  isClearingPillar: boolean;
}>();

const emit = defineEmits<{
  "choose-article": [];
  "choose-keyword-group": [];
  "create-article": [];
  "clear-pillar": [];
}>();

const pillarEmptyMessages = computed(() => {
  if (props.pillarKeywordGroup) {
    return [
      `Ce cluster n’a pas encore de page Pilier pour le sujet ${props.pillarKeywordGroup.name}.`,
      `Ce cluster n’a pas encore de KeywordGroup pilier associé à une page Pilier pour le sujet ${props.pillarKeywordGroup.name}.`,
    ];
  }

  return [
    "Ce cluster n’a pas encore de KeywordGroup pilier défini. Définissez-le pour pouvoir ensuite choisir ou créer la page Pilier.",
    "Une fois le KeywordGroup pilier défini, vous pourrez ensuite choisir ou créer la page Pilier.",
  ];
});
</script>

<template>
  <div
    v-if="pillarPage"
    class="rounded-2xl border border-sky-200 bg-sky-50/70 p-5 shadow-sm"
  >
    <p class="text-xs font-semibold uppercase tracking-wide text-sky-700">
      Pilier du cluster
    </p>

    <div class="mt-4 space-y-3">
      <div class="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
        <UIcon name="i-lucide-file-text" class="shrink-0 h-4 w-4 text-sky-700" />
        <span>{{ pillarPage.title }}</span>
        <UBadge variant="soft" color="primary" class="shrink-0 rounded-full">
          {{ pageTypeLabels[pillarPage.pageType] }}
        </UBadge>
        <!-- <UBadge variant="soft" color="neutral" class="rounded-full">
          {{ seoRoleLabels[pillarPage.seoRole] }}
        </UBadge> -->
      </div>

      <NuxtLink :to="pillarPage.url" v-if="pillarPage.slug" class="block text-sm text-slate-500">
        /{{ pillarPage.slug }}
      </NuxtLink>

      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="pillarArticle"
          size="sm"
          icon="i-lucide-square-pen"
          :to="`/articles/${pillarArticle.id}`"
        >
          Éditer l’article pilier
        </UButton>
        <UButton
          size="sm"
          variant="subtle"
          icon="i-lucide-git-compare-arrows"
          :disabled="!hasClusterArticles || isCreatingPillarArticle || isSelectingPillarArticle || isClearingPillar"
          @click="emit('choose-article')"
        >
          Changer de page pilier
        </UButton>
        <UButton
          size="sm"
          variant="subtle"
          icon="i-lucide-unlink-2"
          :loading="isClearingPillar"
          :disabled="isCreatingPillarArticle || isSelectingPillarArticle"
          @click="emit('clear-pillar')"
        >
          Retirer le pilier
        </UButton>
        <!-- <UButton
          size="sm"
          icon="i-lucide-file-plus-2"
          :loading="isCreatingPillarArticle"
          :disabled="isSelectingPillarArticle || isClearingPillar"
          @click="emit('create-article')"
        >
          Créer un article pilier
        </UButton> -->
      </div>

      <SeoClusterPillarProgressCard :pillar-article="pillarArticle ?? null" />
    </div>
  </div>

  <div
    v-else
    class="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm"
  >
    <p class="text-xs font-semibold uppercase tracking-wide text-amber-700">
      Pilier du cluster
    </p>

    <div class="mt-4 space-y-3">
      <div class="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
        <UIcon name="i-lucide-triangle-alert" class="h-4 w-4 text-amber-600" />
        <span>Aucune page pilier associée</span>
      </div>

      <ul class="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
        <li
          v-for="message in pillarEmptyMessages"
          :key="message"
          class="rounded-xl bg-amber-50/70 px-3 py-2"
        >
          {{ message }}
        </li>
      </ul>

      <p class="text-sm leading-6 text-slate-700">
        Il faut en créer une ou en choisir une déjà existante pour votre cluster.
      </p>

      <div class="flex flex-wrap gap-2">
        <UButton
          size="sm"
          color="warning"
          variant="subtle"
          icon="i-lucide-list-tree"
          :disabled="!hasAvailableKeywordGroups"
          @click="emit('choose-keyword-group')"
        >
          Définir le sujet pilier
        </UButton>
        <UButton
          size="sm"
          color="warning"
          variant="subtle"
          icon="i-lucide-list-tree"
          :disabled="!hasClusterArticles || isCreatingPillarArticle || isSelectingPillarArticle || isClearingPillar"
          @click="emit('choose-article')"
        >
          Choisir un article
        </UButton>
        <UButton
          size="sm"
          color="warning"
          variant="subtle"
          icon="i-lucide-file-plus-2"
          :loading="isCreatingPillarArticle"
          :disabled="isSelectingPillarArticle || isClearingPillar"
          @click="emit('create-article')"
        >
          Créer un article pilier
        </UButton>
      </div>
    </div>
  </div>
</template>
