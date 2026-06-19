<script setup lang="ts">
import SettingsNavigationMenu from "~/components/settings/SettingsNavigationMenu.vue";

const config = useRuntimeConfig();
const bullDashboardUrl = `${config.public.apiUrl}/admin/queues`;
</script>

<template>
  <div>
    <SettingsNavigationMenu />
    <div class="xl:pl-[320px] space-y-6">
      <header class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900">
          Settings
        </h1>
        <p class="text-sm text-slate-500">
          Gérez ici les réglages éditoriaux, les connexions et les instructions
          envoyées à l’IA.
        </p>
        <a
          :href="bullDashboardUrl"
          target="_blank"
          rel="noreferrer"
          class="inline-flex text-sm font-medium text-sky-600 underline underline-offset-2 transition hover:text-sky-700"
        >
          Voir les jobs Bull Dashboard
        </a>
      </header>

      <div class="min-w-0">
        <slot />
      </div>
    </div>
  </div>
</template>
