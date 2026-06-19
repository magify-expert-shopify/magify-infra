export type ScanStepKey = 'shopify' | 'cms_detection' | 'language' | 'seo_meta' | 'legal_notice' | 'catalog' | 'contact' | 'linkedin' | 'social' | 'technical' | 'lighthouse';

export type ScanStepSetting = {
  key: ScanStepKey;
  label: string;
  description: string;
  enabled: boolean;
};

export type ScanStepsSettings = {
  steps: ScanStepSetting[];
};

const DEFAULT_SCAN_STEP_SETTINGS: Omit<ScanStepSetting, 'enabled'>[] = [
  {
    key: 'shopify',
    label: 'Détection Shopify',
    description: 'Détecte le CMS, le nom du site et le pays du site.',
  },
  {
    key: 'cms_detection',
    label: 'Détection CMS hors Shopify',
    description: 'Essaie de reconnaître le CMS quand le site n’est pas Shopify.',
  },
  {
    key: 'language',
    label: 'Détection langue du site',
    description: 'Analyse la langue déclarée du site et enregistre le code et le nom de langue.',
  },
  {
    key: 'seo_meta',
    label: 'Vérification balises SEO',
    description: 'Vérifie le title, la meta description, les balises Open Graph, Twitter Cards et les URLs HTTPS.',
  },
  {
    key: 'legal_notice',
    label: 'Vérification mentions légales',
    description: 'Vérifie la page /policies/legal-notice sur les sites Shopify et enregistre si elle existe.',
  },
  {
    key: 'catalog',
    label: 'Catalogue produits',
    description: 'Analyse la collection produits pour compter les articles et estimer le prix médian.',
  },
  {
    key: 'contact',
    label: 'Recherche contact',
    description: 'Cherche l’email, le téléphone et les informations de contact associées au site. Active aussi Shopify si nécessaire.',
  },
  {
    key: 'linkedin',
    label: 'Enrichissement LinkedIn',
    description: 'Tente de retrouver le profil LinkedIn du contact identifié à partir des données trouvées.',
  },
  {
    key: 'social',
    label: 'Enrichissement autres réseaux',
    description: 'Recherche et agrège les autres réseaux sociaux du site dans une seule étape.',
  },
  {
    key: 'technical',
    label: 'Analyse technique Shopify',
    description: 'Récupère le thème Shopify, les détails techniques et les signaux liés à la refonte.',
  },
  {
    key: 'lighthouse',
    label: 'Audit Lighthouse',
    description: 'Lance l’audit de performance, accessibilité, SEO et bonnes pratiques quand le site est éligible.',
  },
];

export const DEFAULT_SCAN_STEPS_SETTINGS: ScanStepsSettings = {
  steps: DEFAULT_SCAN_STEP_SETTINGS.map((step) => ({
    ...step,
    enabled: step.key === 'shopify' || step.key === 'cms_detection' || step.key === 'language' || step.key === 'seo_meta',
  })),
};

const STEP_DEPENDENCIES: Partial<Record<ScanStepKey, ScanStepKey[]>> = {
  legal_notice: ['shopify'],
  contact: ['shopify'],
};

function getDependents(steps: ScanStepSetting[], stepKey: ScanStepKey) {
  return steps.filter((step) => (STEP_DEPENDENCIES[step.key] || []).includes(stepKey));
}

export function normalizeScanStepsSettings(value: Array<Partial<ScanStepSetting>> = []): ScanStepsSettings {
  const defaults = new Map(DEFAULT_SCAN_STEPS_SETTINGS.steps.map((step) => [step.key, step]));
  const byKey = new Map<ScanStepKey, ScanStepSetting>();

  for (const step of value) {
    const key = String(step?.key || '') as ScanStepKey;
    const defaultStep = defaults.get(key);

    if (!defaultStep) {
      continue;
    }

    byKey.set(defaultStep.key, {
      key: defaultStep.key,
      label: defaultStep.label,
      description: defaultStep.description,
      enabled: Boolean(step.enabled ?? defaultStep.enabled),
    });
  }

  for (const defaultStep of DEFAULT_SCAN_STEPS_SETTINGS.steps) {
    if (!byKey.has(defaultStep.key)) {
      byKey.set(defaultStep.key, { ...defaultStep });
    }
  }

  const resolved = DEFAULT_SCAN_STEPS_SETTINGS.steps.map((defaultStep) => byKey.get(defaultStep.key) || { ...defaultStep });
  const normalized = new Map<ScanStepKey, ScanStepSetting>(resolved.map((step) => [step.key, { ...step }]));

  for (const step of normalized.values()) {
    if (!step.enabled) {
      continue;
    }

    const dependencies = STEP_DEPENDENCIES[step.key] || [];
    for (const dependencyKey of dependencies) {
      const dependency = normalized.get(dependencyKey);
      if (dependency) {
        dependency.enabled = true;
      }
    }
  }

  for (const step of normalized.values()) {
    if (step.enabled) {
      continue;
    }

    const dependents = getDependents(Array.from(normalized.values()), step.key);
    for (const dependent of dependents) {
      const dependentStep = normalized.get(dependent.key);
      if (dependentStep) {
        dependentStep.enabled = false;
      }
    }
  }

  return {
    steps: DEFAULT_SCAN_STEPS_SETTINGS.steps.map((defaultStep) => normalized.get(defaultStep.key) || { ...defaultStep }),
  };
}
