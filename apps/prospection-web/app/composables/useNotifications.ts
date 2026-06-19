export type NotificationKind = 'success' | 'info' | 'warning' | 'error'

export type AppNotification = {
  id: string
  title: string
  message?: string
  kind: NotificationKind
  createdAt: number
  read: boolean
  href?: string
}

const STORAGE_KEY = 'magify-notifications'
const MAX_NOTIFICATIONS = 30

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function loadFromStorage(): AppNotification[] {
  if (!import.meta.client) {
    return []
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as AppNotification[]
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter((item) => item && typeof item.id === 'string' && typeof item.title === 'string')
      .slice(0, MAX_NOTIFICATIONS)
  } catch {
    return []
  }
}

export function useNotificationsStore() {
  const notifications = useState<AppNotification[]>('magify-notifications', loadFromStorage)
  const hydrated = useState<boolean>('magify-notifications-hydrated', () => false)

  function persist() {
    if (!import.meta.client) {
      return
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.value))
    } catch {
      // Best-effort only.
    }
  }

  function hydrate() {
    if (hydrated.value || !import.meta.client) {
      return
    }

    notifications.value = loadFromStorage()
    hydrated.value = true
  }

  function add(notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { read?: boolean }) {
    hydrate()

    const next: AppNotification = {
      id: createId(),
      createdAt: Date.now(),
      read: notification.read ?? false,
      ...notification,
    }

    notifications.value = [next, ...notifications.value].slice(0, MAX_NOTIFICATIONS)
    persist()

    return next
  }

  function markRead(id: string) {
    hydrate()
    notifications.value = notifications.value.map((item) =>
      item.id === id ? { ...item, read: true } : item,
    )
    persist()
  }

  function markAllRead() {
    hydrate()
    notifications.value = notifications.value.map((item) => ({ ...item, read: true }))
    persist()
  }

  function remove(id: string) {
    hydrate()
    notifications.value = notifications.value.filter((item) => item.id !== id)
    persist()
  }

  function clear() {
    notifications.value = []
    persist()
  }

  const unreadCount = computed(() => notifications.value.filter((item) => !item.read).length)

  return {
    notifications,
    unreadCount,
    add,
    markRead,
    markAllRead,
    remove,
    clear,
    hydrate,
  }
}
