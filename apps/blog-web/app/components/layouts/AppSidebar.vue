<script setup lang="ts">
import { sidebarItemGroups } from "~/constants/sidebar";
import { sidebarToneClasses, type SidebarTone } from "~/utils/sidebar-tone";
import type { SidebarGroup, SidebarItem } from "~/types/navigation";

const route = useRoute();
const { currentProject } = useCurrentProject();
const isMobileSidebarOpen = useState("mobile-sidebar-open", () => false);
const sidebarGroups = sidebarItemGroups as readonly SidebarGroup[];

function getTone(target: { tone?: string }, fallback: SidebarTone = "slate") {
  return (
    target.tone && target.tone in sidebarToneClasses ? target.tone : fallback
  ) as SidebarTone;
}

function getSidebarItemClass(group: SidebarGroup, item: SidebarItem) {
  const toneClasses = sidebarToneClasses[getTone(item, getTone(group))];

  return isActive(item.to)
    ? `${toneClasses.itemActive} font-medium`
    : toneClasses.itemInactive;
}

const visibleItemGroups = computed(() =>
  sidebarGroups
    .filter((group) => group.visible !== false)
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

watch(
  () => route.fullPath,
  () => {
    isMobileSidebarOpen.value = false;
  },
);
</script>

<template>
  <div>
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <button
        v-if="isMobileSidebarOpen"
        type="button"
        class="fixed inset-0 z-40 bg-slate-950/35 lg:hidden"
        aria-label="Fermer le menu"
        @click="isMobileSidebarOpen = false"
      />
    </Transition>

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
              :class="getSidebarItemClass(group, item)"
            >
              <UIcon :name="item.icon" class="h-4 w-4" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </div>
        </div>
      </nav>

      <NuxtLink
        to="/projects"
        class="mt-auto block rounded-2xl border border-sky-200 bg-sky-50/80 p-3 text-slate-900 transition hover:border-sky-300 hover:bg-sky-100/80"
      >
        <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700/80">
          Projet courant
        </p>
        <p class="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">
          {{ currentProject?.name || "Choisir un projet" }}
        </p>
      </NuxtLink>
    </aside>

    <aside
      class="fixed bottom-0 left-0 top-28 z-50 flex w-[min(22rem,calc(100vw-1.25rem))] flex-col overflow-y-auto border-r border-slate-200 bg-white px-3 py-3 shadow-2xl transition-transform duration-200 ease-out lg:hidden"
      :class="isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'"
      :aria-hidden="!isMobileSidebarOpen"
    >
      <div class="mb-3 flex items-center justify-between gap-3 px-2">
        <p
          class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"
        >
          Navigation
        </p>
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          square
          class="rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          icon="i-lucide-x"
          aria-label="Fermer le menu"
          title="Fermer le menu"
          @click="isMobileSidebarOpen = false"
        />
      </div>

      <nav class="space-y-4">
        <div
          v-for="(group, groupIndex) in visibleItemGroups"
          :key="group.title || `mobile-group-${groupIndex}`"
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
              :key="`${group.title || 'group'}-${item.to}`"
              :to="item.to"
              class="flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm transition"
              :class="getSidebarItemClass(group, item)"
            >
              <UIcon :name="item.icon" class="h-4 w-4" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </div>
        </div>
      </nav>

      <NuxtLink
        to="/projects"
        class="mt-auto block rounded-2xl border border-sky-200 bg-sky-50/80 p-4 text-slate-900 transition hover:border-sky-300 hover:bg-sky-100/80"
      >
        <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700/80">
          Projet courant
        </p>
        <p class="mt-1 text-sm font-semibold text-slate-900">
          {{ currentProject?.name || "Choisir un projet" }}
        </p>
      </NuxtLink>
    </aside>
  </div>
</template>
