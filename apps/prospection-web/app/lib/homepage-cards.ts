export type HomeCardKey =
  | 'imports-in-progress'
  | 'prospects-to-relaunch'
  | 'cold-prospects'
  | 'queued-emails'
  | 'search-prospects'
  | 'add-prospect'
  | 'add-prospects'

export type HomeCardDefinition = {
  key: HomeCardKey
  eyebrow: string
  title: string
  description: string
  ctaLabel: string
  icon: string
  to: string
  badgeTone?: 'rose' | 'slate'
}

export type HomeCardSetting = {
  key: HomeCardKey
  position: number
  visible: boolean
}

export const HOME_CARD_DEFINITIONS: HomeCardDefinition[] = [
  {
    key: 'imports-in-progress',
    eyebrow: 'Imports',
    title: 'Imports en cours',
    description: 'Surveille les imports actifs et leur avancement en arrière-plan.',
    ctaLabel: 'Voir le suivi',
    icon: 'i-lucide-loader-circle',
    to: '/imports',
    badgeTone: 'rose',
  },
  {
    key: 'prospects-to-relaunch',
    eyebrow: 'Prospect',
    title: 'Prospects à relancer',
    description: 'Retrouve les prospects dont le dernier email date de plus d’une semaine.',
    ctaLabel: 'Voir les relances',
    icon: 'i-lucide-repeat-2',
    to: '/prospects-a-relancer',
    badgeTone: 'rose',
  },
  {
    key: 'cold-prospects',
    eyebrow: 'Prospect froid',
    title: 'A contacter',
    description: 'Les prospects froids sont prêts à être traités.',
    ctaLabel: 'Voir les prospects froids',
    icon: 'i-lucide-message-circle',
    to: '/prospects-status/prospect-froid',
    badgeTone: 'rose',
  },
  {
    key: 'queued-emails',
    eyebrow: 'Email',
    title: 'Emails planifiés',
    description: 'Consulte les mails déjà mis en file et retire-en si nécessaire.',
    ctaLabel: 'Voir la file',
    icon: 'i-lucide-inbox',
    to: '/prospects/emails-planifies',
    badgeTone: 'rose',
  },
  {
    key: 'search-prospects',
    eyebrow: 'Prospect',
    title: 'Rechercher un prospect',
    description: 'Ouvre la vue des prospects pour retrouver, filtrer et poursuivre un contact.',
    ctaLabel: 'Ouvrir la recherche',
    icon: 'i-lucide-search',
    to: '/search-prospects',
    badgeTone: 'slate',
  },
  {
    key: 'add-prospect',
    eyebrow: 'Prospect',
    title: 'Ajouter un prospect',
    description: 'Colle une URL pour créer directement un prospect et lancer l’enrichissement.',
    ctaLabel: 'Ouvrir l’ajout',
    icon: 'i-lucide-plus-circle',
    to: '/add-prospect',
    badgeTone: 'slate',
  },
  {
    key: 'add-prospects',
    eyebrow: 'Prospect',
    title: 'Ajouter plusieurs prospects',
    description: 'Colle ou dépose un lot d’URLs pour créer plusieurs prospects en une fois.',
    ctaLabel: 'Ouvrir l’import groupé',
    icon: 'i-lucide-files',
    to: '/add-prospects',
    badgeTone: 'slate',
  },
]

export const DEFAULT_HOME_CARD_SETTINGS: HomeCardSetting[] = HOME_CARD_DEFINITIONS.map((card, index) => ({
  key: card.key,
  position: index,
  visible: true,
}))
