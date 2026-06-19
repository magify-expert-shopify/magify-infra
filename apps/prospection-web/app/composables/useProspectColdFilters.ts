export type ProspectColdPositioningFilter = 'all' | 'support' | 'refonte' | 'migration'

type ProspectColdFiltersState = {
  positioning: ProspectColdPositioningFilter
  hideQueuedEmails: boolean
}

const STORAGE_KEY = 'magify-prospect-cold-filters'

function createDefaultState(): ProspectColdFiltersState {
  return {
    positioning: 'all',
    hideQueuedEmails: true,
  }
}

function loadFromStorage(): ProspectColdFiltersState {
  if (!import.meta.client) {
    return createDefaultState()
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return createDefaultState()
    }

    const parsed = JSON.parse(raw) as Partial<ProspectColdFiltersState>
    const positioning = parsed?.positioning
    const hideQueuedEmails = parsed?.hideQueuedEmails

    return {
      positioning: positioning === 'support' || positioning === 'refonte' || positioning === 'migration'
        ? positioning
        : 'all',
      hideQueuedEmails: typeof hideQueuedEmails === 'boolean' ? hideQueuedEmails : true,
    }
  } catch {
    return createDefaultState()
  }
}

export function useProspectColdFiltersStore() {
  const state = useState<ProspectColdFiltersState>('magify-prospect-cold-filters', createDefaultState)
  const hydrated = useState<boolean>('magify-prospect-cold-filters-hydrated', () => false)

  function persist() {
    if (!import.meta.client) {
      return
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value))
    } catch {
      // Best effort only.
    }
  }

  function hydrate() {
    if (hydrated.value || !import.meta.client) {
      return
    }

    state.value = loadFromStorage()
    hydrated.value = true
  }

  function setPositioning(positioning: ProspectColdPositioningFilter) {
    hydrate()
    state.value = {
      ...state.value,
      positioning,
    }
    persist()
  }

  function setHideQueuedEmails(hideQueuedEmails: boolean) {
    hydrate()
    state.value = {
      ...state.value,
      hideQueuedEmails,
    }
    persist()
  }

  function reset() {
    state.value = createDefaultState()
    persist()
  }

  return {
    state,
    hydrate,
    setPositioning,
    setHideQueuedEmails,
    reset,
  }
}
