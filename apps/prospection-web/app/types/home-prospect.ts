export interface HomeProspectUrl {
  url: string
  shopifyStatus: string | null
  redesignStatus: string | null
  shopifyThemeStoreType: 'free' | 'paid' | 'custom' | null
  shopifyThemeSchemaName: string | null
  shopifyThemeName: string | null
  seoMetaCheckedAt: string | null
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
  scanTotalMs: number | null
  scanTtfbMs: number | null
  scanHtmlBytes: number | null
  lighthousePerformanceScore: number | null
  lighthouseAccessibilityScore: number | null
  lighthouseBestPracticesScore: number | null
  lighthouseSeoScore: number | null
}

export interface HomeProspect {
  id: number
  urlId: number | null
  name: string
  siteName: string
  sourceUrl: string
  sourceFile: string
  status: string
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  avatarUrl: string | null
  linkedinImageUrl: string | null
  socialLinksJson: string | null
  owner: string | null
  lastChecked: string | null
  evidence: string | null
  score: number
  leadScore: number
  firstName: string | null
  url: HomeProspectUrl | null
}
