export type ProspectStatusConfig = {
  status: string
  slug: string
  label: string
  tone: string
  icon: string
  rule: string
}

export const PROSPECT_STATUS_CONFIG: ProspectStatusConfig[] = [
  {
    status: 'Prospect froid',
    slug: 'prospect-froid',
    label: 'A contacter',
    tone: 'bg-sky-50 text-sky-700 ring-sky-200',
    icon: 'i-lucide-message-circle',
    rule: 'Prospect identifié mais non contacté. Il attend une première prise de contact.',
  },
  {
    status: 'Prospect informations manquantes',
    slug: 'prospect-infos-manquantes',
    label: 'Infos manquantes',
    tone: 'bg-amber-50 text-amber-800 ring-amber-200',
    icon: 'i-lucide-file-search',
    rule: 'Le site a été détecté, mais il manque des informations clés comme l’email.',
  },
  {
    status: 'Prospect contacté',
    slug: 'prospect-contacte',
    label: 'A relancer',
    tone: 'bg-amber-50 text-amber-700 ring-amber-200',
    icon: 'i-lucide-repeat-2',
    rule: 'Un email a déjà été envoyé et la relance n’est prise en compte qu’après 7 jours.',
  },
  {
    status: 'Prospect en attente réponse',
    slug: 'prospect-en-attente-reponse',
    label: 'En attente',
    tone: 'bg-slate-50 text-slate-700 ring-slate-200',
    icon: 'i-lucide-hourglass',
    rule: 'Le message est parti et on attend une réponse avant de continuer.',
  },
  {
    status: 'Prospect en discussion',
    slug: 'prospect-en-discussion',
    label: 'En discussion',
    tone: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
    icon: 'i-lucide-message-square-more',
    rule: 'Le prospect a répondu et l’échange commercial est ouvert.',
  },
  {
    status: 'Prospect qualifié (opportunité)',
    slug: 'prospect-qualifie',
    label: "A envoyer l'offre",
    tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    icon: 'i-lucide-send',
    rule: 'Le besoin est confirmé et l’opportunité est suffisamment qualifiée pour une offre.',
  },
  {
    status: 'Prospect non qualifié',
    slug: 'prospect-non-qualifie',
    label: 'A requalifier',
    tone: 'bg-rose-50 text-rose-700 ring-rose-200',
    icon: 'i-lucide-user-x',
    rule: 'Le prospect n’est pas prioritaire à ce stade, mais peut être requalifié plus tard.',
  },
  {
    status: 'Offre envoyée',
    slug: 'offre-envoyee',
    label: 'Offres en attente',
    tone: 'bg-violet-50 text-violet-700 ring-violet-200',
    icon: 'i-lucide-file-text',
    rule: 'Une proposition a été envoyée et on suit l’avancement du devis.',
  },
  {
    status: 'Relance en cours',
    slug: 'relance-en-cours',
    label: 'Relances actives',
    tone: 'bg-orange-50 text-orange-700 ring-orange-200',
    icon: 'i-lucide-bell-ring',
    rule: 'Le devis est en cours de relance pour pousser la décision finale.',
  },
  {
    status: 'Client',
    slug: 'client',
    label: 'Clients',
    tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    icon: 'i-lucide-badge-check',
    rule: 'Le prospect a signé ou confirmé la collaboration.',
  },
  {
    status: 'Perdu',
    slug: 'perdu',
    label: 'Perdus',
    tone: 'bg-rose-50 text-rose-700 ring-rose-200',
    icon: 'i-lucide-x-circle',
    rule: 'L’opportunité n’a pas abouti ou a été abandonnée.',
  },
]

export function getProspectStatusConfigByStatus(status: string) {
  return PROSPECT_STATUS_CONFIG.find((item) => item.status === status)
}

export function getProspectStatusConfigBySlug(slug: string) {
  return PROSPECT_STATUS_CONFIG.find((item) => item.slug === slug)
}
