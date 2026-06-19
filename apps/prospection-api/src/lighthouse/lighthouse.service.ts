import { BadRequestException, Injectable } from '@nestjs/common';
import * as chromeLauncher from 'chrome-launcher';

export interface LighthouseObservation {
  category: 'performance' | 'accessibility' | 'best-practices' | 'seo';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  evidence?: string | null;
}

function isKnownLighthouseNoise(value: unknown) {
  if (typeof value !== 'string') {
    return false;
  }

  return value.includes('Failed to parse source map')
    || value.includes('sourceURL')
    || value.includes('DuplicatedJavaScript')
    || value.includes('ScriptsHandler');
}

function numericAuditValue(lhr: any, auditId: string) {
  const audit = lhr?.audits?.[auditId];
  return typeof audit?.numericValue === 'number' ? audit.numericValue : null;
}

function auditItemCount(lhr: any, auditId: string) {
  const items = lhr?.audits?.[auditId]?.details?.items;
  return Array.isArray(items) ? items.length : 0;
}

function buildObservations(lhr: any): LighthouseObservation[] {
  const observations: LighthouseObservation[] = [];

  const add = (
    category: LighthouseObservation['category'],
    severity: LighthouseObservation['severity'],
    title: string,
    detail: string,
    evidence?: string | null,
  ) => {
    observations.push({ category, severity, title, detail, evidence: evidence || null });
  };

  if (lhr?.audits?.['document-title']?.score === 0) {
    add(
      'seo',
      'critical',
      'Titre de page trop faible',
      'La page d’accueil n’expose pas de balise title exploitable pour le SEO et la prospection.',
    );
  }

  if (lhr?.audits?.['meta-description']?.score === 0) {
    add(
      'seo',
      'warning',
      'Meta description absente',
      'La page ne donne pas de description claire dans les résultats de recherche.',
    );
  }

  if (lhr?.audits?.['link-rel-canonical']?.score === 0) {
    add(
      'seo',
      'warning',
      'Canonical manquante',
      'L’URL canonique n’est pas clairement définie, ce qui peut brouiller l’indexation.',
    );
  }

  if (lhr?.audits?.['html-has-lang']?.score === 0) {
    add(
      'accessibility',
      'warning',
      'Langue de page non déclarée',
      'Le navigateur et les moteurs ne savent pas quelle langue principale utiliser.',
    );
  }

  if (lhr?.audits?.viewport?.score === 0) {
    add(
      'accessibility',
      'critical',
      'Viewport mobile absent',
      'La page peut être pénalisée sur mobile si l’affichage adaptatif n’est pas défini.',
    );
  }

  const missingAltCount = auditItemCount(lhr, 'image-alt');
  if (missingAltCount > 0) {
    add(
      'accessibility',
      missingAltCount > 3 ? 'critical' : 'warning',
      'Images sans texte alternatif',
      `${missingAltCount} image(s) ne décrivent pas leur contenu pour l’accessibilité et le SEO.`,
    );
  }

  const buttonNameCount = auditItemCount(lhr, 'button-name');
  if (buttonNameCount > 0) {
    add(
      'accessibility',
      'warning',
      'Boutons peu explicites',
      `${buttonNameCount} bouton(s) n’ont pas de nom accessible clair.`,
    );
  }

  const linkNameCount = auditItemCount(lhr, 'link-name');
  if (linkNameCount > 0) {
    add(
      'accessibility',
      'warning',
      'Liens peu lisibles',
      `${linkNameCount} lien(s) n’ont pas de texte suffisamment explicite.`,
    );
  }

  const contrastCount = auditItemCount(lhr, 'color-contrast');
  if (contrastCount > 0) {
    add(
      'accessibility',
      contrastCount > 5 ? 'critical' : 'warning',
      'Contraste insuffisant',
      `${contrastCount} élément(s) peuvent être difficiles à lire pour certains visiteurs.`,
    );
  }

  const onHttps = lhr?.audits?.['is-on-https']?.score === 1;
  if (!onHttps) {
    add(
      'best-practices',
      'critical',
      'HTTPS non généralisé',
      'Le site n’est pas entièrement servi en HTTPS, ce qui peut freiner la confiance.',
    );
  }

  const redirectsHttp = lhr?.audits?.['redirects-http']?.score === 0;
  if (redirectsHttp) {
    add(
      'best-practices',
      'warning',
      'Redirection HTTP perfectible',
      'L’URL HTTP ne redirige pas proprement vers la version sécurisée.',
    );
  }

  const serverResponseTime = numericAuditValue(lhr, 'server-response-time');
  if (serverResponseTime !== null && serverResponseTime > 600) {
    add(
      'performance',
      serverResponseTime > 1200 ? 'critical' : 'warning',
      'Temps de réponse serveur élevé',
      `Le serveur met environ ${(serverResponseTime / 1000).toFixed(1)} s à répondre, ce qui ralentit la première impression.`,
    );
  }

  const lcp = numericAuditValue(lhr, 'largest-contentful-paint');
  if (lcp !== null && lcp > 4000) {
    add(
      'performance',
      lcp > 6000 ? 'critical' : 'warning',
      'Chargement principal lent',
      `Le contenu principal s’affiche en ${(lcp / 1000).toFixed(1)} s, ce qui peut faire décrocher avant la lecture.`,
    );
  }

  const tbt = numericAuditValue(lhr, 'total-blocking-time');
  if (tbt !== null && tbt > 300) {
    add(
      'performance',
      tbt > 600 ? 'critical' : 'warning',
      'Interface bloquante',
      `Le temps de blocage total atteint ${Math.round(tbt)} ms, ce qui nuit à l’interaction.`,
    );
  }

  const cls = numericAuditValue(lhr, 'cumulative-layout-shift');
  if (cls !== null && cls > 0.1) {
    add(
      'performance',
      cls > 0.25 ? 'critical' : 'warning',
      'Décalages visuels',
      `La mise en page bouge pendant le chargement (CLS ${cls.toFixed(2)}).`,
    );
  }

  const speedIndex = numericAuditValue(lhr, 'speed-index');
  if (speedIndex !== null && speedIndex > 4000) {
    add(
      'performance',
      speedIndex > 7000 ? 'critical' : 'warning',
      'Affichage global lent',
      `L’affichage visuel complet prend environ ${(speedIndex / 1000).toFixed(1)} s.`,
    );
  }

  return observations.slice(0, 8);
}

