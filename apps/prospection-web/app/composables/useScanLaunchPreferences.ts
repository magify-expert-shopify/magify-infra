import type { ScanLaunchFilters, ScanLaunchStepKey } from '~/types/scans'

type ScanLaunchPreferencesState = {
  selectedSteps: ScanLaunchStepKey[]
  filters: ScanLaunchFilters
  overwriteMode: 'merge' | 'clear' | 'fill_missing'
}

const STORAGE_KEY = 'magify-scan-launch-preferences'
const DEFAULT_SELECTED_STEPS: ScanLaunchStepKey[] = ['shopify', 'cms_detection', 'seo_meta']
const DEFAULT_FILTERS: ScanLaunchFilters = {
  cmsName: '',
  importRange: 'all',
  themeType: 'all',
  prospectScope: 'all',
}

const STEP_DEPENDENCIES: Partial<Record<ScanLaunchStepKey, ScanLaunchStepKey[]>> = {
  legal_notice: ['shopify'],
  contact: ['shopify'],
}

function createDefaultState(): ScanLaunchPreferencesState {
  return {
    selectedSteps: [...DEFAULT_SELECTED_STEPS],
    filters: { ...DEFAULT_FILTERS },
    overwriteMode: 'fill_missing',
  }
}

function normalizeSelectedSteps(value: unknown): ScanLaunchStepKey[] {
  if (!Array.isArray(value)) {
    return []
  }

  const allowed = new Set<ScanLaunchStepKey>([
    'shopify',
    'cms_detection',
    'language',
    'seo_meta',
    'legal_notice',
    'catalog',
    'contact',
    'linkedin',
    'social',
    'technical',
    'lighthouse',
  ])

  const selected = value.filter((item): item is ScanLaunchStepKey => typeof item === 'string' && allowed.has(item as ScanLaunchStepKey))

  const resolved = new Set<ScanLaunchStepKey>(selected)

  for (const step of Array.from(resolved)) {
    for (const dependency of STEP_DEPENDENCIES[step] || []) {
      resolved.add(dependency)
    }
  }

  return Array.from(resolved)
}

function normalizeFilters(value: unknown): ScanLaunchFilters {
  const source = typeof value === 'object' && value !== null ? value as Partial<ScanLaunchFilters> : {}
  const allowedImportRanges: ScanLaunchFilters['importRange'][] = ['today', 'week', 'all']
  const allowedThemeTypes: ScanLaunchFilters['themeType'][] = ['free', 'paid', 'custom', 'all']
  const allowedProspectScopes: ScanLaunchFilters['prospectScope'][] = ['with', 'without', 'all']

  return {
    cmsName: typeof source.cmsName === 'string' ? source.cmsName : '',
    importRange: allowedImportRanges.includes(source.importRange as ScanLaunchFilters['importRange'])
      ? (source.importRange as ScanLaunchFilters['importRange'])
      : 'all',
    themeType: allowedThemeTypes.includes(source.themeType as ScanLaunchFilters['themeType'])
      ? (source.themeType as ScanLaunchFilters['themeType'])
      : 'all',
    prospectScope: allowedProspectScopes.includes(source.prospectScope as ScanLaunchFilters['prospectScope'])
      ? (source.prospectScope as ScanLaunchFilters['prospectScope'])
      : 'all',
  }
}

function normalizeOverwriteMode(value: unknown): ScanLaunchPreferencesState['overwriteMode'] {
  if (value === 'merge' || value === 'clear' || value === 'fill_missing') {
    return value
  }

  return 'fill_missing'
}

function loadFromStorage(): ScanLaunchPreferencesState {
  if (!import.meta.client) {
    return createDefaultState()
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return createDefaultState()
    }

    const parsed = JSON.parse(raw) as Partial<ScanLaunchPreferencesState>
    const selectedSteps = normalizeSelectedSteps(parsed?.selectedSteps)
    const filters = normalizeFilters(parsed?.filters)
    const overwriteMode = normalizeOverwriteMode(parsed?.overwriteMode)

    return {
      selectedSteps: selectedSteps.length > 0 ? selectedSteps : [...DEFAULT_SELECTED_STEPS],
      filters,
      overwriteMode,
    }
  } catch {
    return createDefaultState()
  }
}

export function useScanLaunchPreferencesStore() {
  const state = useState<ScanLaunchPreferencesState>('magify-scan-launch-preferences', createDefaultState)
  const hydrated = useState<boolean>('magify-scan-launch-preferences-hydrated', () => false)

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

  function setSelectedSteps(selectedSteps: ScanLaunchStepKey[]) {
    hydrate()
    state.value = {
      ...state.value,
      selectedSteps: normalizeSelectedSteps(selectedSteps),
    }
    persist()
  }

  function setFilters(filters: ScanLaunchFilters) {
    hydrate()
    state.value = {
      ...state.value,
      filters: normalizeFilters(filters),
    }
    persist()
  }

  function setOverwriteMode(overwriteMode: ScanLaunchPreferencesState['overwriteMode']) {
    hydrate()
    state.value = {
      ...state.value,
      overwriteMode: normalizeOverwriteMode(overwriteMode),
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
    setSelectedSteps,
    setFilters,
    setOverwriteMode,
    reset,
  }
}
