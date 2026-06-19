<script setup lang="ts">
import type { QueueDashboardQueue } from "~/types/queue-dashboard";

defineProps<{
  queue: QueueDashboardQueue;
}>();
</script>

<template>
  <div
    class="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
  >
    <div class="flex items-center justify-between gap-4">
      <div>
        <h2 class="text-lg font-semibold text-slate-900">
          {{ queue.label }}
        </h2>
        <p class="text-xs text-slate-500">{{ queue.name }}</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <UBadge color="neutral" variant="soft">
          Waiting: {{ queue.counts.waiting }}
        </UBadge>
        <UBadge color="info" variant="soft">
          Active: {{ queue.counts.active }}
        </UBadge>
        <UBadge color="success" variant="soft">
          Completed: {{ queue.counts.completed }}
        </UBadge>
        <UBadge color="warning" variant="soft">
          Delayed: {{ queue.counts.delayed }}
        </UBadge>
        <UBadge color="error" variant="soft">
          Failed: {{ queue.counts.failed }}
        </UBadge>
      </div>
    </div>

    <div class="overflow-hidden rounded-xl border border-slate-200">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Job
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Payload
              </th>
              <th
                class="w-0 whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Attempts
              </th>
              <th
                class="w-0 whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Queued At
              </th>
            </tr>
          </thead>

          <tbody class="divide-y divide-slate-200">
            <tr v-for="job in queue.jobs" :key="`${queue.name}-${job.id}`">
              <td class="px-4 py-3">
                <div class="font-medium text-slate-900">{{ job.name }}</div>
                <div class="text-xs text-slate-500">#{{ job.id }}</div>
              </td>
              <td class="px-4 py-3 text-xs text-slate-500">
                <code class="rounded bg-slate-100 px-2 py-1">
                  {{ JSON.stringify(job.data) }}
                </code>
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-slate-500">
                {{ job.attemptsMade }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-slate-500">
                {{ new Date(job.timestamp).toLocaleString() }}
              </td>
            </tr>

            <tr v-if="queue.jobs.length === 0">
              <td
                colspan="4"
                class="px-4 py-6 text-center text-sm text-slate-500"
              >
                Aucun job en cours pour cette queue.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
