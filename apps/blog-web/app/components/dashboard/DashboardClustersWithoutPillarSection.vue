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

const clustersWithoutPillar = computed(() => props.clusters.slice(0, 6));
</script>

<template>
  <section v-if="clusters.length" class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-slate-900">
          Trouver une page pilier
        </h2>
        <p class="text-sm text-slate-500">
          Clusters qui n’ont encore aucune page pilier définie.
        </p>
      </div>
      <UBadge color="warning" variant="soft">
        {{ clusters.length }}
      </UBadge>
    </div>

    <div class="mt-5 space-y-3">
      <NuxtLink
        v-for="item in clustersWithoutPillar"
        :key="item.cluster.id"
        :to="`/clusters/${item.cluster.id}`"
        class="block rounded-2xl border border-amber-200 bg-amber-50/50 px-4 py-4 transition hover:bg-amber-50"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 space-y-1">
            <p class="truncate font-medium text-slate-900">
              {{ item.cluster.name }}
            </p>
            <p class="text-sm text-slate-600">
              {{ item.cluster.primaryKeyword }}
            </p>
          </div>
          <span class="text-xs font-medium uppercase tracking-wide text-amber-700">
            À définir
          </span>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>
