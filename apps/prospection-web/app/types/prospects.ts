import type { SiteQualification } from './urls'

export type ApiProspect = {
  id: number
  name: string | null
  siteName: string | null
  sourceUrl: string | null
  sourceFile: string
  status: string
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  avatarUrl: string | null
  linkedinImageUrl: string | null
  socialLinksJson: string | null
  url?: {
    redesignStatus: string | null
    siteCountryCode: string | null
    siteCountryName: string | null
    siteLanguageCode: string | null
    siteLanguageName: string | null
    seoMetaCheckedAt: string | null
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
    qualification?: SiteQualification | null
  } | null
  owner: string | null
  companyName: string | null
  lastChecked: string | null
  evidence: string | null
  score: number
  leadScore: number
  firstName: string | null
  firstContactEmailSentAt: string | null
}

export type ProspectColdListItem = Pick<
  ApiProspect,
  'id' | 'leadScore' | 'name' | 'siteName' | 'sourceUrl' | 'email' | 'phone' | 'avatarUrl' | 'linkedinImageUrl' | 'socialLinksJson'
> & {
  firstContactEmailQueuedAt: string | null
  url: {
    redesignStatus: string | null
  } | null
}

export type ProspectListMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type ProspectListResponse = {
  items: ApiProspect[]
  meta: ProspectListMeta
}

export type ProspectStatusCount = {
  status: string
  total: number
}

export type ProspectCountsResponse = {
  total: number
  counts: ProspectStatusCount[]
}

export type ProspectLite = {
  status: string
}

export type ProspectRelaunchLite = {
  id: number
}

export type ProspectRelaunchItem = {
  id: number
  name: string | null
  siteName: string | null
  sourceUrl: string | null
  email: string | null
  firstContactEmailSentAt: string | null
  firstContactEmailQueuedAt: string | null
  firstContactEmailSubject: string | null
  firstContactEmailBody: string | null
  status: string | null
  urlId: number | null
  url: {
    url: string | null
  } | null
}

export type QueuedProspectEmailItem = {
  prospect: ProspectDetail
  queuedAt: string | null
  jobId: string | null
  state: 'waiting' | 'active' | 'delayed' | 'paused' | 'sent'
  subject: string
}

export type QueuedProspectEmailsResponse = {
  items: QueuedProspectEmailItem[]
  total: number
}

export type ProspectDetailUrl = {
  url: string | null
  siteName: string | null
  siteKey: string | null
  sourceFile: string | null
  createdAt: string | null
  shopifyStatus: string | null
  shopifyCheckedAt: string | null
  httpStatus: number | null
  shopifyThemeId: string | null
  shopifyThemeJson: string | null
  shopifyThemeStoreType: 'free' | 'paid' | 'custom' | null
  redesignStatus: string | null
  redesignDecision: string | null
  cmsName: string | null
  siteCountryCode: string | null
  siteCountryName: string | null
  siteLanguageCode: string | null
  siteLanguageName: string | null
  seoMetaCheckedAt: string | null
  shopifyThemeName: string | null
  shopifyThemeSchemaName: string | null
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
  rescanRequestedAt: string | null
  shopifyLegalNoticeStatus: string | null
  shopifyLegalNoticeUrl: string | null
  shopifyLegalNoticeCheckedAt: string | null
  contactStatus: string | null
  contactCheckedAt: string | null
  trashedAt: string | null
  blacklistedAt: string | null
  qualification: SiteQualification | null
}

export type ProspectDetail = {
  id: number
  urlId: number | null
  name: string | null
  siteName: string | null
  sourceUrl: string | null
  sourceFile: string | null
  status: string | null
  leadScore: number | null
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  linkedinImageUrl: string | null
  avatarUrl: string | null
  owner: string | null
  companyName: string | null
  lastChecked: string | null
  evidence: string | null
  score: number | null
  firstName: string | null
  socialLinksJson: string | null
  contactStatus: string | null
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
  firstContactEmailQueuedAt: string | null
  firstContactEmailSentAt: string | null
  firstContactEmailSubject: string | null
  firstContactEmailBody: string | null
  quoteFileName: string | null
  quoteSentAt: string | null
  contractFileName: string | null
  contractSentAt: string | null
  contractSignedAt: string | null
  magifyTicketId: string | null
  magifyTicketUrl: string | null
  trashedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  url: ProspectDetailUrl | null
}

export type EmailTemplateKey = 'current' | 'blank' | 'diagnostic' | 'refonte' | 'migration' | 'support' | 'support-simple' | 'support-ticket' | 'support-en' | 'creation' | 'optimisation'

export type EmailTemplate = {
  key: EmailTemplateKey
  label: string
  subject: string
  body: string
}

export type ProspectEmailComposerResponse = {
  prospect: {
    id: number
    name: string | null
    siteName: string | null
    sourceUrl: string | null
    email: string | null
    phone: string | null
    linkedinUrl: string | null
    owner: string | null
    firstName: string | null
    leadScore: number | null
    firstContactEmailQueuedAt: string | null
    firstContactEmailSentAt: string | null
    url: {
      url: string | null
      shopifyStatus: string | null
      redesignStatus: string | null
      redesignDecision: string | null
      shopifyThemeName: string | null
      shopifyThemeSchemaName: string | null
      shopifyThemeStoreType: 'free' | 'paid' | 'custom' | null
      cmsName: string | null
      siteLanguageCode: string | null
      siteLanguageName: string | null
      lighthouseObservationsJson: string | null
      qualification: SiteQualification | null
    } | null
  }
  draft: {
    subject: string
    body: string
    templateKey: EmailTemplateKey
  }
  templates: EmailTemplate[]
}
