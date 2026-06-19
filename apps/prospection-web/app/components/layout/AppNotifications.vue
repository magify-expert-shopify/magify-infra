<script setup lang="ts">
const notificationsStore = useNotificationsStore();
const open = ref(false);
const root = ref<HTMLElement | null>(null);

const notifications = computed(() => notificationsStore.notifications.value);
const unreadCount = computed(() => notificationsStore.unreadCount.value);

function formatTimestamp(value: number) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function kindClass(kind: string) {
  if (kind === "success")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (kind === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (kind === "error") return "border-red-200 bg-red-50 text-red-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function kindIcon(kind: string) {
  if (kind === "success") return "i-lucide-circle-check-big";
  if (kind === "warning") return "i-lucide-triangle-alert";
  if (kind === "error") return "i-lucide-circle-x";
  return "i-lucide-bell-ring";
}

function toggle() {
  open.value = !open.value;
  if (open.value) {
    notificationsStore.markAllRead();
  }
}

function close() {
  open.value = false;
}

function handleDocumentClick(event: MouseEvent) {
  if (!open.value) {
    return;
  }

  const target = event.target as Node | null;
  if (root.value && target && !root.value.contains(target)) {
    close();
  }
}

function openNotification(notificationId: string) {
  notificationsStore.markRead(notificationId);
}

onMounted(() => {
  notificationsStore.hydrate();
  document.addEventListener("click", handleDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleDocumentClick);
});
</script>

<template>
  <div ref="root" class="relative">
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-bell"
      size="sm"
      aria-label="Notifications"
      class="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
      @click.stop="toggle"
    >
      <span
        v-if="unreadCount"
        class="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
      >
        {{ unreadCount > 9 ? "9+" : unreadCount }}
      </span>
    </UButton>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-1 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 translate-y-1 scale-95"
    >
      <div
        v-if="open"
        class="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[22rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <div
          class="flex items-center justify-between border-b border-slate-200 px-4 py-3"
        >
          <div>
            <p class="text-xs font-semibold text-slate-900">Notifications</p>
            <p class="text-xs text-slate-500">
              {{ notifications.length }} événement(s)
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-check-check"
              :disabled="!notifications.length"
              @click.stop="notificationsStore.markAllRead()"
            />
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-trash-2"
              :disabled="!notifications.length"
              @click.stop="notificationsStore.clear()"
            />
          </div>
        </div>

        <div class="max-h-[24rem] overflow-y-auto">
          <div
            v-if="!notifications.length"
            class="px-4 py-8 text-center text-muted-sm"
          >
            Aucune notification pour le moment.
          </div>

          <div
            v-for="notification in notifications"
            :key="notification.id"
            class="border-b border-slate-100 px-4 py-3 transition-colors"
            :class="notification.read ? 'bg-white' : 'bg-slate-50'"
          >
            <div class="flex gap-3">
              <div
                class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
                :class="kindClass(notification.kind)"
              >
                <UIcon :name="kindIcon(notification.kind)" class="h-4 w-4" />
              </div>

              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex items-start justify-between gap-2">
                  <p class="truncate text-xs font-medium text-slate-900">
                    {{ notification.title }}
                  </p>
                  <span class="shrink-0 text-[11px] text-slate-400">
                    {{ formatTimestamp(notification.createdAt) }}
                  </span>
                </div>
                <p
                  v-if="notification.message"
                  class="text-xs leading-5 text-slate-600"
                >
                  {{ notification.message }}
                </p>
                <div class="flex items-center gap-2 pt-1">
                  <UButton
                    v-if="notification.href"
                    :to="notification.href"
                    color="primary"
                    variant="soft"
                    size="xs"
                    @click="openNotification(notification.id)"
                  >
                    Ouvrir
                  </UButton>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    @click="notificationsStore.remove(notification.id)"
                  >
                    Supprimer
                  </UButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
