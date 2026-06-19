export type TrashedUrlItem = {
  id: number
  url: string
  sourceFile: string
  siteName: string | null
  shopifyStatus: string
  cmsName: string | null
  redesignStatus: string | null
  contactStatus: string
  trashedAt: string | null
  createdAt: string
}

export type TrashedProspectItem = {
  id: number
  name: string
  siteName: string
  sourceFile: string
  status: string
  leadScore: number
  score: number
  trashedAt: string | null
  createdAt: string
  url: {
    url: string
    shopifyStatus: string | null
    cmsName: string | null
    shopifyThemeSchemaName: string | null
    redesignStatus: string | null
  } | null
}

export type TrashedImportItem = {
  id: number
  sourceFile: string
  totalUrls: number
  existingUrls: number
  queuedUrls: number
  processedUrls: number
  failedUrls: number
  status: string
  currentStep: string
  queuedAt: string | null
  startedAt: string | null
  finishedAt: string | null
  trashedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}
