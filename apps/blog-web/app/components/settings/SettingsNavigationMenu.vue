<script setup lang="ts">
import { settingsNavigationItems as items } from "~/constants/settings-navigation";

const route = useRoute();

const selectedNavigation = computed(
  () => items.find((item) => item.to === route.path)?.to ?? items[0].to,
);
</script>

<template>
  <div
    class="xl:fixed xl:left-[200px] xl:bottom-0 xl:top-28 xl:z-20 xl:w-[320px] xl:max-h-[calc(100vh-7rem)] xl:overflow-auto"
  >
    <div class="xl:hidden">
      <select
        :value="selectedNavigation"
        class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
        @change="navigateTo(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="item in items" :key="item.to" :value="item.to">
          {{ item.label }}
        </option>
      </select>
    </div>

    <aside class="border-r border-slate-200 hidden xl:block px-2 py-3">
      <nav class="space-y-4">
        <NuxtLink
          v-for="item in items"
          :key="item.to"
          :to="item.to"
          class="block border rounded-lg px-4 py-3 transition"
          :class="
            route.path === item.to
              ? 'bg-primary/10 border-primary-200 text-primary'
              : '  border-slate-100 text-slate-500 hover:bg-slate-50 hover:bg-text-slate-900'
          "
        >
          <div class="flex items-start gap-3">
            <div
              class="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl"
              :class="
                route.path === item.to
                  ? 'bg-primary-100 text-violet-700'
                  : 'bg-slate-100 text-slate-500'
              "
            >
              <UIcon :name="item.icon" class="h-4 w-4" />
            </div>

            <div class="min-w-0 space-y-1">
              <p class="text-sm font-medium">
                {{ item.label }}
              </p>
              <p class="text-xs leading-5">
                {{ item.description }}
              </p>
            </div>
          </div>
        </NuxtLink>
      </nav>
    </aside>
  </div>
</template>
