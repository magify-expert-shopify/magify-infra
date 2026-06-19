<script setup lang="ts">
const isMobileSidebarOpen = useState("mobile-sidebar-open", () => false);
const { user, signOut } = useSupabaseAuth();

async function handleSignOut() {
  await signOut();
  await navigateTo("/login");
}
</script>

<template>
  <header
    class="fixed inset-x-0 top-14 z-30 border-b border-slate-200/80 bg-background/95 shadow-sm backdrop-blur-sm"
  >
    <div class="mx-auto flex h-14 w-full max-w-none items-center">
      <div
        class="flex h-full md:w-[200px] flex-shrink-0 items-center gap-2.5 border-r border-slate-200 px-4"
      >
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          square
          class="rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-900 lg:hidden"
          icon="i-lucide-menu"
          aria-label="Ouvrir le menu"
          title="Ouvrir le menu"
          @click="isMobileSidebarOpen = true"
        />
        <NuxtLink to="/" class="flex min-w-0 items-center gap-2.5">
          <img
            src="https://dfbjmfcqulkhjvhbkdti.supabase.co/storage/v1/object/public/crm-assets/logo-1777633237292.png"
            alt=""
            class="h-7 w-7 flex-shrink-0 rounded-full object-cover"
          />
          <span class="hidden md:inline truncate text-xs font-medium text-slate-900">
            Blog OS
          </span>
        </NuxtLink>
      </div>

      <LayoutsAppQuickSearch class="flex-1" />

      <div class="flex flex-none items-center gap-2 px-4">
        <LayoutsAppNotifications />
        <LayoutsAppColorModeToggle />
        <div
          v-if="user"
          class="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 md:flex"
        >
          <UIcon name="i-lucide-user" class="h-3.5 w-3.5" />
          <span class="max-w-[12rem] truncate">{{ user.email || user.id }}</span>
        </div>

        <UPopover
          v-if="user"
          :content="{
            side: 'bottom',
            align: 'end',
          }"
        >
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            square
            class="rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-900"
            icon="i-lucide-settings"
            aria-label="Ouvrir le menu paramètres"
            title="Paramètres"
          />

          <template #content="{ close }">
            <div class="w-64 rounded-2xl bg-white p-2 shadow-xl">
              <div class="border-b border-slate-200 px-3 py-2">
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Mon espace
                </p>
                <p class="mt-1 truncate text-sm font-medium text-slate-900">
                  {{ user.email || user.id }}
                </p>
              </div>

              <div class="space-y-1 p-2">
                <NuxtLink
                  to="/settings"
                  class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                  @click="close"
                >
                  <UIcon name="i-lucide-settings" class="h-4 w-4" />
                  <span>Paramètres</span>
                </NuxtLink>

                <NuxtLink
                  to="/projects"
                  class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                  @click="close"
                >
                  <UIcon name="i-lucide-folders" class="h-4 w-4" />
                  <span>Projets</span>
                </NuxtLink>

                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                  @click="close(); handleSignOut()"
                >
                  <UIcon name="i-lucide-log-out" class="h-4 w-4" />
                  <span>Déconnexion</span>
                </button>
              </div>
            </div>
          </template>
        </UPopover>
      </div>
    </div>
  </header>
</template>