@Injectable()
export class LighthouseService {
  private auditQueue = Promise.resolve();

  private async withSuppressedNoise<T>(task: () => Promise<T>) {
    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = (...args: unknown[]) => {
      if (args.some((arg) => isKnownLighthouseNoise(arg))) {
        return;
      }

      originalError(...args);
    };

    console.warn = (...args: unknown[]) => {
      if (args.some((arg) => isKnownLighthouseNoise(arg))) {
        return;
      }

      originalWarn(...args);
    };

    try {
      return await task();
    } finally {
      console.error = originalError;
      console.warn = originalWarn;
    }
  }

  private runSequentially<T>(task: () => Promise<T>): Promise<T> {
    const next = this.auditQueue.then(task, task);
    this.auditQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private isTimingMarkError(error: unknown) {
    return error instanceof Error
      && (
        error.message.includes('performance mark has not been set')
        || error.message.includes('TraceEngineResult')
        || error.message.includes('marky')
      );
  }

  async audit(url: string) {
    if (!url || !/^https?:\/\/.+/.test(url)) {
      throw new BadRequestException(
        'URL invalide. Exemple attendu : http://localhost:3000',
      );
    }

    return this.runSequentially(async () => {
      const executeAudit = async () => {
        const chrome = await chromeLauncher.launch({
          chromeFlags: [
            '--headless',
            '--no-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
          ],
        });

        try {
          const lighthouse = (await import('lighthouse')).default;

          const result = await lighthouse(url, {
            port: chrome.port,
            output: ['json'],
            onlyCategories: [
              'performance',
              'accessibility',
              'best-practices',
              'seo',
            ],
            throttlingMethod: 'simulate',
            logLevel: 'silent',
          });

          if (!result) {
            throw new Error('Lighthouse n’a pas retourné de résultat.');
          }

          const lhr = result.lhr;

          return {
            url: lhr.finalDisplayedUrl,
            scores: {
              performance: Math.round(
                (lhr.categories.performance?.score ?? 0) * 100,
              ),
              accessibility: Math.round(
                (lhr.categories.accessibility?.score ?? 0) * 100,
              ),
              bestPractices: Math.round(
                (lhr.categories['best-practices']?.score ?? 0) * 100,
              ),
              seo: Math.round((lhr.categories.seo?.score ?? 0) * 100),
              overall: Math.round(
                [
                  lhr.categories.performance?.score ?? 0,
                  lhr.categories.accessibility?.score ?? 0,
                  lhr.categories['best-practices']?.score ?? 0,
                  lhr.categories.seo?.score ?? 0,
                ].reduce((sum, value) => sum + value, 0) / 4 * 100,
              ),
            },
            metrics: {
              firstContentfulPaint:
                lhr.audits['first-contentful-paint']?.displayValue,
              largestContentfulPaint:
                lhr.audits['largest-contentful-paint']?.displayValue,
              totalBlockingTime: lhr.audits['total-blocking-time']?.displayValue,
              cumulativeLayoutShift:
                lhr.audits['cumulative-layout-shift']?.displayValue,
              speedIndex: lhr.audits['speed-index']?.displayValue,
            },
            observations: buildObservations(lhr),
            raw: lhr,
          };
        } finally {
          await chrome.kill();
        }
      };

      try {
        return await this.withSuppressedNoise(executeAudit);
      } catch (error) {
        if (!this.isTimingMarkError(error)) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
        return executeAudit();
      }
    });
  }
}
