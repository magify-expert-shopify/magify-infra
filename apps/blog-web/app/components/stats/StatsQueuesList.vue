<script setup lang="ts">
import StatsQueueCard from "~/components/stats/StatsQueueCard.vue";
import type { QueueDashboardQueue } from "~/types/queue-dashboard";

defineProps<{
  queues: QueueDashboardQueue[];
}>();
</script>

<template>
  <div class="space-y-6">
    <StatsQueueCard
      v-for="queue in queues"
      :key="queue.name"
      :queue="queue"
    />
  </div>
</template>
