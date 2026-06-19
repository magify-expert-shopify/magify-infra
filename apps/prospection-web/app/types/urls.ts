export type SiteObservationSeverity = 'info' | 'warning' | 'critical'

export type SiteQualificationChecklist = {
  legalNotice: boolean
  legalNoticeStatus: 'missing' | 'invalid' | 'valid' | null
  dawnTheme: boolean
  dawnThemeStatus: 'valid' | 'invalid' | null
  visualAnomaly: boolean
  visualAnomalyStatus: 'valid' | 'invalid' | null
  collectionVisualAnomaly: boolean
  collectionVisualAnomalyStatus: 'valid' | 'invalid' | null
  productVisualAnomaly: boolean
  productVisualAnomalyStatus: 'valid' | 'invalid' | null
  aboutVisualAnomaly: boolean
  aboutVisualAnomalyStatus: 'valid' | 'invalid' | null
  translated: boolean
  translatedStatus: 'valid' | 'invalid' | null
}

export type SiteQualificationPositioning =
  | 'support-with-error'
  | 'support-without-observation'
  | 'refonte'
  | 'migration'
  | 'optimisation'
  | 'abandon'

export type SiteObservation = {
  key: string
  title: string
  detail: string
  severity: SiteObservationSeverity
  isMain: boolean
  source?: 'manual' | 'automatic'
}

export type SiteQualification = {
  positioning: SiteQualificationPositioning | null
  abandonReason: string | null
  mainObservationKey: string | null
  mainObservation: SiteObservation | null
  observations: SiteObservation[]
  verificationChecklist: SiteQualificationChecklist
}

export type ObservationTitleSuggestion = {
  title: string
  siteCount: number
  exampleDetail: string | null
}

export type UrlDetail = {
  id: number
  url: string
  sourceFile: string
  createdAt: string
  shopifyStatus: string
  siteKey: string | null
  siteCountryCode: string | null
  siteCountryName: string | null
  siteLanguageCode: string | null
  siteLanguageName: string | null
  seoMetaCheckedAt: string | null
  shopifyCheckedAt: string | null
  httpStatus: number | null
  cmsName: string | null
  shopifyThemeName: string | null
  shopifyThemeId: string | null
  shopifyThemeSchemaName: string | null
  shopifyThemeJson: string | null
  shopifyThemeStoreType: 'free' | 'paid' | 'custom' | null
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
  productCount: number | null
  medianProductPrice: number | null
  catalogCheckedAt: string | null
  giftCardDetected: boolean
  lighthouseCheckedAt: string | null
  lighthouseScore: number | null
  lighthousePerformanceScore: number | null
  lighthouseAccessibilityScore: number | null
  lighthouseBestPracticesScore: number | null
  lighthouseSeoScore: number | null
  lighthouseObservationsJson: string | null
  lighthouseReportJson: string | null
  shopifyLegalNoticeStatus: string | null
  shopifyLegalNoticeUrl: string | null
  shopifyLegalNoticeCheckedAt: string | null
  qualification: SiteQualification | null
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
  contactCompanyAddress: string | null
  contactCompanyAddressExtra: string | null
  contactCompanyPostalCode: string | null
  contactCompanyCity: string | null
  contactCompanyLegalForm: string | null
  contactCompanyCountry: string | null
  contactSourceUrl: string | null
  contactEvidence: string | null
  contactLinkedinUrl: string | null
  contactCompanyLinkedinUrl: string | null
  contactSocialLinksJson: string | null
  blacklistedAt: string | null
}

export type UrlRow = {
  id: number
  url: string
  sourceFile: string
  createdAt: string
  shopifyStatus: string
  cmsName: string | null
  siteKey: string | null
  siteCountryCode: string | null
  siteCountryName: string | null
  siteLanguageCode: string | null
  siteLanguageName: string | null
  seoMetaCheckedAt: string | null
  httpStatus: number | null
  redesignStatus: string | null
  siteName: string | null
  shopifyThemeStoreType: 'free' | 'paid' | 'custom' | null
  contactStatus: string
  contactEvidence: string | null
  shopifyLegalNoticeStatus: string | null
  shopifyLegalNoticeUrl: string | null
  shopifyLegalNoticeCheckedAt?: string | null
  blacklistedAt?: string | null
  scanShopifyMs?: number | null
  scanCmsDetectionMs?: number | null
  scanLanguageMs?: number | null
  scanSeoMetaMs?: number | null
  scanLegalNoticeMs?: number | null
  scanCatalogMs?: number | null
  scanContactMs?: number | null
  scanLinkedinMs?: number | null
  scanSocialMs?: number | null
  scanTechnicalMs?: number | null
  scanLighthouseMs?: number | null
  scanWorkflowTotalMs?: number | null
}

export type LighthouseObservation = {
  category: 'performance' | 'accessibility' | 'best-practices' | 'seo'
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
  evidence?: string | null
}

export type LighthouseMetric = {
  label: string
  value: number | null
}

export type ContactLink = {
  url: string
  icon: string
  label: string
}
