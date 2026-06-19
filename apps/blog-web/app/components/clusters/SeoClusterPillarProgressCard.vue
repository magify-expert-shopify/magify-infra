<script setup lang="ts">
import {
  getPillarProgressStep,
  pillarProgressStatusLabels,
  pillarProgressStepLabels,
} from "~/constants/cluster-pillar";
import type { BlogArticle } from "~/types/domain";

const props = defineProps<{
  pillarArticle: BlogArticle | null;
}>();

const currentProgressStep = computed(() =>
  getPillarProgressStep(props.pillarArticle?.status),
);

const progressPercentage = computed(() =>
  ((currentProgressStep.value - 1) / (pillarProgressStepLabels.length - 1)) * 100,
);
</script>

<template>
  <div class="rounded-2xl border border-sky-100 bg-white/80 p-4">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm font-medium text-slate-900">
        Progression du pilier
      </p>
      <span class="text-xs font-medium text-slate-500">
        {{ pillarProgressStatusLabels[pillarArticle?.status || "DRAFT"] }}
      </span>
    </div>

    <div class="mt-4">
      <div class="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          class="h-full rounded-full bg-sky-500 transition-all"
          :style="{ width: `${progressPercentage}%` }"
        />
      </div>

      <div class="mt-3 grid grid-cols-4 gap-2">
        <div
          v-for="(stepLabel, index) in pillarProgressStepLabels"
          :key="stepLabel"
          class="space-y-2"
        >
          <div class="flex items-center gap-2">
            <span
              class="flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold"
              :class="
                index + 1 <= currentProgressStep
                  ? 'border-sky-200 bg-sky-500 text-white'
                  : 'border-slate-200 bg-white text-slate-400'
              "
            >
              {{ index + 1 }}
            </span>
          </div>
          <p class="text-xs leading-5 text-slate-500">
            {{ stepLabel }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
