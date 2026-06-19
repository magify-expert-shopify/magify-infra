<script setup lang="ts">
import StatsCountCard from "~/components/stats/StatsCountCard.vue";
import type { StatsCountsResponse } from "~/types/queue-dashboard";

defineProps<{
  counts: StatsCountsResponse | null | undefined;
}>();
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <StatsCountCard label="Agency Sites" :value="counts?.agencySites ?? 0" />
    <StatsCountCard label="Blogs" :value="counts?.blogs ?? 0" />
    <StatsCountCard
      label="Blog Articles"
      :value="counts?.blogArticles ?? 0"
    />
    <StatsCountCard label="Authors" :value="counts?.authors ?? 0" />
  </div>
</template>
