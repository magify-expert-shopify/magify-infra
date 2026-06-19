<template>
  <header
    class="fixed inset-x-0 top-14 z-40 border-b border-slate-200/80 bg-background/95 shadow-sm backdrop-blur-sm"
  >
    <div class="mx-auto flex h-14 w-full max-w-none items-center">
      <div
        class="flex h-full w-[200px] flex-shrink-0 items-center gap-2.5 border-r border-slate-200 px-4"
      >
        <NuxtLink to="/" class="flex min-w-0 items-center gap-2.5">
          <img
            src="https://dfbjmfcqulkhjvhbkdti.supabase.co/storage/v1/object/public/crm-assets/logo-1777633237292.png"
            alt=""
            class="h-7 w-7 flex-shrink-0 rounded-full object-cover"
          />
          <span class="truncate text-xs font-medium text-slate-900">
            Prospection OS
          </span>
        </NuxtLink>
      </div>

      <LayoutAppQuickSearch class="flex-1" />

      <div class="flex flex-none items-center gap-2 px-4">
        <LayoutAppNotifications />
        <LayoutAppColorModeToggle />
        <UButton
          to="/settings"
          color="neutral"
          variant="ghost"
          size="sm"
          square
          class="rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-900"
          icon="i-lucide-settings"
          aria-label="Accéder aux paramètres"
          title="Paramètres"
        />
      </div>
    </div>
  </header>
</template>
