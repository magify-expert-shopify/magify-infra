export type ProspectWorkflowStep = {
  currentStatus: string
  nextStatus: string | null
  actionLabel: string
  title: string
  description: string
}

const WORKFLOW_STEPS: ProspectWorkflowStep[] = [
  {
    currentStatus: 'Prospect froid',
    nextStatus: 'Prospect informations manquantes',
    actionLabel: 'Compléter les informations',
    title: 'Qualification initiale',
    description: 'Des informations essentielles manquent encore avant de lancer la prise de contact.',
  },
  {
    currentStatus: 'Prospect informations manquantes',
    nextStatus: 'Prospect contacté',
    actionLabel: 'Marquer comme contacté',
    title: 'Premier contact',
    description: 'On lance la prise de contact initiale pour ouvrir la conversation.',
  },
  {
    currentStatus: 'Prospect contacté',
    nextStatus: 'Prospect en attente réponse',
    actionLabel: 'Passer en attente de réponse',
    title: 'Suivi du premier échange',
    description: 'On note que le message est parti et qu’on attend le retour.',
  },
  {
    currentStatus: 'Prospect en attente réponse',
    nextStatus: 'Prospect en discussion',
    actionLabel: 'Passer en discussion',
    title: 'Relance et échange',
    description: 'Le prospect a répondu, la discussion est ouverte.',
  },
  {
    currentStatus: 'Prospect en discussion',
    nextStatus: 'Prospect qualifié (opportunité)',
    actionLabel: 'Qualifier l’opportunité',
    title: 'Qualification',
    description: 'Le besoin est confirmé et l’opportunité devient sérieuse.',
  },
  {
    currentStatus: 'Prospect qualifié (opportunité)',
    nextStatus: 'Offre envoyée',
    actionLabel: 'Envoyer l’offre',
    title: 'Passage à l’offre',
    description: 'Le prospect est prêt à recevoir une proposition formelle.',
  },
  {
    currentStatus: 'Prospect non qualifié',
    nextStatus: 'Prospect qualifié (opportunité)',
    actionLabel: 'Requalifier',
    title: 'Requalification',
    description: 'Le prospect peut être réévalué si de nouvelles informations rendent l’opportunité pertinente.',
  },
  {
    currentStatus: 'Offre envoyée',
    nextStatus: 'Relance en cours',
    actionLabel: 'Lancer une relance',
    title: 'Suivi de proposition',
    description: 'L’offre est envoyée, on prépare le rappel suivant.',
  },
  {
    currentStatus: 'Relance en cours',
    nextStatus: 'Client',
    actionLabel: 'Marquer client',
    title: 'Conclusion',
    description: 'Le prospect a confirmé et devient client.',
  },
  {
    currentStatus: 'Client',
    nextStatus: null,
    actionLabel: 'Client acquis',
    title: 'Client',
    description: 'Le prospect est déjà devenu client.',
  },
  {
    currentStatus: 'Perdu',
    nextStatus: null,
    actionLabel: 'Prospect perdu',
    title: 'Prospect perdu',
    description: 'Ce prospect n’a pas abouti et ne propose pas d’étape suivante.',
  },
]

export function getProspectWorkflowStep(status: string | null | undefined) {
  return WORKFLOW_STEPS.find((step) => step.currentStatus === status) || WORKFLOW_STEPS[0]
}

export function getNextProspectStatus(status: string | null | undefined) {
  return getProspectWorkflowStep(status).nextStatus
}
