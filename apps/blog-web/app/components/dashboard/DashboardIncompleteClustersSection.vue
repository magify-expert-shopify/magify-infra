<script setup lang="ts">
import type { SeoCluster } from "~/types/domain";

type ClusterDiagnostic = {
  cluster: SeoCluster;
  pillarPageCount: number;
  satellitePageCount: number;
  reasons: string[];
};

const props = defineProps<{
  clusters: ClusterDiagnostic[];
}>();

const incompleteClusters = computed(() => props.clusters.slice(0, 6));

function getClusterArticleCount(cluster: SeoCluster) {
  return (cluster.blogArticles?.length ?? 0) + (cluster.descendantBlogArticles?.length ?? 0);
}
</script>

<template>
  <section v-if="clusters.length" class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-slate-900">
          Clusters incomplets
        </h2>
        <p class="text-sm text-slate-500">
          Exemple: clusters avec pilier mais sans page satellite ou sans article lié.
        </p>
      </div>
      <UBadge color="secondary" variant="soft">
        {{ clusters.length }}
      </UBadge>
    </div>

    <div class="mt-5 space-y-3">
      <NuxtLink
        v-for="item in incompleteClusters"
        :key="item.cluster.id"
        :to="`/clusters/${item.cluster.id}`"
        class="block rounded-2xl border border-slate-200 px-4 py-4 transition hover:border-slate-300 hover:bg-slate-50"
      >
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 space-y-1">
              <p class="truncate font-medium text-slate-900">
                {{ item.cluster.name }}
              </p>
              <p class="text-sm text-slate-500">
                {{ getClusterArticleCount(item.cluster) }} article(s) lié(s)
              </p>
            </div>
            <UBadge color="neutral" variant="soft" class="shrink-0">
              {{ item.satellitePageCount }} satellite
            </UBadge>
          </div>

          <div class="flex flex-wrap gap-2">
            <UBadge
              v-for="reason in item.reasons"
              :key="reason"
              color="neutral"
              variant="soft"
            >
              {{ reason }}
            </UBadge>
          </div>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>
