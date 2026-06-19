<script setup lang="ts">
import SettingsConnectionsSection from "~/components/settings/SettingsConnectionsSection.vue";
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <ul class="list-disc space-y-3 pl-5 text-sm text-slate-700">
        <li>
          <a
            href="https://platform.openai.com/home"
            class="font-medium text-slate-900 hover:text-violet-700"
          >
            Open AI API
          </a>
        </li>
        <li>
          <a
            href="https://app.dataforseo.com/api-dashboard"
            class="font-medium text-slate-900 hover:text-violet-700"
          >
            DataForSEO API
          </a>
        </li>
      </ul>
    </div>
    <SettingsConnectionsSection />
  </div>
</template>
