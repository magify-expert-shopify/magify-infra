export type UrlAnalysisState = 'done' | 'running' | 'pending' | 'missing'

export type ImportDetail = {
  id: number
  sourceFile: string
  urls: string[]
  urlIds: number[]
  urlAnalysisCounts: {
    done: number
    running: number
    pending: number
    total: number
  }
  urlStates: Array<{
    id: number | null
    url: string
    state: UrlAnalysisState
  }>
  existingUrlIds: number[]
  newUrlIds: number[]
  totalUrls: number
  existingUrls: number
  queuedUrls: number
  processedUrls: number
  failedUrls: number
  status: string
  currentStep: string
  currentUrlId: number | null
  queuedAt: string | null
  startedAt: string | null
  finishedAt: string | null
  lastError: string | null
  shopifyDoneAt: string | null
  contactDoneAt: string | null
  linkedinDoneAt: string | null
  technicalDoneAt: string | null
  lighthouseDoneAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export type ImportPageDetail = Pick<
  ImportDetail,
  | 'id'
  | 'sourceFile'
  | 'urls'
  | 'urlIds'
  | 'urlAnalysisCounts'
  | 'urlStates'
  | 'totalUrls'
  | 'existingUrls'
  | 'queuedUrls'
  | 'processedUrls'
  | 'failedUrls'
  | 'status'
  | 'currentStep'
  | 'currentUrlId'
  | 'queuedAt'
  | 'startedAt'
  | 'lastError'
  | 'shopifyDoneAt'
  | 'contactDoneAt'
  | 'linkedinDoneAt'
  | 'technicalDoneAt'
  | 'lighthouseDoneAt'
  | 'completedAt'
  | 'createdAt'
  | 'updatedAt'
>

export type ImportListItem = {
  id: number
  sourceFile: string
  totalUrls: number
  existingUrls: number
  queuedUrls: number
  processedUrls: number
  failedUrls: number
  status: string
  currentStep: string
  urlAnalysisCounts: {
    done: number
    running: number
    pending: number
    total: number
  }
  queuedAt: string | null
  startedAt: string | null
  finishedAt: string | null
  lastError: string | null
  createdAt: string
  updatedAt: string
}

export type UrlAnalysisDetail = {
  id: number
  url: string
  siteName: string | null
  shopifyStatus: string
  contactStatus: string
  cmsName: string | null
  shopifyCheckedAt: string | null
  contactCheckedAt: string | null
  lighthouseCheckedAt: string | null
  scanTotalMs: number | null
  scanTtfbMs: number | null
  lighthouseScore: number | null
  redesignStatus: string | null
  blacklistedAt: string | null
  missing?: boolean
  error?: string
}

export type UrlAnalysisRow = {
  id: number | null
  url: string
  state: UrlAnalysisState
}

export type ImportContactPreview = {
  id: number
  urlId: number | null
  name: string | null
  siteName: string | null
  status: string | null
  email: string | null
  avatarUrl: string | null
  linkedinImageUrl: string | null
}

export type ImportContactsSummaryResponse = {
  total: number
  prospects: ImportContactPreview[]
}
