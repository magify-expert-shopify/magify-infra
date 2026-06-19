<script setup lang="ts">
const route = useRoute();

const isStandaloneRoute = computed(() =>
  new Set(["/login", "/onboarding", "/projects"]).has(route.path),
);
</script>

<template>
  <UApp>
    <UToaster />
    <NuxtRouteAnnouncer />
    <template v-if="!isStandaloneRoute">
      <LayoutsAppAnnouncementBar />
      <LayoutsAppTopHeader />
      <LayoutsAppSidebar />
      <div class="relative min-h-screen pt-28 lg:pl-[200px]">
        <div class="px-5 py-6 lg:px-8">
          <NuxtPage />
        </div>
      </div>
    </template>

    <template v-else>
      <NuxtPage />
    </template>
  </UApp>
</template>
