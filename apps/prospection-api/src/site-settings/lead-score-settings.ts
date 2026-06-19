export type LeadScoreShopifySettings = {
  shopify: number;
  cms: number;
  other: number;
};

export type LeadScoreThemeSettings = {
  dawn: number;
  other: number;
  custom: number;
};

export type LeadScoreLanguageSettings = {
  french: number;
  english: number;
  other: number;
};

export type LeadScoreCompanyCountrySettings = {
  france: number;
  missing: number;
  other: number;
};

export type LeadScoreSirenSettings = {
  found: number;
  missing: number;
};

export type LeadScoreLegalNoticeSettings = {
  missing: number;
  found: number;
};

export type LeadScoreCatalogSettings = {
  productCount: {
    thresholds: {
      high: number;
      medium: number;
    };
    points: {
      high: number;
      medium: number;
      low: number;
      none: number;
    };
  };
  medianProductPrice: {
    thresholds: {
      high: number;
      medium: number;
      low: number;
    };
    points: {
      high: number;
      medium: number;
      low: number;
      none: number;
    };
  };
};

export type LeadScoreLighthouseThresholds = {
  excellent: number;
  good: number;
  average: number;
  poor: number;
};

export type LeadScoreLighthousePoints = {
  excellent: number;
  good: number;
  average: number;
  poor: number;
  critical: number;
};

export type LeadScoreSettings = {
  shopify: LeadScoreShopifySettings;
  siren: LeadScoreSirenSettings;
  theme: LeadScoreThemeSettings;
  language: LeadScoreLanguageSettings;
  companyCountry: LeadScoreCompanyCountrySettings;
  legalNotice: LeadScoreLegalNoticeSettings;
  catalog: LeadScoreCatalogSettings;
  lighthouse: {
    thresholds: LeadScoreLighthouseThresholds;
    points: LeadScoreLighthousePoints;
  };
};

export const DEFAULT_LEAD_SCORE_SETTINGS: LeadScoreSettings = {
  shopify: {
    shopify: 2,
    cms: 1,
    other: 0,
  },
  siren: {
    found: 5,
    missing: 0,
  },
  theme: {
    dawn: 2,
    other: 1,
    custom: 0,
  },
  language: {
    french: 8,
    english: 2,
    other: 0,
  },
  companyCountry: {
    france: 8,
    missing: 6,
    other: 0,
  },
  legalNotice: {
    missing: 2,
    found: 0,
  },
  catalog: {
    productCount: {
      thresholds: {
        high: 100,
        medium: 30,
      },
      points: {
        high: 3,
        medium: 2,
        low: 1,
        none: 0,
      },
    },
    medianProductPrice: {
      thresholds: {
        high: 150,
        medium: 80,
        low: 30,
      },
      points: {
        high: 3,
        medium: 2,
        low: 1,
        none: 0,
      },
    },
  },
  lighthouse: {
    thresholds: {
      excellent: 85,
      good: 70,
      average: 55,
      poor: 40,
    },
    points: {
      excellent: 0,
      good: 1,
      average: 2,
      poor: 3,
      critical: 4,
    },
  },
};

function normalizeInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.round(parsed));
}

