<script setup lang="ts">
const route = useRoute();

type SidebarItem = {
  label: string;
  to: string;
  icon: string;
  visible?: boolean;
};

type SidebarGroup = {
  title?: string;
  items: SidebarItem[];
};

const itemGroups = [
  {
    items: [{ label: "Dashboard", to: "/", icon: "i-lucide-layout-dashboard" }],
  },
  {
    title: "Prospection",
    items: [
      { label: "Prospects", to: "/prospects", icon: "i-lucide-users" },
      {
        label: "Emails",
        to: "/prospects/emails-planifies",
        icon: "i-lucide-mail",
      },
      { label: "Rechercher", to: "/search-prospects", icon: "i-lucide-search" },
    ],
  },
  {
    title: "Actions",
    items: [
      {
        label: "Ajouter",
        to: "/add-prospect",
        icon: "i-lucide-plus-circle",
        visible: false,
      },
      {
        label: "Ajouter plusieurs",
        to: "/add-prospects",
        icon: "i-lucide-files",
      },
      { label: "Lancer les scans", to: "/scans", icon: "i-lucide-rocket" },
      { label: "Imports", to: "/imports", icon: "i-lucide-inbox" },
    ],
  },
  {
    title: "Pilotage",
    items: [
      { label: "Sites", to: "/urls", icon: "i-lucide-table" },
      { label: "Statistiques", to: "/stats", icon: "i-lucide-chart-column" },
      { label: "Paramètres", to: "/settings", icon: "i-lucide-settings-2" },
      { label: "Corbeille", to: "/trash", icon: "i-lucide-trash-2" },
    ],
  },
] as const satisfies readonly SidebarGroup[];

const visibleItemGroups = computed(() =>
  itemGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.visible !== false),
    }))
    .filter((group) => group.items.length > 0),
);

function isActive(path: string) {
  if (path === "/") {
    return route.path === "/";
  }

  return route.path === path || route.path.startsWith(`${path}/`);
}
</script>

<template>
  <aside
    class="fixed bottom-0 left-0 top-28 z-40 hidden w-[200px] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white/95 px-2 py-3 shadow-sm backdrop-blur lg:flex"
  >
    <nav class="space-y-4">
      <div
        v-for="(group, groupIndex) in visibleItemGroups"
        :key="group.title || `group-${groupIndex}`"
        class="space-y-2"
      >
        <p
          v-if="group.title"
          class="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400/60"
        >
          {{ group.title }}
        </p>
        <div class="space-y-1">
          <NuxtLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-xs transition"
            :class="
              isActive(item.to)
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            "
          >
            <UIcon :name="item.icon" class="h-4 w-4" />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </div>
      </div>
    </nav>

    <!-- <div class="mt-auto rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Vue actuelle
      </p>
      <p class="mt-1 text-xs font-medium text-slate-900">
        {{ items.find((item) => isActive(item.to))?.label || 'Accueil' }}
      </p>
    </div> -->
  </aside>
</template>
