<script setup lang="ts">
import SettingsSprintClusterSection from "~/components/settings/SettingsSprintClusterSection.vue";
import SettingsSprintObjectivesSection from "~/components/settings/SettingsSprintObjectivesSection.vue";
import { settingsNavigationItems } from "~/constants/settings-navigation";

const sectionLinks = computed(() =>
  settingsNavigationItems.filter(
    (item) => item.to !== "/settings" && item.to !== "/settings/sprint-cluster",
  ),
);
</script>

<template>
  <div class="space-y-6">
    <SettingsSprintObjectivesSection />

    <div id="sprint-cluster">
      <SettingsSprintClusterSection />
    </div>

    <!-- <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="space-y-2">
        <h2 class="text-lg font-semibold text-slate-900">Vue d’ensemble</h2>
        <p class="text-sm leading-6 text-slate-500">
          Retrouvez ici les principaux réglages produit, les connexions, les
          paramètres Shopify et les prompts métier.
        </p>
      </div>
    </div> -->

    <div class="grid gap-4 lg:grid-cols-2">
      <NuxtLink
        v-for="item in sectionLinks"
        :key="item.to"
        :to="item.to"
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
      >
        <div class="flex items-start gap-4">
          <div
            class="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"
          >
            <UIcon :name="item.icon" class="h-5 w-5" />
          </div>

          <div class="space-y-1">
            <p class="font-medium text-slate-900">
              {{ item.label }}
            </p>
            <p class="text-sm leading-6 text-slate-500">
              {{ item.description }}
            </p>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
