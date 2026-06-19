export type UrlRow = {
  id: number
  url: string
  sourceFile: string
  createdAt: string
  shopifyStatus: string
  siteKey: string | null
  siteCountryCode: string | null
  siteCountryName: string | null
  shopifyCheckedAt: string | null
  seoMetaCheckedAt: string | null
  httpStatus: number | null
  cmsName: string | null
  shopifyThemeName: string | null
  shopifyThemeId: string | null
  shopifyThemeSchemaName: string | null
  shopifyThemeJson: string | null
  redesignStatus: string | null
  scanShopifyMs: number | null
  scanCmsDetectionMs: number | null
  scanLanguageMs: number | null
  scanSeoMetaMs: number | null
  scanLegalNoticeMs: number | null
  scanCatalogMs: number | null
  scanContactMs: number | null
  scanLinkedinMs: number | null
  scanSocialMs: number | null
  scanTechnicalMs: number | null
  scanLighthouseMs: number | null
  scanWorkflowTotalMs: number | null
  scanTtfbMs: number | null
  scanTotalMs: number | null
  scanHtmlBytes: number | null
  siteName: string | null
  contactStatus: string
  contactCheckedAt: string | null
  contactEmail: string | null
  contactPhone: string | null
  contactSiret: string | null
  contactSiren: string | null
  contactFirstName: string | null
  contactLastName: string | null
  contactOwnerName: string | null
  contactCompanyName: string | null
  contactSourceUrl: string | null
  contactEvidence: string | null
  contactLinkedinUrl: string | null
  contactCompanyLinkedinUrl: string | null
  contactSocialLinksJson: string | null
  shopifyLegalNoticeStatus: string | null
  shopifyLegalNoticeUrl: string | null
  shopifyLegalNoticeCheckedAt?: string | null
  blacklistedAt?: string | null
}

export type UrlListMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type UrlListResponse = {
  items: UrlRow[]
  meta: UrlListMeta
}

function createDefaultMeta(): UrlListMeta {
  return {
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  }
}

export function useUrlsStore() {
  const items = useState<UrlRow[]>('urls-store-items', () => [])
  const meta = useState<UrlListMeta>('urls-store-meta', createDefaultMeta)
  const lastUpdatedAt = useState<number | null>('urls-store-updated-at', () => null)

  function setList(response: UrlListResponse) {
    items.value = response.items
    meta.value = response.meta
    lastUpdatedAt.value = Date.now()
  }

  function removeById(id: number) {
    items.value = items.value.filter((item) => item.id !== id)
    meta.value = {
      ...meta.value,
      total: Math.max(0, meta.value.total - 1),
      totalPages: Math.max(1, Math.ceil(Math.max(0, meta.value.total - 1) / meta.value.limit)),
    }
  }

  function updateById(id: number, nextItem: UrlRow) {
    const index = items.value.findIndex((item) => item.id === id)
    if (index === -1) {
      return
    }

    items.value = items.value.map((item) => (item.id === id ? nextItem : item))
    lastUpdatedAt.value = Date.now()
  }

  function upsertItem(nextItem: UrlRow) {
    const index = items.value.findIndex((item) => item.id === nextItem.id)
    if (index === -1) {
      items.value = [nextItem, ...items.value]
    } else {
      items.value = items.value.map((item) => (item.id === nextItem.id ? nextItem : item))
    }

    lastUpdatedAt.value = Date.now()
  }

  function reset() {
    items.value = []
    meta.value = createDefaultMeta()
    lastUpdatedAt.value = null
  }

  return {
    items,
    meta,
    lastUpdatedAt,
    setList,
    removeById,
    updateById,
    upsertItem,
    reset,
  }
}
