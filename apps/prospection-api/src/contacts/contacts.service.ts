import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { ContactResult, cleanUrl } from 'src/urls/urls.service';

async function fetchHtmlWithTimeout(url: string, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'ProspectionMagify/1.0 contact finder',
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    const headersReceivedAt = performance.now();
    const contentType = response.headers.get('content-type') || '';
    let body = '';

    if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
      body = await response.text();
    }
    const finishedAt = performance.now();

    return {
      body,
      headers: response.headers,
      status: response.status,
      metrics: {
        ttfbMs: Math.round(headersReceivedAt - startedAt),
        totalMs: Math.round(finishedAt - startedAt),
        htmlBytes: Buffer.byteLength(body, 'utf8'),
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'ProspectionMagify/1.0 contact finder',
        accept: 'application/json',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(body: string) {
  return decodeHtmlEntities(
    body
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
}

function uniqueValues(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

type ContactObservation = {
  key: string;
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'critical';
};

const PLACEHOLDER_EMAIL_DOMAINS = new Set([
  'shopify.com',
  'domain.com',
  'email.com',
  'exemple.com',
  'example.com',
]);

const OBSERVABLE_PLACEHOLDER_EMAIL_DOMAINS = new Set([
  'domain.com',
  'email.com',
  'exemple.com',
  'example.com',
]);

function isPlaceholderContactEmail(email: string) {
  const normalized = String(email || '').trim().toLowerCase();
  const atIndex = normalized.lastIndexOf('@');
  if (atIndex < 0) {
    return false;
  }

  const domain = normalized.slice(atIndex + 1).replace(/\.+$/, '');
  return PLACEHOLDER_EMAIL_DOMAINS.has(domain);
}

function buildPlaceholderEmailObservation(pageUrl: string, emails: string[]): ContactObservation | null {
  const uniqueEmails = uniqueValues(
    emails.filter((email) => {
      const normalized = String(email || '').trim().toLowerCase();
      const atIndex = normalized.lastIndexOf('@');
      if (atIndex < 0) {
        return false;
      }

      const domain = normalized.slice(atIndex + 1).replace(/\.+$/, '');
      return OBSERVABLE_PLACEHOLDER_EMAIL_DOMAINS.has(domain);
    }),
  );
  if (uniqueEmails.length === 0) {
    return null;
  }

  return {
    key: 'contact-placeholder-email',
    title: 'Adresse email factice détectée',
    detail: `Une adresse email factice a été trouvée sur la page ${pageUrl} : ${uniqueEmails.join(', ')}. Cette adresse ne doit pas être utilisée pour la fiche contact du prospect.`,
    severity: 'warning',
  };
}

function normalizePhone(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function cleanupContactValue(value: string) {
  return value
    .replace(/\s+https?\b.*$/i, '')
    .replace(/\s+https?:\/\/.*$/i, '')
    .replace(/\s+(Adresse|Telephone|Email|Mail|SIRET|SIREN|TVA)\b.*$/i, '')
    .replace(/[.;,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstPatternValue(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return cleanupContactValue(match[1]);
    }
  }

  return null;
}

function getProjectedValue(source: Record<string, unknown>, path: string[]) {
  let current: unknown = source;

  for (const segment of path) {
    if (current == null || typeof current !== 'object' || !(segment in current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function firstRecordStringValue(source: Record<string, unknown>, paths: string[][]) {
  for (const path of paths) {
    const value = getProjectedValue(source, path);
    if (typeof value === 'string' || typeof value === 'number') {
      const normalized = cleanupContactValue(decodeHtmlEntities(String(value)));
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

function buildCompanyAddress(parts: Array<string | null>) {
  return uniqueValues(parts.filter(Boolean).map((value) => String(value).trim())).join(', ') || null;
}

function splitPersonName(ownerName: string | null) {
  if (!ownerName) {
    return { firstName: null, lastName: null };
  }

  const parts = ownerName.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return { firstName: ownerName, lastName: null };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function extractSirenFromBody(body: string) {
  const text = stripHtml(body).replace(/\s+/g, ' ');

  const sirenMatch = text.match(/\bSIREN\s*:?\s*([0-9][0-9\s]{7,14}[0-9])\b/i);
  if (sirenMatch?.[1]) {
    return normalizeSiren(sirenMatch[1]);
  }

  const siretMatch = text.match(/\bSIRET\s*:?\s*([0-9][0-9\s]{12,20}[0-9])\b/i);
  if (siretMatch?.[1]) {
    return normalizeSiren(siretMatch[1].slice(0, 9));
  }

  // Exemple : 833 337 165 R.C.S. Paris
  const rcsMatch = text.match(/\b([0-9][0-9\s]{7,14}[0-9])\s*R\.?\s*C\.?\s*S\.?\b/i);
  if (rcsMatch?.[1]) {
    return normalizeSiren(rcsMatch[1]);
  }

  return null;
}

function extractLinkedinUrls(body: string) {
  return uniqueValues(
    [...body.matchAll(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|company)\/[^"'<>\s)]+/gi)].map((match) =>
      cleanUrl(match[0]),
    ),
  );
}

function extractSocialUrls(body: string) {
  const candidates = [
    ...body.matchAll(
      /https?:\/\/(?:www\.)?(?:linkedin\.com\/(?:in|company)\/[^"'<>\s)]+|instagram\.com\/[^"'<>\s)]+|facebook\.com\/[^"'<>\s)]+|tiktok\.com\/[^"'<>\s)]+|x\.com\/[^"'<>\s)]+|twitter\.com\/[^"'<>\s)]+|youtube\.com\/[^"'<>\s)]+|pinterest\.com\/[^"'<>\s)]+|threads\.net\/[^"'<>\s)]+|t\.me\/[^"'<>\s)]+|linktr\.ee\/[^"'<>\s)]+|snapchat\.com\/[^"'<>\s)]+|wa\.me\/[^"'<>\s)]+|discord\.gg\/[^"'<>\s)]+)/gi,
    ),
  ].map((match) => cleanUrl(match[0]));

  return uniqueValues(candidates);
}

function extractMetaImageUrl(body: string) {
  const patterns = [
    /<meta\b(?=[^>]*property=["']og:image["'])(?=[^>]*content=["']([^"']+)["'])[^>]*>/i,
    /<meta\b(?=[^>]*property=["']og:image:url["'])(?=[^>]*content=["']([^"']+)["'])[^>]*>/i,
    /<meta\b(?=[^>]*name=["']twitter:image["'])(?=[^>]*content=["']([^"']+)["'])[^>]*>/i,
    /<meta\b(?=[^>]*property=["']twitter:image["'])(?=[^>]*content=["']([^"']+)["'])[^>]*>/i,
    /<meta\b(?=[^>]*property=["']twitter:image:src["'])(?=[^>]*content=["']([^"']+)["'])[^>]*>/i,
    /<meta\b(?=[^>]*name=["']image["'])(?=[^>]*content=["']([^"']+)["'])[^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match?.[1]) {
      return cleanUrl(match[1]);
    }
  }

  return null;
}

function extractSiteAvatarUrl(body: string, pageUrl: string) {
  const normalizedBody = decodeHtmlEntities(body).replace(/\\\//g, '/');
  const metaImage = extractMetaImageUrl(normalizedBody);
  if (metaImage) {
    return metaImage;
  }

  const patterns = [
    /<link\b(?=[^>]*rel=["'](?:shortcut icon|icon|apple-touch-icon|apple-touch-icon-precomposed)["'])(?=[^>]*href=["']([^"']+)["'])[^>]*>/i,
    /<img\b[^>]*(?:data-src|data-lazy-src|src)=["']([^"']+\.(?:png|jpe?g|webp|gif|svg)(?:\?[^"']*)?)["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = normalizedBody.match(pattern);
    if (match?.[1]) {
      try {
        return new URL(match[1], pageUrl).toString();
      } catch {
        return cleanUrl(match[1]);
      }
    }
  }

  return null;
}

function buildGravatarUrl(email: string | null) {
  if (!email) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const hash = createHash('md5').update(normalizedEmail).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=256`;
}

function getLinkedinCompanySlug(linkedinUrl: string | null) {
  if (!linkedinUrl || !linkedinUrl.includes('/company/')) {
    return null;
  }

  try {
    const url = new URL(linkedinUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    const companyIndex = parts.indexOf('company');

    return companyIndex >= 0 ? parts[companyIndex + 1] || null : null;
  } catch {
    return null;
  }
}

function extractContactInfo(body: string, pageUrl: string): Omit<ContactResult, 'status'> {
  const text = stripHtml(body);
  const compactText = text.replace(/\s+/g, ' ');
  const emails = uniqueValues(
    [...body.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((match) => match[0]),
  ).filter((email) => !/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(email));
  const placeholderEmails = emails.filter(isPlaceholderContactEmail);
  const validEmails = emails.filter((email) => !isPlaceholderContactEmail(email));
  const phones = uniqueValues(
    [...compactText.matchAll(/(?:\+33|0033|0)\s*[1-9](?:[\s.-]*\d{2}){4}/g)].map((match) =>
      normalizePhone(match[0]),
    ),
  );
  const siretMatch = compactText.match(/\b(?:SIRET|siret)\s*:?\s*([0-9][0-9\s]{12,20}[0-9])\b/);
  const sirenMatch = compactText.match(/\b(?:SIREN|siren)\s*:?\s*([0-9][0-9\s]{7,14}[0-9])\b/);
  const siret = siretMatch ? siretMatch[1].replace(/\D/g, '').slice(0, 14) : null;
  const siren = sirenMatch ? sirenMatch[1].replace(/\D/g, '').slice(0, 9) : siret ? siret.slice(0, 9) : null;
  const companyPatterns = [
    /(?:Raison sociale|Denomination sociale|Societe|Entreprise|Editeur)\s*:?\s*([A-Z0-9][A-Z0-9 .,'&-]{2,80})/i,
    /(?:exploite par|edite par)\s+([A-Z0-9][A-Z0-9 .,'&-]{2,80})/i,
  ];
  const ownerPatterns = [
    /(?:Directeur de la publication|Responsable de publication|Gerant|President|Representant legal|Proprietaire)\s*:?\s*([A-Z][A-Za-z' -]{2,80})/i,
  ];
  const companyAddress = firstPatternValue(compactText, [
    /\b(?:Adresse(?: du siège social)?|Siège social|Adresse de l'entreprise|Adresse postale)\s*:?\s*([A-Z0-9][A-Z0-9À-ÿ .,'&()\/-]{5,120})/i,
  ]);
  const companyPostalCode = firstPatternValue(compactText, [
    /(?:Code postal|CP)\s*:?\s*([0-9]{5})/i,
  ]);
  const companyCity = firstPatternValue(compactText, [
    /(?:Ville|Commune)\s*:?\s*([A-ZÀ-ÿ][A-Za-zÀ-ÿ' -]{2,80})/i,
  ]);
  const companyLegalForm = firstPatternValue(compactText, [
    /(?:Forme juridique|Statut juridique|Nature juridique|Forme legale)\s*:?\s*([A-Z0-9][A-Z0-9 .,'&()/-]{2,120})/i,
  ]);
  const companyCountry = firstPatternValue(compactText, [
    /(?:Pays)\s*:?\s*([A-ZÀ-ÿ][A-Za-zÀ-ÿ' -]{2,80})/i,
  ]);
  const companyName = firstPatternValue(compactText, companyPatterns);
  const ownerName = firstPatternValue(compactText, ownerPatterns);
  const nameParts = splitPersonName(ownerName);
  const linkedinUrls = extractLinkedinUrls(body);
  const socialLinks = extractSocialUrls(body);
  const companyLinkedinUrl = linkedinUrls.find((url) => url.includes('/company/')) || null;
  const linkedinUrl = linkedinUrls.find((url) => url.includes('/in/')) || null;
  const contactObservation = buildPlaceholderEmailObservation(pageUrl, placeholderEmails);
  const evidence: string[] = [];

  if (validEmails[0]) evidence.push('email');
  if (placeholderEmails.length > 0) evidence.push('placeholder email');
  if (phones[0]) evidence.push('phone');
  if (siret) evidence.push('siret');
  if (siren) evidence.push('siren');
  if (companyName) evidence.push('company');
  if (ownerName) evidence.push('owner');
  if (linkedinUrl) evidence.push('linkedin');
  if (companyLinkedinUrl) evidence.push('company linkedin');
  if (socialLinks.length > 0) evidence.push('social');

  return {
    email: validEmails[0] || null,
    contactEmailWasPlaceholder: placeholderEmails.length > 0 && validEmails.length === 0,
    phone: phones[0] || null,
    siret,
    siren,
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    ownerName,
    companyName,
    companyAddress,
    companyPostalCode,
    companyCity,
    companyLegalForm,
    companyCountry,
    linkedinUrl,
    companyLinkedinUrl,
    avatarUrl: null,
    linkedinImageUrl: null,
    socialLinks,
    sourceUrl: evidence.length > 0 || contactObservation ? pageUrl : null,
    evidence: evidence.join(', ') || null,
    contactObservation,
  };
}

function mergeContactInfo(
  current: Omit<ContactResult, 'status'>,
  next: Omit<ContactResult, 'status'>,
): Omit<ContactResult, 'status'> {
  const currentObservation = current.contactObservation || null;
  const nextObservation = next.contactObservation || null;
  const mergedObservation: ContactObservation | null =
    currentObservation && nextObservation
      ? {
        ...currentObservation,
        detail: uniqueValues([
          ...String(currentObservation.detail || '').split('\n'),
          ...String(nextObservation.detail || '').split('\n'),
        ]).join('\n'),
        severity:
          currentObservation.severity === 'critical' || nextObservation.severity === 'critical'
            ? 'critical'
            : currentObservation.severity === 'warning' || nextObservation.severity === 'warning'
              ? 'warning'
              : 'info',
      }
      : currentObservation || nextObservation;

  return {
    email: current.email || next.email,
    contactEmailWasPlaceholder: current.email || next.email ? false : Boolean(current.contactEmailWasPlaceholder || next.contactEmailWasPlaceholder),
    phone: current.phone || next.phone,
    siret: current.siret || next.siret,
    siren: current.siren || next.siren,
    firstName: current.firstName || next.firstName,
    lastName: current.lastName || next.lastName,
    ownerName: current.ownerName || next.ownerName,
    companyName: current.companyName || next.companyName,
    companyAddress: current.companyAddress || next.companyAddress,
    companyPostalCode: current.companyPostalCode || next.companyPostalCode,
    companyCity: current.companyCity || next.companyCity,
    companyLegalForm: current.companyLegalForm || next.companyLegalForm,
    companyCountry: current.companyCountry || next.companyCountry,
    linkedinUrl: current.linkedinUrl || next.linkedinUrl,
    companyLinkedinUrl: current.companyLinkedinUrl || next.companyLinkedinUrl,
    avatarUrl: current.avatarUrl || next.avatarUrl,
    linkedinImageUrl: current.linkedinImageUrl || next.linkedinImageUrl,
    socialLinks: uniqueValues([...(current.socialLinks || []), ...(next.socialLinks || [])]),
    sourceUrl: current.sourceUrl || next.sourceUrl,
    evidence: uniqueValues([current.evidence, next.evidence].filter(Boolean).join(', ').split(',')).join(', ') || null,
    contactObservation: mergedObservation,
  };
}

function hasContactInfo(contact: Omit<ContactResult, 'status'>) {
  return Boolean(
    contact.email ||
      contact.phone ||
      contact.siret ||
      contact.siren ||
      contact.ownerName ||
      contact.companyName ||
      contact.companyAddress ||
      contact.companyPostalCode ||
      contact.companyCity ||
      contact.companyLegalForm ||
      contact.companyCountry ||
      (contact.socialLinks?.length || 0) > 0,
  );
}

function hasCompleteContactInfo(contact: Omit<ContactResult, 'status'>) {
  return Boolean(
    contact.email &&
      contact.phone &&
      (contact.siret || contact.siren) &&
      (contact.ownerName || contact.firstName || contact.lastName || contact.companyName),
  );
}

function normalizeSiren(value: string | null | undefined) {
  return String(value || '').replace(/\D/g, '').slice(0, 9) || null;
}

function extractFirstDirigeant(raw: Record<string, unknown>) {
  const dirigeants = Array.isArray(raw.dirigeants) ? raw.dirigeants : [];
  const first = dirigeants[0];
  if (!first || typeof first !== 'object') {
    return { firstName: null, lastName: null, ownerName: null };
  }

  const item = first as Record<string, unknown>;
  const lastName = String(item.nom || item.last_name || item.lastname || '').trim() || null;
  const firstName = String(item.prenoms || item.prenom || item.first_name || item.firstname || '').trim() || null;
  const ownerName = [firstName, lastName].filter(Boolean).join(' ').trim() || null;

  return {
    firstName,
    lastName,
    ownerName,
  };
}

function extractEntrepriseApiContact(payload: unknown, siren: string) {
  const raw = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const results = Array.isArray(raw.results)
    ? raw.results
    : Array.isArray(raw.data)
      ? raw.data
      : [];
  const normalizedSiren = normalizeSiren(siren);
  const result = results.find((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const candidate = item as Record<string, unknown>;
    const candidateSiren = normalizeSiren(
      String(candidate.siren || candidate.siret || ''),
    );

    return candidateSiren === normalizedSiren;
  }) || results[0];

  if (!result || typeof result !== 'object') {
    return null;
  }

  const item = result as Record<string, unknown>;
  const companyName = cleanupContactValue(
    String(
      item.nom_raison_sociale ||
        item.nom_complet ||
        item.nom ||
        item.denomination ||
        item.raison_sociale ||
        item.name ||
        '',
    ),
  );
  const sourceUrl = String(item.url || item.website || item.site_web || '').trim() || null;
  const director = extractFirstDirigeant(item);
  const companyAddressFromApi = firstRecordStringValue(item, [
    ['adresse_complete'],
    ['adresse_complete_siege'],
    ['adresse'],
    ['siege', 'adresse_complete'],
    ['siege', 'adresse'],
    ['siege_social', 'adresse_complete'],
    ['siege_social', 'adresse'],
    ['adresse_ligne_1'],
    ['adresse1'],
    ['siege', 'adresse_ligne_1'],
    ['siege_social', 'adresse_ligne_1'],
  ]);
  const companyPostalCode = firstRecordStringValue(item, [
    ['code_postal'],
    ['postal_code'],
    ['cp'],
    ['siege', 'code_postal'],
    ['siege', 'postal_code'],
    ['siege_social', 'code_postal'],
    ['siege_social', 'postal_code'],
  ]);
  const companyCity = firstRecordStringValue(item, [
    ['libelle_commune'],
    ['ville'],
    ['city'],
    ['commune'],
    ['siege', 'libelle_commune'],
    ['siege', 'ville'],
    ['siege', 'city'],
    ['siege_social', 'libelle_commune'],
    ['siege_social', 'ville'],
    ['siege_social', 'city'],
  ]);
  const companyCountry = firstRecordStringValue(item, [
    ['pays'],
    ['country'],
    ['siege', 'pays'],
    ['siege', 'country'],
    ['siege_social', 'pays'],
    ['siege_social', 'country'],
  ]);
  const companyLegalForm = firstRecordStringValue(item, [
    ['forme_juridique'],
    ['libelle_forme_juridique'],
    ['nature_juridique'],
    ['legal_form'],
    ['forme_legale'],
    ['statut_juridique'],
  ]);
  const fallbackAddress = buildCompanyAddress([
    companyAddressFromApi,
    companyPostalCode && companyCity ? `${companyPostalCode} ${companyCity}` : null,
    companyPostalCode && !companyCity ? companyPostalCode : null,
    !companyPostalCode && companyCity ? companyCity : null,
    companyCountry,
  ]);

  return {
    ...emptyContact,
    siret: normalizeSiren(String(item.siret || '')),
    siren: normalizedSiren,
    firstName: director.firstName,
    lastName: director.lastName,
    ownerName: director.ownerName,
    companyName: companyName || null,
    companyAddress: companyAddressFromApi || fallbackAddress,
    companyPostalCode,
    companyCity,
    companyLegalForm,
    companyCountry,
    sourceUrl: sourceUrl,
    evidence: ['siren', 'entreprises api'].join(', '),
  } satisfies Omit<ContactResult, 'status'>;
}

async function fetchEntrepriseContactBySiren(siren: string, timeoutMs?: number) {
  const normalizedSiren = normalizeSiren(siren);
  if (!normalizedSiren) {
    return null;
  }

  try {
    const payload = await fetchJsonWithTimeout(
      `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(normalizedSiren)}`,
      timeoutMs,
    );

    if (!payload) {
      return null;
    }

    return extractEntrepriseApiContact(payload, normalizedSiren);
  } catch {
    return null;
  }
}

const CONTACT_PAGE_PATHS = [
  '/contact',
  '/pages/contact',
  '/pages/contactez-nous',
  '/pages/contact-us',
  '/pages/conditions-generales-de-vente',
];

const LEGAL_NOTICE_PAGE_PATHS = [
  '/policies/legal-notice',
  '/mentions-legales',
  '/pages/mentions-legales',
  '/pages/legal-notice',
  '/policies/terms-of-service',
];

function buildCandidateContactUrls(
  url: string,
  body = '',
  options: { preferLegalNoticeFirst?: boolean } = {},
) {
  const origin = new URL(url).origin;
  const links = [...body.matchAll(/<a\b[^>]+href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1])
    .filter((href) => /(contact|mention|legal|cgv|conditions|terms)/i.test(href))
    .map((href) => {
      try {
        return new URL(href, origin).toString();
      } catch {
        return null;
      }
    })
    .filter((href): href is string => Boolean(href));

  const preferredPaths = options.preferLegalNoticeFirst
    ? [...CONTACT_PAGE_PATHS]
    : [...CONTACT_PAGE_PATHS, ...LEGAL_NOTICE_PAGE_PATHS];

  return uniqueValues([url, ...preferredPaths.map((pagePath) => `${origin}${pagePath}`), ...links]).slice(0, 12);
}

function buildContactPageUrls(
  url: string,
  options: { preferLegalNoticeFirst?: boolean } = {},
) {
  const origin = new URL(url).origin;
  const contactPages = CONTACT_PAGE_PATHS.map((pagePath) => `${origin}${pagePath}`);
  const legalNoticePages = LEGAL_NOTICE_PAGE_PATHS.map((pagePath) => `${origin}${pagePath}`);

  return options.preferLegalNoticeFirst
    ? [...legalNoticePages, url, ...contactPages]
    : [url, ...contactPages, ...legalNoticePages];
}

async function extractLegalNoticeContactInfo(url: string, timeoutMs?: number) {
  const candidates = [
    '/policies/legal-notice',
    '/mentions-legales',
    '/pages/mentions-legales',
    '/pages/legal-notice',
  ];

  for (const path of candidates) {
    try {
      const pageUrl = new URL(path, url).toString();
      const response = await fetchHtmlWithTimeout(pageUrl, timeoutMs);
      if (response.status >= 400 || !response.body) {
        continue;
      }

      const contact = extractContactInfo(response.body, pageUrl);
      if (hasContactInfo(contact)) {
        return contact;
      }
    } catch {
      continue;
    }
  }

  return null;
}

  const emptyContact: Omit<ContactResult, 'status'> = {
  email: null,
  contactEmailWasPlaceholder: false,
  phone: null,
  siret: null,
  siren: null,
  firstName: null,
  lastName: null,
  ownerName: null,
  companyName: null,
  companyAddress: null,
  companyPostalCode: null,
  companyCity: null,
  companyLegalForm: null,
  companyCountry: null,
  linkedinUrl: null,
  companyLinkedinUrl: null,
  avatarUrl: null,
  linkedinImageUrl: null,
  socialLinks: [],
  sourceUrl: null,
  evidence: null,
  contactObservation: null,
};

@Injectable()
export class ContactsService {
  async findOneContact(
    row: {
      id?: number;
      url: string;
      siteName?: string | null;
      siren?: string | null;
      companyName?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      ownerName?: string | null;
    },
    options: { timeoutMs?: number; includeLinkedin?: boolean; preferLegalNoticeFirst?: boolean } = {},
  ) {
    try {
      let contact = emptyContact;

      if (row.siren) {
        const manualSirenContact = await fetchEntrepriseContactBySiren(row.siren, options.timeoutMs);
        if (manualSirenContact) {
          contact = mergeContactInfo(contact, {
            ...manualSirenContact,
            companyName: manualSirenContact.companyName || row.companyName || null,
            firstName: manualSirenContact.firstName || row.firstName || null,
            lastName: manualSirenContact.lastName || row.lastName || null,
            ownerName: manualSirenContact.ownerName || row.ownerName || null,
          });
        }
      }

      let pageUrls = buildContactPageUrls(row.url, {
        preferLegalNoticeFirst: options.preferLegalNoticeFirst,
      });
      let homePageBody: string | null = null;

      for (let index = 0; index < pageUrls.length; index += 1) {
        if (hasCompleteContactInfo(contact)) {
          break;
        }

        try {
          const pageUrl = pageUrls[index];
          const response = await fetchHtmlWithTimeout(pageUrl, options.timeoutMs);
          if (response.status >= 400 || !response.body) {
            continue;
          }

          if (pageUrl === row.url) {
            homePageBody = response.body;
          }

          const pageSiren = extractSirenFromBody(response.body);

          if (pageSiren) {
            const entrepriseContact = await fetchEntrepriseContactBySiren(pageSiren, options.timeoutMs);
            if (entrepriseContact) {
              contact = mergeContactInfo(contact, entrepriseContact);
            }
          }

          const pageContact = extractContactInfo(response.body, pageUrl);
          contact = mergeContactInfo(contact, pageContact);

          if (pageContact.siren && pageContact.siren !== pageSiren) {
            const entrepriseContact = await fetchEntrepriseContactBySiren(pageContact.siren, options.timeoutMs);
            if (entrepriseContact) {
              contact = mergeContactInfo(contact, entrepriseContact);
            }
          }

          if (pageUrl === row.url && homePageBody) {
            const discoveredPages = buildCandidateContactUrls(row.url, homePageBody, {
              preferLegalNoticeFirst: options.preferLegalNoticeFirst,
            });
            for (const discoveredPage of discoveredPages) {
              if (!pageUrls.includes(discoveredPage)) {
                pageUrls.push(discoveredPage);
              }
            }
          }
        } catch {
          continue;
        }
      }

      if (hasContactInfo(contact) && options.includeLinkedin !== false) {
        const ceoLinkedinUrl = await this.searchLinkedinProfile(contact, options);
        if (ceoLinkedinUrl) {
          contact.linkedinUrl = ceoLinkedinUrl;
        }
      }
      if (contact.linkedinUrl && !String(contact.evidence || '').includes('linkedin')) {
        contact.evidence = contact.evidence ? `${contact.evidence}, linkedin` : 'linkedin';
      }
      if (contact.companyLinkedinUrl && !String(contact.evidence || '').includes('company linkedin')) {
        contact.evidence = contact.evidence ? `${contact.evidence}, company linkedin` : 'company linkedin';
      }
      if ((contact.socialLinks?.length || 0) > 0 && !String(contact.evidence || '').includes('social')) {
        contact.evidence = contact.evidence ? `${contact.evidence}, social` : 'social';
      }
      contact.avatarUrl = homePageBody
        ? extractSiteAvatarUrl(homePageBody, row.url) || buildGravatarUrl(contact.email)
        : buildGravatarUrl(contact.email);

      return {
        ...contact,
        status: hasContactInfo(contact) ? 'found' : 'not_found',
      };
    } catch (error) {
      const typedError = error as Error;

      return {
        ...emptyContact,
        status: 'error',
        evidence: typedError.name === 'AbortError' ? 'timeout' : typedError.message,
      };
    }
  }

  async searchLinkedinProfile(contact: Omit<ContactResult, 'status'>, options: { timeoutMs?: number } = {}) {
    const person = contact.ownerName || [contact.firstName, contact.lastName].filter(Boolean).join(' ');
    const company = contact.companyName || '';
    const companySlug = getLinkedinCompanySlug(contact.companyLinkedinUrl);

    if (!person && !company && !companySlug) {
      return null;
    }

    const queryParts = ['site:linkedin.com/in'];
    if (person) {
      queryParts.push(person);
    } else {
      queryParts.push('CEO OR founder OR fondateur OR dirigeant');
    }
    if (company) {
      queryParts.push(company);
    }
    if (companySlug) {
      queryParts.push(companySlug);
    }

    const query = encodeURIComponent(queryParts.join(' ').trim());
    const searchUrl = `https://duckduckgo.com/html/?q=${query}`;

    try {
      const response = await fetchHtmlWithTimeout(searchUrl, options.timeoutMs || 8000);
      const linkedinUrls = extractLinkedinUrls(response.body);

      return linkedinUrls.find((url) => url.includes('/in/')) || null;
    } catch {
      return null;
    }
  }

}
