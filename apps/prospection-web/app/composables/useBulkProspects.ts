export interface BulkProspectImportResponse {
  id: number
  sourceFile: string
  urls: string[]
  urlIds: number[]
  existingUrlIds: number[]
  newUrlIds: number[]
  totalUrls: number
  existingUrls: number
  queuedUrls: number
  processedUrls: number
  failedUrls: number
  status: string
  currentStep: string
}

export interface BulkProspectImportSkippedResponse {
  skipped: true
  reason: 'all_urls_already_scanned'
  message: string
  sourceFile: string
  totalUrls: number
  existingUrls: number
  urlIds: number[]
  existingUrlIds: number[]
  newUrlIds: number[]
}

export function useBulkProspects() {
  const runtimeConfig = useRuntimeConfig()

  function extractUrls(text: string) {
    const matches = String(text || '').match(/https?:\/\/[^\s<>"'`]+/gi) || []
    return [...new Set(matches.map((value) => value.replace(/[),.;:!?]+$/g, '').trim()).filter(Boolean))]
  }

  function normalizeUrlList(input: string) {
    return extractUrls(input).map((value) => value.trim()).filter(Boolean)
  }

  async function createBulkProspectImport(urls: string[], sourceFile = 'manual') {
    const normalizedUrls = [...new Set(urls.map((value) => value.trim()).filter(Boolean))]

    if (!normalizedUrls.length) {
      throw new Error('Ajoute au moins une URL valide.')
    }

    return $fetch<BulkProspectImportResponse | BulkProspectImportSkippedResponse>(`${runtimeConfig.public.apiUrl}/imports`, {
      method: 'POST',
      body: {
        urls: normalizedUrls,
        sourceFile,
      },
    })
  }

  return {
    extractUrls,
    normalizeUrlList,
    createBulkProspectImport,
  }
}