export function normalizeLeadScoreSettings(value: Partial<LeadScoreSettings> = {}): LeadScoreSettings {
  return {
    shopify: {
      shopify: normalizeInteger(value.shopify?.shopify, DEFAULT_LEAD_SCORE_SETTINGS.shopify.shopify),
      cms: normalizeInteger(value.shopify?.cms, DEFAULT_LEAD_SCORE_SETTINGS.shopify.cms),
      other: normalizeInteger(value.shopify?.other, DEFAULT_LEAD_SCORE_SETTINGS.shopify.other),
    },
    siren: {
      found: normalizeInteger(value.siren?.found, DEFAULT_LEAD_SCORE_SETTINGS.siren.found),
      missing: normalizeInteger(value.siren?.missing, DEFAULT_LEAD_SCORE_SETTINGS.siren.missing),
    },
    theme: {
      dawn: normalizeInteger(value.theme?.dawn, DEFAULT_LEAD_SCORE_SETTINGS.theme.dawn),
      other: normalizeInteger(value.theme?.other, DEFAULT_LEAD_SCORE_SETTINGS.theme.other),
      custom: normalizeInteger(value.theme?.custom, DEFAULT_LEAD_SCORE_SETTINGS.theme.custom),
    },
    language: {
      french: normalizeInteger(value.language?.french, DEFAULT_LEAD_SCORE_SETTINGS.language.french),
      english: normalizeInteger(value.language?.english, DEFAULT_LEAD_SCORE_SETTINGS.language.english),
      other: normalizeInteger(value.language?.other, DEFAULT_LEAD_SCORE_SETTINGS.language.other),
    },
    companyCountry: {
      france: normalizeInteger(
        value.companyCountry?.france,
        DEFAULT_LEAD_SCORE_SETTINGS.companyCountry.france,
      ),
      missing: normalizeInteger(
        value.companyCountry?.missing,
        DEFAULT_LEAD_SCORE_SETTINGS.companyCountry.missing,
      ),
      other: normalizeInteger(
        value.companyCountry?.other,
        DEFAULT_LEAD_SCORE_SETTINGS.companyCountry.other,
      ),
    },
    legalNotice: {
      missing: normalizeInteger(value.legalNotice?.missing, DEFAULT_LEAD_SCORE_SETTINGS.legalNotice.missing),
      found: normalizeInteger(value.legalNotice?.found, DEFAULT_LEAD_SCORE_SETTINGS.legalNotice.found),
    },
    catalog: {
      productCount: {
        thresholds: {
          high: normalizeInteger(
            value.catalog?.productCount?.thresholds?.high,
            DEFAULT_LEAD_SCORE_SETTINGS.catalog.productCount.thresholds.high,
          ),
          medium: normalizeInteger(
            value.catalog?.productCount?.thresholds?.medium,
            DEFAULT_LEAD_SCORE_SETTINGS.catalog.productCount.thresholds.medium,
          ),
        },
        points: {
          high: normalizeInteger(
            value.catalog?.productCount?.points?.high,
            DEFAULT_LEAD_SCORE_SETTINGS.catalog.productCount.points.high,
          ),
          medium: normalizeInteger(
            value.catalog?.productCount?.points?.medium,
            DEFAULT_LEAD_SCORE_SETTINGS.catalog.productCount.points.medium,
          ),
          low: normalizeInteger(
            value.catalog?.productCount?.points?.low,
            DEFAULT_LEAD_SCORE_SETTINGS.catalog.productCount.points.low,
          ),
          none: normalizeInteger(
            value.catalog?.productCount?.points?.none,
            DEFAULT_LEAD_SCORE_SETTINGS.catalog.productCount.points.none,
          ),
        },
      },
      medianProductPrice: {
        thresholds: {
          high: normalizeInteger(
            value.catalog?.medianProductPrice?.thresholds?.high,
            DEFAULT_LEAD_SCORE_SETTINGS.catalog.medianProductPrice.thresholds.high,
          ),
          medium: normalizeInteger(
            value.catalog?.medianProductPrice?.thresholds?.medium,
            DEFAULT_LEAD_SCORE_SETTINGS.catalog.medianProductPrice.thresholds.medium,
          ),
          low: normalizeInteger(
            value.catalog?.medianProductPrice?.thresholds?.low,
            DEFAULT_LEAD_SCORE_SETTINGS.catalog.medianProductPrice.thresholds.low,
          ),
        },
        points: {
          high: normalizeInteger(
            value.catalog?.medianProductPrice?.points?.high,
            DEFAULT_LEAD_SCORE_SETTINGS.catalog.medianProductPrice.points.high,
          ),
          medium: normalizeInteger(
            value.catalog?.medianProductPrice?.points?.medium,
            DEFAULT_LEAD_SCORE_SETTINGS.catalog.medianProductPrice.points.medium,
          ),
          low: normalizeInteger(
            value.catalog?.medianProductPrice?.points?.low,
            DEFAULT_LEAD_SCORE_SETTINGS.catalog.medianProductPrice.points.low,
          ),
          none: normalizeInteger(
            value.catalog?.medianProductPrice?.points?.none,
            DEFAULT_LEAD_SCORE_SETTINGS.catalog.medianProductPrice.points.none,
          ),
        },
      },
    },
    lighthouse: {
      thresholds: {
        excellent: normalizeInteger(
          value.lighthouse?.thresholds?.excellent,
          DEFAULT_LEAD_SCORE_SETTINGS.lighthouse.thresholds.excellent,
        ),
        good: normalizeInteger(
          value.lighthouse?.thresholds?.good,
          DEFAULT_LEAD_SCORE_SETTINGS.lighthouse.thresholds.good,
        ),
        average: normalizeInteger(
          value.lighthouse?.thresholds?.average,
          DEFAULT_LEAD_SCORE_SETTINGS.lighthouse.thresholds.average,
        ),
        poor: normalizeInteger(
          value.lighthouse?.thresholds?.poor,
          DEFAULT_LEAD_SCORE_SETTINGS.lighthouse.thresholds.poor,
        ),
      },
      points: {
        excellent: normalizeInteger(
          value.lighthouse?.points?.excellent,
          DEFAULT_LEAD_SCORE_SETTINGS.lighthouse.points.excellent,
        ),
        good: normalizeInteger(
          value.lighthouse?.points?.good,
          DEFAULT_LEAD_SCORE_SETTINGS.lighthouse.points.good,
        ),
        average: normalizeInteger(
          value.lighthouse?.points?.average,
          DEFAULT_LEAD_SCORE_SETTINGS.lighthouse.points.average,
        ),
        poor: normalizeInteger(
          value.lighthouse?.points?.poor,
          DEFAULT_LEAD_SCORE_SETTINGS.lighthouse.points.poor,
        ),
        critical: normalizeInteger(
          value.lighthouse?.points?.critical,
          DEFAULT_LEAD_SCORE_SETTINGS.lighthouse.points.critical,
        ),
      },
    },
  };
}
