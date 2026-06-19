export type ScanLaunchThemeType = 'free' | 'paid' | 'custom' | 'all'
export type ScanLaunchImportRange = 'today' | 'week' | 'all'
export type ScanLaunchProspectScope = 'with' | 'without' | 'all'
export type ScanLaunchOverwriteMode = 'merge' | 'clear' | 'fill_missing'
export type ScanLaunchStepKey = 'shopify' | 'cms_detection' | 'language' | 'seo_meta' | 'legal_notice' | 'catalog' | 'contact' | 'linkedin' | 'social' | 'technical' | 'lighthouse'

export type ScanLaunchFilters = {
  cmsName: string
  importRange: ScanLaunchImportRange
  themeType: ScanLaunchThemeType
  prospectScope: ScanLaunchProspectScope
}

export type ScanLaunchTarget = {
  id: number
  url: string
  siteName: string | null
  createdAt: string
  shopifyStatus: string
  cmsName: string | null
  shopifyThemeStoreType: 'free' | 'paid' | 'custom'
  shopifyThemeName: string | null
  shopifyThemeSchemaName: string | null
  hasProspect: boolean
  themeType: Exclude<ScanLaunchThemeType, 'all'>
}

export type ScanLaunchPreviewResponse = {
  items: ScanLaunchTarget[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type ScanLaunchResponse = {
  scanned: number
  total: number
  launchId?: number
  results: Array<{
    id: number
    url: string
    processed: number
    error?: string
  }>
}

export type ScanLaunchChange = {
  urlId: number
  url: string
  siteName: string | null
  step: ScanLaunchStepKey
  stepLabel: string
  field: string
  fieldLabel: string
  before: string | null
  after: string | null
}

export type ScanLaunchStatusResponse = {
  id: number
  status: 'idle' | 'queued' | 'running' | 'completed' | 'error'
  totalUrls: number
  processedUrls: number
  runningUrls: number
  pendingUrls: number
  queuedAt: string | null
  startedAt: string | null
  finishedAt: string | null
  lastError: string | null
  currentUrlId: number | null
  updatedAt: string | null
  changes: ScanLaunchChange[]
}
