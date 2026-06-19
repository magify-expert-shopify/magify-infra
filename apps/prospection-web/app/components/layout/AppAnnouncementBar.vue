<template>
  <div
    class="fixed inset-x-0 top-0 z-50 border-b border-brand-200 bg-brand-500 text-white shadow-sm"
  >
    <div
      class="mx-auto flex h-14 w-full max-w-none items-center justify-between gap-4 px-4 lg:px-6"
    >
      <div class="flex min-w-0 items-center gap-3">
        <span
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15"
        >
          <UIcon name="i-lucide-target" class="h-4 w-4" />
        </span>
        <div class="min-w-0">
          <p
            class="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75"
          >
            Objectif du mois
          </p>
          <p class="truncate text-xs font-medium text-white">
            Convertir davantage de prospects prioritaires en gardant un suivi
            régulier des relances.
          </p>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <UButton
          to="/stats"
          color="neutral"
          variant="soft"
          size="sm"
          class="shrink-0"
        >
          Voir l’objectif
        </UButton>
      </div>
    </div>
  </div>
</template>
