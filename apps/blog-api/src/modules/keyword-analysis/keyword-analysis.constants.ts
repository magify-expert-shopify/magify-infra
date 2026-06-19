export const KEYWORD_ANALYSIS_FALLBACK_INTENT = 'INFORMATIONAL';

export const KEYWORD_ANALYSIS_ALLOWED_INTENTS = [
  'INFORMATIONAL',
  'COMMERCIAL',
  'TRANSACTIONAL',
  'NAVIGATIONAL',
] as const;

export const KEYWORD_ANALYSIS_MINI_SCAN_OPENAI_INPUT = [
  "Tu es un expert SEO francophone.",
  "Complète très brièvement la phrase en t'appuyant sur le mot-clé, l'intention et la SERP.",
  'Réponds uniquement avec un JSON valide sous la forme {"pageIntent":"..."}.',
  'Pas de markdown, pas de texte hors JSON.',
  '',
  "Phrase à compléter :",
  "Page qui répond à/aux l'intention/s de recherche :",
  '',
  'Contexte :',
  'Mot-clé: {{keyword}}',
  'Volume: {{volume}}',
  'Difficulté: {{difficulty}}',
  'Intention: {{intent}}',
  'SERP: {{serp_results}}',
  '',
  'Contraintes :',
  '- Réponse très courte et actionnable.',
  "- Ne répète pas toute la phrase de départ.",
  '- Réponds uniquement avec la suite après les deux-points.',
].join('\n');
