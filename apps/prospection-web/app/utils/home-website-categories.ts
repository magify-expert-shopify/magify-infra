export type WebsiteCategoryKey = 'all' | 'support' | 'refonte' | 'migration'

export type WebsiteCategoryConfig = {
  key: Exclude<WebsiteCategoryKey, 'all'>
  label: string
  cardAccent: string
  cardAccentBar: string
  filterTone: string
  filterBadge: string
  icon: string
}

export const WEBSITE_CATEGORY_CONFIG: WebsiteCategoryConfig[] = [
  {
    key: 'support',
    label: 'Support',
    cardAccent: 'border-slate-200 bg-slate-50/80',
    cardAccentBar: 'bg-slate-400',
    filterTone: 'bg-slate-100 text-slate-700 ring-slate-200',
    filterBadge: 'bg-slate-200 text-slate-600',
    icon: 'i-lucide-shield-check',
  },
  {
    key: 'refonte',
    label: 'Refonte',
    cardAccent: 'border-amber-200 bg-amber-50/60',
    cardAccentBar: 'bg-amber-500',
    filterTone: 'bg-amber-100 text-amber-800 ring-amber-200',
    filterBadge: 'bg-amber-200 text-amber-700',
    icon: 'i-lucide-refresh-cw',
  },
  {
    key: 'migration',
    label: 'Migration',
    cardAccent: 'border-sky-200 bg-sky-50/60',
    cardAccentBar: 'bg-sky-500',
    filterTone: 'bg-sky-100 text-sky-800 ring-sky-200',
    filterBadge: 'bg-sky-200 text-sky-700',
    icon: 'i-lucide-arrow-right-left',
  },
]

export const WEBSITE_ALL_FILTER = {
  key: 'all' as const,
  label: 'Tous',
  filterTone: 'bg-slate-100 text-slate-700 ring-slate-200',
  filterBadge: 'bg-slate-200 text-slate-600',
  icon: 'i-lucide-layers-3',
}

export function getWebsiteCategoryConfig(key: WebsiteCategoryKey) {
  if (key === 'all') {
    return WEBSITE_ALL_FILTER
  }

  return WEBSITE_CATEGORY_CONFIG.find((item) => item.key === key) || WEBSITE_CATEGORY_CONFIG[0]
}
