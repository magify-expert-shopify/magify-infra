<template>
  <div class="fixed inset-x-0 top-0 z-50 bg-primary-500 text-white">
    <div class="flex h-14 w-full items-center justify-between gap-4 px-4 lg:px-6">
      <div class="flex min-w-0 items-center gap-3">
        <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15">
          <UIcon name="i-lucide-target" class="h-4 w-4" />
        </span>
        <div class="min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
            Objectif du sprint
          </p>
          <p class="truncate text-xs font-medium text-white">
            Mettre en place le cluster <NuxtLink to="/clusters/cmpbiily70001toukwhk9ifvb" class="font-bold">Performance Shopify</NuxtLink>
          </p>
        </div>
      </div>

      <!-- <div class="flex shrink-0 items-center gap-2">
        <UButton
          to="/stats"
          color="neutral"
          variant="soft"
          size="sm"
          class="shrink-0"
        >
          Voir l’objectif
        </UButton>
      </div> -->
    </div>
  </div>
</template>
