export type StatsMetricKey = 'emailsSent' | 'contactsFound' | 'shopifyDetected' | 'urlsImported'
export type StatsDurationMetricKey =
  | 'shopify'
  | 'cmsDetection'
  | 'language'
  | 'seoMeta'
  | 'legalNotice'
  | 'catalog'
  | 'contact'
  | 'linkedin'
  | 'social'
  | 'technical'
  | 'lighthouse'
  | 'workflowTotal'

export type StatsSeriesPoint = {
  date: string
  label: string
  value: number
  isBusinessDay?: boolean
}

export type StatsMetricSeries = {
  key: StatsMetricKey
  label: string
  description: string
  total: number
  points: StatsSeriesPoint[]
}

export type StatsDurationSeries = {
  key: StatsDurationMetricKey
  label: string
  description: string
  average: number
  points: StatsSeriesPoint[]
}

export type StatsKpi = {
  key: string
  label: string
  value: number
  numerator: number
  denominator: number
  helper: string
  format: 'percent' | 'number' | 'score'
}

export type StatsDashboardResponse = {
  period: {
    range: 'week' | 'month' | 'quarter' | 'year' | 'all'
    label: string
    days: number
    from: string
    to: string
  }
  charts: StatsMetricSeries[]
  durationCharts: StatsDurationSeries[]
  kpis: StatsKpi[]
}
