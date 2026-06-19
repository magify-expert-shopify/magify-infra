import type { HomeCardSetting } from '~/lib/homepage-cards'
import type { EmailTemplate } from '~/types/prospects'

export type BadgeTone = 'rose' | 'slate'

export type HomepageCardsResponse = {
  blocks: HomeCardSetting[]
}

export type EmailTemplatesResponse = {
  templates: EmailTemplate[]
}

export type SiteLinksResponse = {
  supportUrl: string
  creationUrl: string
  refonteUrl: string
  migrationUrl: string
  optimizationUrl: string
  diagnosticUrl: string
}

export type EmailSendingSettingsResponse = {
  paused: boolean
  sendAtHour: number
  sendUntilHour: number
  dailyLimit: number
}

export type DiscordReminderSettingsResponse = {
  sendAtTime: string
}

export type EmailSignatureSettingsResponse = {
  html: string
}

export type LeadScoreSettingsResponse = {
  shopify: {
    shopify: number
    cms: number
    other: number
  }
  siren: {
    found: number
    missing: number
  }
  theme: {
    dawn: number
    other: number
    custom: number
  }
  language: {
    french: number
    english: number
    other: number
  }
  companyCountry: {
    france: number
    missing: number
    other: number
  }
  legalNotice: {
    missing: number
    found: number
  }
  catalog: {
    productCount: {
      thresholds: {
        high: number
        medium: number
      }
      points: {
        high: number
        medium: number
        low: number
        none: number
      }
    }
    medianProductPrice: {
      thresholds: {
        high: number
        medium: number
        low: number
      }
      points: {
        high: number
        medium: number
        low: number
        none: number
      }
    }
  }
  lighthouse: {
    thresholds: {
      excellent: number
      good: number
      average: number
      poor: number
    }
    points: {
      excellent: number
      good: number
      average: number
      poor: number
      critical: number
    }
  }
}

export type ScanStepsSettingsResponse = {
  steps: {
    key: 'shopify' | 'cms_detection' | 'language' | 'seo_meta' | 'legal_notice' | 'catalog' | 'contact' | 'linkedin' | 'social' | 'technical' | 'lighthouse'
    label: string
    description: string
    enabled: boolean
  }[]
}

export type ScanTimeoutSettingsResponse = {
  timeoutMs: number
}

export type ProspectRelaunchSettingsResponse = {
  afterDays: number
}

export type LeadScoreRecalcStatusResponse = {
  id: number
  status: string
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
}

export type ProspectStatusRecalcStatusResponse = {
  id: number
  status: string
  totalProspects: number
  processedProspects: number
  runningProspects: number
  pendingProspects: number
  queuedAt: string | null
  startedAt: string | null
  finishedAt: string | null
  lastError: string | null
  currentProspectId: number | null
  updatedAt: string | null
}

export type HomepageImportLite = {
  id: number
  status: string
  queuedUrls: number
  processedUrls: number
  sourceFile: string
}

export type HomepageCardBlock = HomeCardSetting & {
  eyebrow: string
  title: string
  description: string
  ctaLabel: string
  icon: string
  to: string
  badgeTone?: BadgeTone
}
