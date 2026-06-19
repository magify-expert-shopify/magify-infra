import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SiteSettingsService, type EmailTemplateDefinition } from 'src/site-settings/site-settings.service';
import { PROSPECT_EMAIL_SEND_QUEUE, PROSPECT_STATUS_RECALC_QUEUE } from 'src/queues/queue.constants';
import { Queue } from 'bullmq';
import { computeLeadScore } from './prospect-score';
import type { ProspectEmailJobData } from './prospect-email.processor';
import { ProspectEmailScheduleService } from './prospect-email-schedule.service';
import type { ProspectStatusRecalcJobData } from './prospect-status-recalc.processor';
import { ProspectStatusRecalcEventsService } from './prospect-status-recalc-events.service';
import { loadSiteQualification, type SiteObservation } from 'src/site-qualifications/site-qualifications';
import { GmailMailService } from 'src/mail/gmail-mail.service';
import { ProspectEmailProcessor } from './prospect-email.processor';
import { ContactsService } from 'src/contacts/contacts.service';
import { UrlsService } from 'src/urls/urls.service';
import { recordProspectEmailSend } from './prospect-email-history';
import { ensureProspectsTable as ensureProspectsTableExists, getTableColumnNames } from 'src/database/sqlite-schema';

export const PROSPECT_STATUSES = [
  'Prospect froid',
  'Prospect informations manquantes',
  'Prospect contacté',
  'Prospect en attente réponse',
  'Prospect en discussion',
  'Prospect qualifié (opportunité)',
  'Prospect non qualifié',
  'Offre envoyée',
  'Relance en cours',
  'Client',
  'Perdu',
] as const;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

type EmailTemplateKey = 'current' | 'blank' | 'diagnostic' | 'refonte' | 'migration' | 'support' | 'support-simple' | 'support-ticket' | 'support-en' | 'creation' | 'optimisation';

type ProspectEmailTemplate = EmailTemplateDefinition | {
  key: 'current';
  label: string;
  subject: string;
  body: string;
};

type ProspectEmailComposer = {
  prospect: ReturnType<ProspectsService['serializeProspectRow']>;
  draft: {
    subject: string;
    body: string;
    templateKey: EmailTemplateKey;
    };
    templates: ProspectEmailTemplate[];
};

type ProspectQueuedEmailItem = {
  prospect: ReturnType<ProspectsService['serializeProspectRow']>;
  queuedAt: string | null;
  jobId: string | null;
  state: 'waiting' | 'active' | 'delayed' | 'paused' | 'sent';
  subject: string;
};

type ProspectQueuedEmailListResponse = {
  items: ProspectQueuedEmailItem[];
  total: number;
};

type RemoveQueuedEmailResult = {
  success: boolean;
  cancelled: boolean;
  cancelledActiveJobIds: string[];
  cancelledActiveJobCount: number;
  stillActiveJobIds: string[];
  stillActiveJobCount: number;
  removedQueuedJobCount: number;
  hasActiveJob: boolean;
};

type RequeueQueuedEmailsResult = {
  success: boolean;
  total: number;
  requeued: number;
  alreadyQueued: number;
  failed: number;
  results: Array<{
    prospectId: number;
    queued: boolean;
    skipped?: boolean;
    reason?: string;
  }>;
};

type BulkQueuedEmailActionResult = {
  success: boolean;
  total: number;
  processed: number;
  cancelled: number;
  removed: number;
  failed: number;
  results: Array<{
    prospectId: number;
    success: boolean;
    cancelled?: boolean;
    removedQueuedJobCount?: number;
    stillActiveJobCount?: number;
    reason?: string;
  }>;
};

type ProspectListMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ProspectListResponse = {
  items: ReturnType<ProspectsService['serializeProspectRow']>[];
  meta: ProspectListMeta;
};

type ProspectListField = string;

type ProspectStatusCount = {
  status: string;
  total: number;
};

type MagifyOsTicketCreationResponse = {
  success?: boolean;
  ticket?: {
    id?: string;
    title?: string;
    status?: string;
    priority?: string;
    ticket_source?: string;
    created_at?: string;
  };
  ticketUrl?: string | null;
  companyId?: string | null;
  contactId?: string | null;
};

type StoredMagifyTicketData = {
  ticketId: string | null;
  ticketUrl: string | null;
};

type MagifyOsTicketCreateBody = {
  company?: {
    name?: string | null;
    siren?: string | null;
    website?: string | null;
    legal_form?: string | null;
    address?: string | null;
    address_extra?: string | null;
    postal_code?: string | null;
    city?: string | null;
    country?: string | null;
  } | null;
  contact?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    job_title?: string | null;
  } | null;
  ticket?: {
    title?: string | null;
    notes?: string | null;
    priority?: string | null;
    shop_url?: string | null;
    offer_id?: string | null;
    responsible_user_id?: string | null;
  } | null;
  title?: string | null;
  notes?: string | null;
  priority?: string | null;
  shop_url?: string | null;
  offer_id?: string | null;
  responsible_user_id?: string | null;
};

const DEFAULT_MAGIFY_OS_OFFER_ID = '7a5e6af3-f866-4916-9ca9-1fcd3126a475';

type ProspectCountsResponse = {
  total: number;
  counts: ProspectStatusCount[];
};

export type ProspectStatusRecalcStatus = {
  id: number;
  status: 'idle' | 'queued' | 'running' | 'completed';
  totalProspects: number;
  processedProspects: number;
  runningProspects: number;
  pendingProspects: number;
  queuedAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastError: string | null;
  currentProspectId: number | null;
  updatedAt: Date | null;
};

type ProspectRelaunchItem = {
  id: number;
  name: string | null;
  siteName: string | null;
  sourceUrl: string | null;
  sourceFile: string | null;
  status: string | null;
  leadScore: number | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  linkedinImageUrl: string | null;
  avatarUrl: string | null;
  owner: string | null;
  lastChecked: string | null;
  evidence: string | null;
  score: number | null;
  firstName: string | null;
  socialLinksJson: string | null;
  firstContactEmailSentAt: string | null;
  firstContactEmailQueuedAt: string | null;
  firstContactEmailSubject: string | null;
  firstContactEmailBody: string | null;
  quoteFileName: string | null;
  quoteSentAt: string | null;
  contractFileName: string | null;
  contractSentAt: string | null;
  contractSignedAt: string | null;
  trashedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  url: {
    url: string | null;
    shopifyStatus: string | null;
    redesignStatus: string | null;
    redesignDecision: string | null;
    shopifyThemeSchemaName: string | null;
    shopifyThemeName: string | null;
    scanTotalMs: number | null;
    scanTtfbMs: number | null;
    scanHtmlBytes: number | null;
    productCount: number | null;
    medianProductPrice: number | null;
    catalogCheckedAt: string | null;
    giftCardDetected: boolean;
    cmsName: string | null;
    lighthouseCheckedAt: string | null;
    lighthouseScore: number | null;
    lighthousePerformanceScore: number | null;
    lighthouseAccessibilityScore: number | null;
    lighthouseBestPracticesScore: number | null;
    lighthouseSeoScore: number | null;
    lighthouseObservationsJson: string | null;
  } | null;
};

@Injectable()
export class ProspectsService {
  private prospectsTableReady = false;
  private prospectStatusRecalcTableReady = false;

  constructor(
    private prisma: PrismaService,
    private readonly siteSettingsService: SiteSettingsService,
    private readonly gmailMailService: GmailMailService,
    private readonly prospectEmailScheduleService: ProspectEmailScheduleService,
    private readonly prospectEmailProcessor: ProspectEmailProcessor,
    private readonly contactsService: ContactsService,
    @Inject(forwardRef(() => UrlsService))
    private readonly urlsService: UrlsService,
    @InjectQueue(PROSPECT_EMAIL_SEND_QUEUE)
    private prospectEmailQueue: Queue<ProspectEmailJobData>,
    @InjectQueue(PROSPECT_STATUS_RECALC_QUEUE)
    private readonly prospectStatusRecalcQueue: Queue<ProspectStatusRecalcJobData>,
    private readonly prospectStatusRecalcEventsService: ProspectStatusRecalcEventsService,
  ) {}

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private getProspectFirstName(prospect: any) {
    return String(prospect?.firstName || prospect?.name || 'Prénom').split(' ')[0] || 'Prénom';
  }

  private normalizeHomeUrl(value: string | null | undefined) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return null;
    }

    try {
      const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
      url.pathname = '/';
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch {
      return null;
    }
  }

  private buildProspectMagifyTicketNotes(prospect: any) {
    const observations = Array.isArray(prospect?.url?.qualification?.observations)
      ? prospect.url.qualification.observations
      : [];

    if (observations.length > 0) {
      const lines: string[] = [];
      for (const observation of observations.slice(0, 8)) {
        const title = String(observation?.title || observation?.detail || '').trim();
        const detail = String(observation?.detail || observation?.title || '').trim();
        if (!title && !detail) {
          continue;
        }

        lines.push(`- ${title || detail}${detail && detail !== title ? ` — ${detail}` : ''}`);
      }

      return lines.join('\n');
    }

    return '- Aucune observation détectée';
  }

  private normalizeMagifyTicketPriority(value: string | null | undefined) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'basse' || normalized === 'normale' || normalized === 'haute' || normalized === 'urgente') {
      return normalized;
    }

    return 'normale';
  }

  async createMagifyOsTicket(id: number, body: MagifyOsTicketCreateBody = {}) {
    const prospect = await this.getProspect(id);
    const endpoint = process.env.MAGIFY_OS_TICKET_CREATE_URL?.trim();
    const token = process.env.EXTERNAL_API_KEY?.trim();

    if (!endpoint) {
      throw new BadRequestException('L’URL de création de ticket MagifyOS n’est pas configurée.');
    }

    if (!token) {
      throw new BadRequestException(
        'Le token MagifyOS n’est pas configuré. Ajoute `EXTERNAL_API_KEY` ou `MAGIFY_OS_API_TOKEN` dans `api/.env`.',
      );
    }

    const sourceCompany = (body.company || {}) as NonNullable<NonNullable<MagifyOsTicketCreateBody['company']>>;
    const sourceContact = (body.contact || {}) as NonNullable<NonNullable<MagifyOsTicketCreateBody['contact']>>;
    const sourceTicket = (body.ticket || {}) as NonNullable<NonNullable<MagifyOsTicketCreateBody['ticket']>>;
    const ticketTitle = String(sourceTicket.title || body.title || prospect.siteName || prospect.name || 'Prospect Magify').trim();
    const ticketNotes = String(sourceTicket.notes || body.notes || this.buildProspectMagifyTicketNotes(prospect)).trim();
    const ticketPriority = this.normalizeMagifyTicketPriority(sourceTicket.priority || body.priority);
    const ticketShopUrl = String(
      sourceTicket.shop_url
      || body.shop_url
      || this.normalizeHomeUrl(prospect?.url?.url || prospect?.sourceUrl || null)
      || '',
    ).trim();
    const ticketOfferId = String(
      sourceTicket.offer_id
      || body.offer_id
      || process.env.MAGIFY_OS_SUPPORT_OFFER_ID?.trim()
      || DEFAULT_MAGIFY_OS_OFFER_ID,
    ).trim() || null;
    const ticketResponsibleUserId = String(
      sourceTicket.responsible_user_id
      || body.responsible_user_id
      || process.env.MAGIFY_OS_DEFAULT_RESPONSIBLE_USER_ID
      || process.env.MAGIFY_OS_DEFAULT_ASSIGNEE_ID
      || '',
    ).trim() || null;
    const companyName = String(
      sourceCompany.name
      || prospect?.url?.contactCompanyName
      || prospect.siteName
      || prospect.name
      || 'Prospect Magify',
    ).trim();
    const companySiren = String(
      sourceCompany.siren
      || prospect?.url?.contactSiren
      || '',
    ).trim() || null;
    const companyWebsite = String(
      sourceCompany.website
      || this.normalizeHomeUrl(prospect?.url?.url || prospect?.sourceUrl || null)
      || '',
    ).trim() || null;
    const contactFirstName = String(
      sourceContact.first_name
      || prospect?.url?.contactFirstName
      || prospect?.firstName
      || this.getProspectFirstName(prospect),
    ).trim();
    const contactLastName = String(
      sourceContact.last_name
      || prospect?.url?.contactLastName
      || prospect?.url?.contactOwnerName
      || prospect?.name
      || prospect?.siteName
      || 'Contact',
    ).trim();
    const contactEmail = String(
      sourceContact.email
      || prospect?.email
      || prospect?.url?.contactEmail
      || '',
    ).trim();
    const contactPhone = String(
      sourceContact.phone
      || prospect?.phone
      || prospect?.url?.contactPhone
      || '',
    ).trim() || null;
    const contactJobTitle = String(
      sourceContact.job_title
      || prospect?.url?.contactOwnerName
      || '',
    ).trim() || null;

    if (!companyName) {
      throw new BadRequestException('Le nom de l’entreprise est requis pour créer un ticket MagifyOS.');
    }

    if (!contactFirstName || !contactLastName || !contactEmail) {
      throw new BadRequestException('Le contact MagifyOS doit contenir un prénom, un nom et un email.');
    }

    if (!ticketTitle) {
      throw new BadRequestException('Le titre du ticket MagifyOS est requis.');
    }

    const payload = {
      company: {
        name: companyName,
        ...(companySiren ? { siren: companySiren } : {}),
        ...(companyWebsite ? { website: companyWebsite } : {}),
        ...(sourceCompany.legal_form ? { legal_form: String(sourceCompany.legal_form).trim() } : {}),
        ...(sourceCompany.address ? { address: String(sourceCompany.address).trim() } : {}),
        ...(sourceCompany.address_extra ? { address_extra: String(sourceCompany.address_extra).trim() } : {}),
        ...(sourceCompany.postal_code ? { postal_code: String(sourceCompany.postal_code).trim() } : {}),
        ...(sourceCompany.city ? { city: String(sourceCompany.city).trim() } : {}),
        ...(sourceCompany.country ? { country: String(sourceCompany.country).trim() } : { country: 'France' }),
      },
      contact: {
        first_name: contactFirstName,
        last_name: contactLastName,
        email: contactEmail,
        ...(contactPhone ? { phone: contactPhone } : {}),
        ...(contactJobTitle ? { job_title: contactJobTitle } : {}),
      },
      ticket: {
        title: ticketTitle,
        notes: ticketNotes,
        priority: ticketPriority,
        ...(ticketShopUrl ? { shop_url: ticketShopUrl } : {}),
        ...(ticketOfferId ? { offer_id: ticketOfferId } : {}),
        ...(ticketResponsibleUserId ? { responsible_user_id: ticketResponsibleUserId } : {}),
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': token,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const text = await response.text();
      let parsed: MagifyOsTicketCreationResponse | { error?: string } | null = null;

      try {
        parsed = text ? JSON.parse(text) as MagifyOsTicketCreationResponse : null;
      } catch {
        parsed = null;
      }

      if (!response.ok) {
        throw new BadRequestException(
          (parsed && 'error' in parsed && parsed.error) || text || 'Impossible de créer le ticket MagifyOS.',
        );
      }

      const ticketId = parsed?.ticket?.id ? String(parsed.ticket.id).trim() : null;
      const ticketUrl = parsed?.ticketUrl ? String(parsed.ticketUrl).trim() : null;

      if (ticketId || ticketUrl) {
        await this.prisma.$executeRawUnsafe(
          `
          UPDATE "prospects"
          SET
            "magify_ticket_id" = ?,
            "magify_ticket_url" = ?,
            "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = ? AND "trashed_at" IS NULL
          `,
          ticketId,
          ticketUrl,
          id,
        );
      }

      return {
        ...(parsed || {}),
        ticketId,
        ticketUrl,
      } as MagifyOsTicketCreationResponse & StoredMagifyTicketData;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        error instanceof Error ? error.message : 'Impossible de créer le ticket MagifyOS.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private getProspectDisplayName(prospect: any) {
    return prospect?.siteName || prospect?.name || 'Prospect';
  }

  private renderTemplate(value: string, context: Record<string, string | number>) {
    return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
      const replacement = context[key];
      return replacement == null ? match : String(replacement);
    });
  }

  private stripEmailSignature(body: string) {
    return String(body || '')
      .replace(/\s*<!--magify-email-signature:start-->[\s\S]*?<!--magify-email-signature:end-->\s*/i, '')
      .trim();
  }

  private async getEmailSignatureHtml() {
    const signature = await this.siteSettingsService.getEmailSignature();
    return this.stripEmailSignature(signature.html);
  }

  private appendEmailSignature(body: string, signatureHtml: string) {
    const cleanedBody = String(body || '').trim();
    const cleanedSignature = String(signatureHtml || '').trim();

    if (!cleanedSignature) {
      return cleanedBody;
    }

    const wrappedSignature = `<!--magify-email-signature:start-->\n${cleanedSignature}\n<!--magify-email-signature:end-->`;

    if (!cleanedBody) {
      return wrappedSignature;
    }

    if (cleanedBody.includes('<!--magify-email-signature:start-->')) {
      return cleanedBody.replace(
        /<!--magify-email-signature:start-->[\s\S]*?<!--magify-email-signature:end-->/i,
        wrappedSignature,
      );
    }

    return `${cleanedBody}\n\n${wrappedSignature}`;
  }

  private normalizeEmailTemplateKey(value: unknown): EmailTemplateKey | null {
    return value === 'blank'
      || value === 'current'
      || value === 'diagnostic'
      || value === 'refonte'
      || value === 'migration'
      || value === 'support'
      || value === 'support-simple'
      || value === 'support-ticket'
      || value === 'support-en'
      || value === 'creation'
      || value === 'optimisation'
      ? value
      : null;
  }

  private getProspectSiteObservations(prospect: any) {
    const qualificationObservations = prospect?.url?.qualification?.observations;
    if (Array.isArray(qualificationObservations) && qualificationObservations.length > 0) {
      return qualificationObservations;
    }

    const legacyObservations = (() => {
      try {
        const parsed = JSON.parse(prospect?.url?.lighthouseObservationsJson || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();

    return legacyObservations
      .map((item: any, index: number) => {
        if (typeof item === 'string') {
          const text = item.trim();
          if (!text) {
            return null;
          }

          return {
            key: `legacy-${index + 1}`,
            title: text,
            detail: text,
            severity: 'info',
            isMain: index === 0,
          };
        }

        if (item && typeof item === 'object') {
          const title = String(item.title || item.detail || '').trim();
          const detail = String(item.detail || item.title || '').trim();
          if (!title && !detail) {
            return null;
          }

          return {
            key: String(item.key || item.id || `legacy-${index + 1}`),
            title: title || detail || `Observation ${index + 1}`,
            detail: detail || title || 'Observation sans détail.',
            severity: String(item.severity || 'info').toLowerCase() === 'critical'
              ? 'critical'
              : String(item.severity || 'info').toLowerCase() === 'warning'
                ? 'warning'
                : 'info',
            isMain: index === 0,
          };
        }

        return null;
      })
      .filter(Boolean) as SiteObservation[];
  }

  private getMainSiteObservation(prospect: any) {
    const qualificationMain = prospect?.url?.qualification?.mainObservation;
    if (qualificationMain) {
      return qualificationMain;
    }

    const observations = this.getProspectSiteObservations(prospect);
    return observations[0] || null;
  }

  private getProspectSupportTemplateKey(prospect: any): Exclude<EmailTemplateKey, 'blank' | 'diagnostic' | 'refonte' | 'migration' | 'creation' | 'optimisation' | 'support-en'> {
    const qualificationPositioning = String(prospect?.url?.qualification?.positioning || '').toLowerCase();
    if (qualificationPositioning === 'support-with-error') {
      return 'support-ticket';
    }

    if (qualificationPositioning === 'support-without-observation') {
      return 'support-simple';
    }

    const observations = this.getProspectSiteObservations(prospect);

    const hasRealObservation = observations.some((item: any) => {
      if (typeof item === 'string') {
        return item.trim().length > 0;
      }

      if (item && typeof item === 'object') {
        return String(item.detail || item.title || '').trim().length > 0;
      }

      return false;
    });

    return hasRealObservation ? 'support-ticket' : 'support-simple';
  }

  private getTemplateContext(prospect: any, siteLinks: { supportUrl: string; creationUrl: string; refonteUrl: string; migrationUrl: string; optimizationUrl: string; diagnosticUrl: string }) {
    const firstName = this.getProspectFirstName(prospect);
    const siteName = this.getProspectDisplayName(prospect);
    const url = prospect?.url?.url || prospect?.sourceUrl || '';
    const owner = prospect?.owner || prospect?.url?.contactOwnerName || '';
    const theme = prospect?.url?.shopifyThemeSchemaName || prospect?.url?.shopifyThemeName || '';
    const cms = prospect?.url?.cmsName || '';
    const leadScore = Number(prospect?.leadScore || 0);
    const observations = this.getProspectSiteObservations(prospect);
    const mainObservation = this.getMainSiteObservation(prospect);

    const firstObservation =
      String(mainObservation?.detail || mainObservation?.title || '')
        .trim()
      || observations
        .map((item: any) => String(item?.detail || item?.title || ''))
        .find((value: string) => value.trim().length > 0)
      || 'un point d’amélioration rapide';

    const errorName =
      String(mainObservation?.title || mainObservation?.detail || '').trim() || 'Erreur principale';

    const errorExplanation =
      String(mainObservation?.detail || mainObservation?.title || firstObservation || '').trim()
      || 'Le site présente un point important à corriger.';
    const allErrorExplanations =
      observations.length > 0
        ? `<ul>${observations.map((item: any) => {
          const title = String(item?.title || '').trim();
          const detail = String(item?.detail || '').trim();
          const label = title || detail;
          const body = detail && detail !== label ? detail : '';

          if (!label && !body) {
            return '';
          }

          return [
            '<li>',
            label ? `<strong>${this.escapeHtml(label)}</strong>` : '',
            body ? `${label ? ' : ' : ''}${this.escapeHtml(body)}` : '',
            '</li>',
          ].join('');
        }).filter(Boolean).join('')}</ul>`
        : '';

    return {
      firstName: this.escapeHtml(firstName),
      siteName: this.escapeHtml(siteName),
      shopName: this.escapeHtml(siteName),
      url: this.escapeHtml(url),
      owner: this.escapeHtml(owner),
      theme: this.escapeHtml(theme || '—'),
      cms: this.escapeHtml(cms || '—'),
      leadScore,
      firstObservation: this.escapeHtml(firstObservation),
      errorName: this.escapeHtml(errorName),
      errorExplanation: this.escapeHtml(errorExplanation),
      allErrorExplanations,
      supportLink: this.escapeHtml(siteLinks.supportUrl || ''),
      creationLink: this.escapeHtml(siteLinks.creationUrl || ''),
      refonteLink: this.escapeHtml(siteLinks.refonteUrl || ''),
      migrationLink: this.escapeHtml(siteLinks.migrationUrl || ''),
      optimizationLink: this.escapeHtml(siteLinks.optimizationUrl || ''),
      diagnosticLink: this.escapeHtml(siteLinks.diagnosticUrl || ''),
    };
  }

  private async buildEmailTemplates(prospect: any): Promise<ProspectEmailTemplate[]> {
    const [settings, siteLinks] = await Promise.all([
      this.siteSettingsService.getEmailTemplates(),
      this.siteSettingsService.getSiteLinks(),
    ]);
    const context = this.getTemplateContext(prospect, siteLinks);

    return settings.templates.map((template) => ({
      ...template,
      subject: this.renderTemplate(template.subject, context),
      body: this.renderTemplate(template.body, context),
    }));
  }

  private buildDefaultEmailTemplateKey(prospect: any): EmailTemplateKey {
    const qualificationPositioning = String(prospect?.url?.qualification?.positioning || '').toLowerCase();

    if (qualificationPositioning === 'support-with-error') {
      return 'support-ticket';
    }

    if (qualificationPositioning === 'support-without-observation') {
      return 'support-simple';
    }

    if (qualificationPositioning === 'optimisation') {
      return 'optimisation';
    }

    if (qualificationPositioning === 'refonte') {
      return 'refonte';
    }

    if (qualificationPositioning === 'migration') {
      return 'migration';
    }

    if (qualificationPositioning === 'abandon') {
      return 'blank';
    }

    const redesignStatus = String(prospect?.url?.redesignStatus || '').toLowerCase();
    const shopifyStatus = String(prospect?.url?.shopifyStatus || '').toLowerCase();

    if (redesignStatus === 'candidat migration') {
      return 'migration';
    }

    if (redesignStatus === 'candidat refonte') {
      return 'refonte';
    }

    if (shopifyStatus === 'shopify') {
      return 'diagnostic';
    }

    return this.getProspectSupportTemplateKey(prospect);
  }

  async getEmailComposer(id: number): Promise<ProspectEmailComposer> {
    const prospect = await this.getProspect(id);
    const templates = await this.buildEmailTemplates(prospect);
    const defaultKey = this.buildDefaultEmailTemplateKey(prospect);
    const draftSubject = prospect.firstContactEmailSubject || templates.find((template) => template.key === defaultKey)?.subject || '';
    const signatureHtml = await this.getEmailSignatureHtml();
    const rawDraftBody = this.stripEmailSignature(prospect.firstContactEmailBody || templates.find((template) => template.key === defaultKey)?.body || '');
    const draftBody = this.appendEmailSignature(rawDraftBody, signatureHtml);
    const hasSavedDraft = Boolean(prospect.firstContactEmailBody || prospect.firstContactEmailSubject);
    const responseTemplates: ProspectEmailTemplate[] = hasSavedDraft
      ? [
          {
            key: 'current',
            label: 'Modèle actuel',
            subject: draftSubject,
            body: draftBody,
          },
          ...templates,
        ]
      : templates;

    return {
      prospect,
      draft: {
        subject: draftSubject,
        body: draftBody,
        templateKey: hasSavedDraft ? 'current' : defaultKey,
      },
      templates: responseTemplates,
    };
  }

  async saveEmailDraft(id: number, body: { subject?: string; body?: string; templateKey?: string }) {
    await this.ensureProspectsTable();

    const subject = body.subject == null ? '' : String(body.subject);
    const emailBody = this.stripEmailSignature(body.body == null ? '' : String(body.body));
    const templateKey = this.normalizeEmailTemplateKey(body.templateKey) || 'blank';

    await this.prisma.$executeRawUnsafe(
      `UPDATE "prospects" SET "first_contact_email_subject" = ?, "first_contact_email_body" = ? WHERE "id" = ? AND "trashed_at" IS NULL`,
      subject,
      emailBody,
      id,
    );

    const composer = await this.getEmailComposer(id);

    return {
      ...composer,
      draft: {
        ...composer.draft,
        templateKey: templateKey === 'current' ? 'current' : templateKey,
      },
    };
  }

  private stripHtml(value: string) {
    return value
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async sendEmail(id: number, body: { subject?: string; body?: string; templateKey?: string }) {
    const composer = await this.getEmailComposer(id);
    const prospect = composer.prospect;
    const recipient = prospect.email?.trim();

    if (!recipient) {
      throw new BadRequestException('Ce prospect ne possède pas d’adresse email.');
    }

    const subject = body.subject?.trim() || composer.draft.subject?.trim();
    const signatureHtml = await this.getEmailSignatureHtml();
    const emailBody = this.appendEmailSignature(
      this.stripEmailSignature(body.body?.trim() || composer.draft.body?.trim() || ''),
      signatureHtml,
    );

    if (!subject) {
      throw new BadRequestException('Le sujet du mail est requis.');
    }

    if (!emailBody) {
      throw new BadRequestException('Le corps du mail est requis.');
    }

    if (recipient.toLowerCase() === 'hello@magify.fr') {
      const reservation = await this.prospectEmailScheduleService.reserveSendSlot();

      if (!reservation.reserved) {
        throw new BadRequestException('Le quota quotidien d’envoi est atteint.');
      }

      try {
        await this.gmailMailService.sendEmail({
          to: recipient,
          subject,
          html: emailBody,
          text: this.stripHtml(emailBody),
        });

        const sendRecord = await recordProspectEmailSend(this.prisma, {
          prospectId: id,
          recipientEmail: recipient,
        });

        await this.prisma.$executeRawUnsafe(
          `UPDATE "prospects" SET "first_contact_email_queued_at" = NULL, "first_contact_email_sent_at" = CURRENT_TIMESTAMP, "first_contact_email_subject" = ?, "first_contact_email_body" = ?, "email_send_count" = ?, "status" = ?, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = ? AND "trashed_at" IS NULL`,
          subject,
          emailBody,
          sendRecord.sendCount,
          sendRecord.sendCount > 1 ? 'Relance en cours' : 'Prospect contacté',
          id,
        );

        await this.prospectEmailScheduleService.completeReservedSendSlot();

        return {
          ...composer,
          prospect: await this.getProspect(id),
          draft: {
            ...composer.draft,
            subject,
            body: emailBody,
          },
          sent: {
            direct: true,
            recipient,
          },
        };
      } catch (error) {
        await this.prospectEmailScheduleService.releaseReservedSendSlot();
        throw error;
      }
    }

    const queuedAt = new Date();
    const job = await this.prospectEmailQueue.add(
      'send-prospect-email',
      {
        prospectId: prospect.id,
        recipient,
        subject,
        body: emailBody,
        text: this.stripHtml(emailBody),
        templateKey: this.normalizeEmailTemplateKey(body.templateKey) || composer.draft.templateKey,
      },
      {
        jobId: `prospect-${prospect.id}-email-${queuedAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
        removeOnComplete: false,
        removeOnFail: false,
      },
    );

    await this.prisma.$executeRawUnsafe(
      `UPDATE "prospects" SET "first_contact_email_queued_at" = CURRENT_TIMESTAMP, "first_contact_email_sent_at" = NULL, "first_contact_email_subject" = ?, "first_contact_email_body" = ? WHERE "id" = ? AND "trashed_at" IS NULL`,
      subject,
      emailBody,
      id,
    );

    return {
      ...composer,
      draft: {
        ...composer.draft,
        subject,
        body: emailBody,
      },
      queued: {
        id: job.id ?? null,
        queue: PROSPECT_EMAIL_SEND_QUEUE,
      },
    };
  }

  private async getQueuedProspectEmailJobs(prospectId: number) {
    const jobs = await this.prospectEmailQueue.getJobs([
      'waiting',
      'active',
      'delayed',
      'paused',
    ]);

    return (Array.isArray(jobs) ? jobs : []).filter(
      (job): job is NonNullable<typeof job> => Boolean(job?.data && Number(job.data.prospectId) === prospectId),
    );
  }

  private async waitForEmailJobsToSettle(jobIds: Array<string | number | undefined>, timeoutMs = 8000) {
    const validJobIds = jobIds
      .map((jobId) => String(jobId || '').trim())
      .filter((jobId) => Boolean(jobId));

    if (validJobIds.length === 0) {
      return;
    }

    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const states = await Promise.all(
        validJobIds.map(async (jobId) => {
          const job = await this.prospectEmailQueue.getJob(jobId);
          if (!job) {
            return null;
          }

          return String(await job.getState());
        }),
      );

      if (states.every((state) => state !== 'active')) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  private async getQueuedProspectEmailEntries(): Promise<ProspectQueuedEmailItem[]> {
    const jobs = await this.prospectEmailQueue.getJobs([
      'waiting',
      'active',
      'delayed',
      'paused',
    ]);

    const sortedJobs = (Array.isArray(jobs) ? jobs : [])
      .filter((job): job is NonNullable<typeof job> => Boolean(job?.data && Number.isInteger(Number(job.data.prospectId))))
      .sort((left, right) => Number(right.timestamp || 0) - Number(left.timestamp || 0));

    const seenProspectIds = new Set<number>();
    const entries: ProspectQueuedEmailItem[] = [];

    for (const job of sortedJobs) {
      const prospectId = Number(job.data?.prospectId);
      if (!Number.isInteger(prospectId) || prospectId <= 0 || seenProspectIds.has(prospectId)) {
        continue;
      }

      seenProspectIds.add(prospectId);

      let prospect: ReturnType<ProspectsService['serializeProspectRow']> | null = null;
      try {
        prospect = await this.getProspect(prospectId);
      } catch {
        continue;
      }
      const state = String(await job.getState());
      const isSent = Boolean(prospect.firstContactEmailSentAt);

      entries.push({
        prospect,
        queuedAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
        jobId: job.id ?? null,
        state: isSent
          ? 'sent'
          : state === 'waiting' || state === 'active' || state === 'delayed' || state === 'paused'
            ? state
            : 'waiting',
        subject: String(job.data?.subject || prospect.firstContactEmailSubject || ''),
      });
    }

    return entries;
  }

  async listQueuedProspectEmails(): Promise<ProspectQueuedEmailListResponse> {
    const items = await this.getQueuedProspectEmailEntries();
    return {
      items,
      total: items.length,
    };
  }

  async countQueuedProspectEmails() {
    const items = await this.getQueuedProspectEmailEntries();
    return { total: items.filter((item) => item.state !== 'sent').length };
  }

  async requeueQueuedProspectEmails(): Promise<RequeueQueuedEmailsResult> {
    const currentlyQueuedJobs = await this.prospectEmailQueue.getJobs([
      'waiting',
      'active',
      'delayed',
      'paused',
    ]);

    const queuedProspectIds = new Set(
      (Array.isArray(currentlyQueuedJobs) ? currentlyQueuedJobs : [])
        .map((job) => Number(job?.data?.prospectId))
        .filter((prospectId) => Number.isInteger(prospectId) && prospectId > 0),
    );

    const targets = await this.prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `
      SELECT p.id
      FROM "prospects" p
      WHERE p.trashed_at IS NULL
        AND p.first_contact_email_queued_at IS NOT NULL
        AND p.first_contact_email_sent_at IS NULL
      ORDER BY p.first_contact_email_queued_at ASC, p.id ASC
      `,
    );

    const results: RequeueQueuedEmailsResult['results'] = [];
    let requeued = 0;
    let alreadyQueued = 0;
    let failed = 0;

    for (const item of targets) {
      if (queuedProspectIds.has(item.id)) {
        alreadyQueued += 1;
        results.push({
          prospectId: item.id,
          queued: false,
          skipped: true,
          reason: 'already_queued',
        });
        continue;
      }

      try {
        await this.sendEmail(item.id, {});

        requeued += 1;
        results.push({
          prospectId: item.id,
          queued: true,
        });
      } catch (error) {
        failed += 1;
        results.push({
          prospectId: item.id,
          queued: false,
          reason: error instanceof Error ? error.message : 'Erreur inconnue',
        });
      }
    }

    return {
      success: true,
      total: targets.length,
      requeued,
      alreadyQueued,
      failed,
      results,
    };
  }

  async stopActiveQueuedEmails(): Promise<BulkQueuedEmailActionResult> {
    const items = await this.getQueuedProspectEmailEntries();
    const targets = items.filter((item) => item.state === 'active');

    const results: BulkQueuedEmailActionResult['results'] = [];
    let cancelled = 0;
    let removed = 0;
    let failed = 0;

    for (const item of targets) {
      try {
        const response = await this.removeQueuedEmail(item.prospect.id);
        const isCancelled = Boolean(response.cancelled && response.hasActiveJob === false);

        if (isCancelled) {
          cancelled += 1;
        }

        if (response.removedQueuedJobCount > 0) {
          removed += response.removedQueuedJobCount;
        }

        results.push({
          prospectId: item.prospect.id,
          success: isCancelled || response.removedQueuedJobCount > 0,
          cancelled: isCancelled,
          removedQueuedJobCount: response.removedQueuedJobCount,
          stillActiveJobCount: response.stillActiveJobCount,
        });
      } catch (error) {
        failed += 1;
        results.push({
          prospectId: item.prospect.id,
          success: false,
          reason: error instanceof Error ? error.message : 'Erreur inconnue',
        });
      }
    }

    return {
      success: true,
      total: targets.length,
      processed: results.length,
      cancelled,
      removed,
      failed,
      results,
    };
  }

  async removeWaitingQueuedEmails(): Promise<BulkQueuedEmailActionResult> {
    const queuedJobs = await this.prospectEmailQueue.getJobs([
      'waiting',
      'delayed',
      'paused',
    ]);

    const targets = (Array.isArray(queuedJobs) ? queuedJobs : [])
      .filter((job): job is NonNullable<typeof job> => Boolean(job?.data && Number.isInteger(Number(job.data.prospectId))))
      .sort((left, right) => Number(right.timestamp || 0) - Number(left.timestamp || 0));

    const results: BulkQueuedEmailActionResult['results'] = [];
    let removed = 0;
    let failed = 0;

    for (const item of targets) {
      try {
        const prospectId = Number(item.data?.prospectId);

        await item.remove();
        removed += 1;

        results.push({
          prospectId,
          success: true,
          removedQueuedJobCount: 1,
          stillActiveJobCount: 0,
        });
      } catch (error) {
        failed += 1;
        results.push({
          prospectId: Number(item.data?.prospectId) || 0,
          success: false,
          reason: error instanceof Error ? error.message : 'Erreur inconnue',
        });
      }
    }

    return {
      success: true,
      total: targets.length,
      processed: results.length,
      cancelled: 0,
      removed,
      failed,
      results,
    };
  }

  async removeQueuedEmail(id: number) {
    const composer = await this.getEmailComposer(id);

    if (!composer.prospect.firstContactEmailQueuedAt && !composer.prospect.firstContactEmailSentAt) {
      throw new BadRequestException('Ce mail n’est pas en file d’attente.');
    }

    const queuedJobs = await this.getQueuedProspectEmailJobs(id);
    const activeJobs = [] as typeof queuedJobs;
    const removableJobs = [] as typeof queuedJobs;

    for (const job of queuedJobs) {
      const state = await job.getState();

      if (state === 'active') {
        activeJobs.push(job);
        continue;
      }

      removableJobs.push(job);
    }

    const activeJobIds = activeJobs
      .map((job) => job.id)
      .filter((jobId): jobId is string => Boolean(jobId))
      .map((jobId) => String(jobId));

    const cancelResults = await Promise.all(
      activeJobIds.map((jobId) => this.prospectEmailProcessor.cancelActiveJob(jobId)),
    );

    await this.waitForEmailJobsToSettle(activeJobs.map((job) => job.id));

    await Promise.all(removableJobs.map((job) => job.remove()));

    const stillActiveJobIds: string[] = [];

    for (const jobId of activeJobIds) {
      const job = await this.prospectEmailQueue.getJob(jobId);

      if (!job) {
        continue;
      }

      const state = await job.getState();
      if (state === 'active') {
        stillActiveJobIds.push(jobId);
        continue;
      }

      await job.remove();
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE "prospects" SET "first_contact_email_queued_at" = NULL, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = ? AND "trashed_at" IS NULL`,
      id,
    );

    const cancelled = activeJobIds.length > 0 && stillActiveJobIds.length === 0 && cancelResults.every(Boolean);

    const result: RemoveQueuedEmailResult = {
      success: true,
      cancelled,
      cancelledActiveJobIds: activeJobIds,
      cancelledActiveJobCount: activeJobIds.length,
      stillActiveJobIds,
      stillActiveJobCount: stillActiveJobIds.length,
      removedQueuedJobCount: removableJobs.length,
      hasActiveJob: stillActiveJobIds.length > 0,
    };

    return result;
  }

  async markQueuedEmailAsSent(id: number) {
    const composer = await this.getEmailComposer(id);

    if (!composer.prospect.firstContactEmailQueuedAt && !composer.prospect.firstContactEmailSentAt) {
      throw new BadRequestException('Ce mail ne semble pas être en file d’attente.');
    }

    const queuedJobs = await this.getQueuedProspectEmailJobs(id);
    const activeJobs = [] as typeof queuedJobs;
    const removableJobs = [] as typeof queuedJobs;

    for (const job of queuedJobs) {
      const state = await job.getState();

      if (state === 'active') {
        activeJobs.push(job);
        continue;
      }

      removableJobs.push(job);
    }

    const activeJobIds = activeJobs
      .map((job) => job.id)
      .filter((jobId): jobId is string => Boolean(jobId))
      .map((jobId) => String(jobId));

    if (activeJobIds.length > 0) {
      await Promise.all(activeJobIds.map((jobId) => this.prospectEmailProcessor.cancelActiveJob(jobId)));
      await this.waitForEmailJobsToSettle(activeJobIds);
    }

    await Promise.allSettled(removableJobs.map((job) => job.remove()));

    for (const jobId of activeJobIds) {
      const job = await this.prospectEmailQueue.getJob(jobId);

      if (!job) {
        continue;
      }

      const state = await job.getState();
      if (state === 'active') {
        continue;
      }

      await job.remove();
    }

    const sentAt = this.prospectEmailScheduleService.getTodaySendTimestampAtHour(
      (await this.siteSettingsService.getEmailSending()).sendAtHour,
    );

    await this.prisma.$executeRawUnsafe(
      `UPDATE "prospects" SET "first_contact_email_queued_at" = NULL, "first_contact_email_sent_at" = ?, "status" = 'Prospect contacté', "updated_at" = CURRENT_TIMESTAMP WHERE "id" = ? AND "trashed_at" IS NULL`,
      sentAt.toISOString(),
      id,
    );

    return this.getEmailComposer(id);
  }

  async sendQueuedEmailNow(id: number) {
    const composer = await this.getEmailComposer(id);

    if (!composer.prospect.firstContactEmailQueuedAt && !composer.prospect.firstContactEmailSentAt) {
      throw new BadRequestException('Ce mail ne semble pas être en file d’attente.');
    }

    const recipient = composer.prospect.email?.trim();

    if (!recipient) {
      throw new BadRequestException('Ce prospect ne possède pas d’adresse email.');
    }

    const queuedJobs = await this.getQueuedProspectEmailJobs(id);
    const activeJobs = [] as typeof queuedJobs;
    const removableJobs = [] as typeof queuedJobs;

    for (const job of queuedJobs) {
      const state = await job.getState();

      if (state === 'active') {
        activeJobs.push(job);
        continue;
      }

      removableJobs.push(job);
    }

    const activeJobIds = activeJobs
      .map((job) => job.id)
      .filter((jobId): jobId is string => Boolean(jobId))
      .map((jobId) => String(jobId));

    if (activeJobIds.length > 0) {
      await Promise.all(activeJobIds.map((jobId) => this.prospectEmailProcessor.cancelActiveJob(jobId)));
      await this.waitForEmailJobsToSettle(activeJobIds);
    }

    const stillActiveJobIds: string[] = [];

    for (const jobId of activeJobIds) {
      const job = await this.prospectEmailQueue.getJob(jobId);

      if (!job) {
        continue;
      }

      const state = await job.getState();
      if (state === 'active') {
        stillActiveJobIds.push(jobId);
      }
    }

    if (stillActiveJobIds.length > 0) {
      throw new BadRequestException('Le mail est déjà en cours d’envoi et ne peut pas être exécuté maintenant.');
    }

    const queuedJob = queuedJobs[0];
    const queuedSubject = String(queuedJob?.data?.subject || composer.draft.subject || '').trim();
    const queuedBody = String(queuedJob?.data?.body || composer.draft.body || '').trim();
    const queuedText = String(queuedJob?.data?.text || this.stripHtml(queuedBody || composer.draft.body || '')).trim();

    if (!queuedSubject) {
      throw new BadRequestException('Le sujet du mail est requis.');
    }

    if (!queuedBody) {
      throw new BadRequestException('Le corps du mail est requis.');
    }

    await Promise.allSettled(removableJobs.map((job) => job.remove()));

    for (const jobId of activeJobIds) {
      const job = await this.prospectEmailQueue.getJob(jobId);

      if (!job) {
        continue;
      }

      const state = await job.getState();
      if (state === 'active') {
        continue;
      }

      await job.remove();
    }

    await this.gmailMailService.sendEmail({
      to: recipient,
      subject: queuedSubject,
      html: queuedBody,
      text: queuedText || this.stripHtml(queuedBody),
    });

    const sendRecord = await recordProspectEmailSend(this.prisma, {
      prospectId: id,
      recipientEmail: recipient,
    });

    await this.prisma.$executeRawUnsafe(
      `
        UPDATE "prospects"
        SET "first_contact_email_queued_at" = NULL,
            "first_contact_email_sent_at" = CURRENT_TIMESTAMP,
            "first_contact_email_subject" = ?,
            "first_contact_email_body" = ?,
            "email_send_count" = ?,
            "status" = ?,
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = ? AND "trashed_at" IS NULL
      `,
      queuedSubject,
      queuedBody,
      sendRecord.sendCount,
      sendRecord.sendCount > 1 ? 'Relance en cours' : 'Prospect contacté',
      id,
    );

    return this.getEmailComposer(id);
  }

  async refreshContactFromProspect(id: number, options: { timeoutMs?: number } = {}) {
    const prospect = await this.getProspect(id);

    if (!prospect.urlId) {
      throw new BadRequestException('Ce prospect n’est pas rattaché à une URL.');
    }

    const contactResult = await this.contactsService.findOneContact(
      {
        id: prospect.urlId,
        url: prospect.url?.url || prospect.sourceUrl,
        siteName: prospect.siteName || prospect.url?.siteName || prospect.name,
        siren: prospect.siren || null,
        companyName: prospect.companyName || null,
        firstName: prospect.firstName || null,
        lastName: prospect.lastName || null,
        ownerName: prospect.owner || null,
      },
      {
        timeoutMs: options.timeoutMs,
        preferLegalNoticeFirst: String(prospect.url?.shopifyStatus || '').toLowerCase() === 'shopify',
      },
    );

    if (contactResult.status === 'found') {
      await this.urlsService.updateContactResult(prospect.urlId, contactResult, { writeMode: 'merge' });
    } else {
      await this.urlsService.clearContactResult(prospect.urlId);
    }

    return this.getProspect(id);
  }

  async markProspectContactedExternally(id: number) {
    const current = await this.getProspect(id);

    if (current.status !== 'Prospect froid') {
      throw new BadRequestException('Le prospect doit être au statut "Prospect froid".');
    }

    const queuedJobs = await this.getQueuedProspectEmailJobs(id);
    const activeJobs = [] as typeof queuedJobs;
    const removableJobs = [] as typeof queuedJobs;

    for (const job of queuedJobs) {
      const state = await job.getState();

      if (state === 'active') {
        activeJobs.push(job);
        continue;
      }

      removableJobs.push(job);
    }

    if (activeJobs.length > 0) {
      throw new BadRequestException('Le mail est déjà en cours d’envoi et ne peut plus être retiré.');
    }

    await Promise.all(removableJobs.map((job) => job.remove()));

    await this.prisma.$executeRawUnsafe(
      `UPDATE "prospects" SET "status" = 'Prospect contacté', "first_contact_email_queued_at" = NULL, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = ? AND "trashed_at" IS NULL`,
      id,
    );

    return this.getProspect(id);
  }

  private getRelaunchCutoffSqlByDays(afterDays: number) {
    const normalizedDays = Math.min(365, Math.max(1, Math.floor(Number(afterDays) || 14)));
    return `CURRENT_TIMESTAMP - INTERVAL '${normalizedDays} day'`;
  }

  private async getProspectRelaunchAfterDays() {
    const settings = await this.siteSettingsService.getProspectRelaunchSettings();
    return Math.min(365, Math.max(1, Math.floor(Number(settings.afterDays) || 14)));
  }

  async listProspectsToRelaunch(fields?: ProspectListField[]): Promise<ProspectRelaunchItem[]> {
    await this.ensureProspectsTable();
    const afterDays = await this.getProspectRelaunchAfterDays();

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        p.*,
        u.url AS url_url,
        u.shopify_status AS url_shopify_status,
        u.redesign_status AS url_redesign_status,
        u.redesign_decision AS url_redesign_decision,
        u.shopify_theme_store_type AS url_shopify_theme_store_type,
        u.shopify_theme_schema_name AS url_shopify_theme_schema_name,
        u.shopify_theme_name AS url_shopify_theme_name,
        u.scan_total_ms AS url_scan_total_ms,
        u.scan_ttfb_ms AS url_scan_ttfb_ms,
        u.scan_html_bytes AS url_scan_html_bytes,
        u.product_count AS url_product_count,
        u.median_product_price AS url_median_product_price,
        u.catalog_checked_at AS url_catalog_checked_at,
        u.gift_card_detected AS url_gift_card_detected,
        u.cms_name AS url_cms_name,
        u.lighthouse_checked_at AS url_lighthouse_checked_at,
        u.lighthouse_score AS url_lighthouse_score,
        u.lighthouse_performance_score AS url_lighthouse_performance_score,
        u.lighthouse_accessibility_score AS url_lighthouse_accessibility_score,
        u.lighthouse_best_practices_score AS url_lighthouse_best_practices_score,
        u.lighthouse_seo_score AS url_lighthouse_seo_score,
        u.lighthouse_observations_json AS url_lighthouse_observations_json
      FROM "prospects" p
      LEFT JOIN "urls" u ON u.id = p.url_id
      WHERE p.trashed_at IS NULL
        AND p.email IS NOT NULL
        AND p.first_contact_email_sent_at IS NOT NULL
        AND p.first_contact_email_sent_at <= ${this.getRelaunchCutoffSqlByDays(afterDays)}
      ORDER BY p.first_contact_email_sent_at ASC, p.id ASC
      `,
    );

    return rows.map((row) => this.projectProspectRow(this.serializeProspectRow(row), fields)) as ProspectRelaunchItem[];
  }

  async countProspectsToRelaunch() {
    await this.ensureProspectsTable();
    const afterDays = await this.getProspectRelaunchAfterDays();

    const rows = await this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `
      SELECT COUNT(*) AS total
      FROM "prospects" p
      WHERE p.trashed_at IS NULL
        AND p.email IS NOT NULL
        AND p.first_contact_email_sent_at IS NOT NULL
        AND p.first_contact_email_sent_at <= ${this.getRelaunchCutoffSqlByDays(afterDays)}
      `,
    );

    return { total: Number(rows[0]?.total || 0) };
  }

  private async ensureProspectStatusRecalcTable() {
    if (this.prospectStatusRecalcTableReady) {
      return;
    }

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "prospect_status_recalc_runs" (
        "id" SERIAL PRIMARY KEY,
        "status" TEXT NOT NULL DEFAULT 'queued',
        "total_prospects" INTEGER NOT NULL DEFAULT 0,
        "processed_prospects" INTEGER NOT NULL DEFAULT 0,
        "running_prospects" INTEGER NOT NULL DEFAULT 0,
        "pending_prospects" INTEGER NOT NULL DEFAULT 0,
        "queued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "started_at" TIMESTAMPTZ,
        "finished_at" TIMESTAMPTZ,
        "last_error" TEXT,
        "current_prospect_id" INTEGER,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const columns = await getTableColumnNames(this.prisma, 'prospect_status_recalc_runs');

    if (!columns.includes('running_prospects')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "prospect_status_recalc_runs" ADD COLUMN "running_prospects" INTEGER NOT NULL DEFAULT 0',
      );
    }

    if (!columns.includes('pending_prospects')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "prospect_status_recalc_runs" ADD COLUMN "pending_prospects" INTEGER NOT NULL DEFAULT 0',
      );
    }

    if (!columns.includes('current_prospect_id')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "prospect_status_recalc_runs" ADD COLUMN "current_prospect_id" INTEGER',
      );
    }

    this.prospectStatusRecalcTableReady = true;
  }

  private dbRowToProspectStatusRecalcStatus(row: any): ProspectStatusRecalcStatus {
    return {
      id: Number(row.id),
      status: String(row.status || 'queued') as ProspectStatusRecalcStatus['status'],
      totalProspects: Number(row.total_prospects || 0),
      processedProspects: Number(row.processed_prospects || 0),
      runningProspects: Number(row.running_prospects || 0),
      pendingProspects: Number(row.pending_prospects || 0),
      queuedAt: row.queued_at ? new Date(row.queued_at) : null,
      startedAt: row.started_at ? new Date(row.started_at) : null,
      finishedAt: row.finished_at ? new Date(row.finished_at) : null,
      lastError: row.last_error ? String(row.last_error) : null,
      currentProspectId: row.current_prospect_id ? Number(row.current_prospect_id) : null,
      updatedAt: row.updated_at ? new Date(row.updated_at) : null,
    };
  }

  private async emitProspectStatusRecalcEvent(type: string) {
    this.prospectStatusRecalcEventsService.emit(type, await this.getProspectStatusRecalcStatus());
  }

  async getProspectStatusRecalcStatus(): Promise<ProspectStatusRecalcStatus> {
    await this.ensureProspectStatusRecalcTable();

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM "prospect_status_recalc_runs" ORDER BY "id" DESC LIMIT 1',
    );
    const row = rows[0];
    const counts = await this.prospectStatusRecalcQueue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'paused',
    );
    const pendingJobs =
      (counts.waiting || 0)
      + (counts.active || 0)
      + (counts.delayed || 0)
      + (counts.paused || 0);

    if (!row) {
      return {
        id: 0,
        status: 'idle',
        totalProspects: 0,
        processedProspects: 0,
        runningProspects: 0,
        pendingProspects: 0,
        queuedAt: null,
        startedAt: null,
        finishedAt: null,
        lastError: null,
        currentProspectId: null,
        updatedAt: null,
      };
    }

    const status = this.dbRowToProspectStatusRecalcStatus(row);
    if (['queued', 'running'].includes(status.status) && pendingJobs === 0) {
      return {
        ...status,
        status: 'idle',
      };
    }

    return status;
  }

  private deriveProspectStatusFromDb(row: {
    status?: string | null;
    email?: string | null;
    firstContactEmailSentAt?: Date | string | null;
    firstContactEmailQueuedAt?: Date | string | null;
    quoteSentAt?: Date | string | null;
    contractSignedAt?: Date | string | null;
  }) {
    const currentStatus = String(row.status || '').trim();
    const hasEmail = Boolean(String(row.email || '').trim());

    if (!hasEmail) {
      return 'Prospect informations manquantes';
    }

    if (row.contractSignedAt) {
      return 'Client';
    }

    if (row.quoteSentAt) {
      return 'Offre envoyée';
    }

    if (row.firstContactEmailSentAt) {
      return 'Prospect contacté';
    }

    if (row.firstContactEmailQueuedAt && currentStatus === 'Prospect froid') {
      return 'Prospect froid';
    }

    if (currentStatus === 'Prospect informations manquantes' || !currentStatus) {
      return 'Prospect froid';
    }

    return currentStatus;
  }

  async startProspectStatusRecalculation() {
    await this.ensureProspectStatusRecalcTable();

    const prospects = await this.prisma.prospect.findMany({
      where: { trashedAt: null },
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    if (prospects.length === 0) {
      return {
        run: await this.getProspectStatusRecalcStatus(),
        queued: 0,
      };
    }

    const current = await this.getProspectStatusRecalcStatus();
    if (current.status === 'queued' || current.status === 'running') {
      throw new BadRequestException('Un recalcul de statut est déjà en cours.');
    }

    await this.prisma.$executeRawUnsafe(
      `
        INSERT INTO "prospect_status_recalc_runs" (
          "status",
          "total_prospects",
          "processed_prospects",
          "running_prospects",
          "pending_prospects",
          "queued_at",
          "started_at",
          "finished_at",
          "last_error",
          "current_prospect_id",
          "updated_at"
        ) VALUES (?, ?, 0, 0, ?, CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP)
      `,
      'queued',
      prospects.length,
      prospects.length,
    );

    const runRows = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM "prospect_status_recalc_runs" ORDER BY "id" DESC LIMIT 1',
    );
    const run = this.dbRowToProspectStatusRecalcStatus(runRows[0]);
    const jobs = prospects.map((prospect, index) => ({
      name: `prospect-${prospect.id}`,
      data: {
        runId: run.id,
        prospectId: prospect.id,
        position: index + 1,
        total: prospects.length,
      },
      opts: {
        jobId: `prospect-status-recalc:${run.id}:${prospect.id}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    }));

    await this.prospectStatusRecalcQueue.addBulk(jobs);
    await this.emitProspectStatusRecalcEvent('prospect-status-recalc.queued');

    return {
      run,
      queued: jobs.length,
    };
  }

  async markProspectStatusRecalcJobStarted(runId: number, prospectId: number) {
    await this.ensureProspectStatusRecalcTable();

    await this.prisma.$executeRawUnsafe(
      `
        UPDATE "prospect_status_recalc_runs"
        SET
          "status" = CASE WHEN "status" = 'queued' THEN 'running' ELSE "status" END,
          "started_at" = COALESCE("started_at", CURRENT_TIMESTAMP),
          "running_prospects" = COALESCE("running_prospects", 0) + 1,
          "pending_prospects" = CASE WHEN "pending_prospects" > 0 THEN "pending_prospects" - 1 ELSE 0 END,
          "current_prospect_id" = ?,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = ?
      `,
      prospectId,
      runId,
    );

    await this.emitProspectStatusRecalcEvent('prospect-status-recalc.updated');
  }

  async markProspectStatusRecalcJobFinished(runId: number, errorMessage?: string | null) {
    await this.ensureProspectStatusRecalcTable();

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT "pending_prospects", "running_prospects" FROM "prospect_status_recalc_runs" WHERE "id" = ? LIMIT 1',
      runId,
    );
    const row = rows[0];
    const pendingProspects = Number(row?.pending_prospects || 0);
    const runningProspects = Number(row?.running_prospects || 0);
    const isCompleted = pendingProspects <= 0 && runningProspects <= 1;

    await this.prisma.$executeRawUnsafe(
      `
        UPDATE "prospect_status_recalc_runs"
        SET
          "status" = ?,
          "processed_prospects" = COALESCE("processed_prospects", 0) + 1,
          "running_prospects" = CASE WHEN "running_prospects" > 0 THEN "running_prospects" - 1 ELSE 0 END,
          "current_prospect_id" = NULL,
          "last_error" = COALESCE(?, "last_error"),
          "finished_at" = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE "finished_at" END,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = ?
      `,
      isCompleted ? 'completed' : 'running',
      errorMessage || null,
      isCompleted ? 1 : 0,
      runId,
    );

    await this.emitProspectStatusRecalcEvent(isCompleted ? 'prospect-status-recalc.completed' : 'prospect-status-recalc.updated');
  }

  async recalculateProspectStatusFromProspectId(prospectId: number) {
    const prospect = await this.prisma.prospect.findUnique({
      where: { id: prospectId },
      select: {
        id: true,
        status: true,
        email: true,
        firstContactEmailSentAt: true,
        firstContactEmailQueuedAt: true,
        quoteSentAt: true,
        contractSignedAt: true,
      },
    });

    if (!prospect) {
      throw new NotFoundException(`Prospect introuvable: ${prospectId}`);
    }

    const nextStatus = this.deriveProspectStatusFromDb(prospect);

    await this.prisma.prospect.updateMany({
      where: {
        id: prospectId,
        trashedAt: null,
      },
      data: {
        status: nextStatus as any,
      },
    });

    return {
      prospectId,
      status: nextStatus,
    };
  }

  async relaunchProspect(id: number) {
    return this.sendEmail(id, {});
  }

  async relaunchProspects(ids?: number[]) {
    const candidates = ids && ids.length > 0 ? ids : (await this.listProspectsToRelaunch()).map((prospect) => prospect.id);
    const uniqueIds = [...new Set(candidates.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];

    const results = [];

    for (const prospectId of uniqueIds) {
      try {
        await this.sendEmail(prospectId, {});
        results.push({ prospectId, queued: true });
      } catch (error) {
        results.push({
          prospectId,
          queued: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        });
      }
    }

    return {
      total: uniqueIds.length,
      queued: results.filter((result) => result.queued).length,
      failed: results.filter((result) => !result.queued).length,
      results,
    };
  }

  private serializeProspectRow(row: any) {
    if (!row) {
      return row;
    }

    const socialLinks = row.social_links_json || row.socialLinksJson || '[]';

    return {
      id: Number(row.id),
      urlId: row.url_id == null ? null : Number(row.url_id),
      name: row.name,
      siteName: row.site_name,
      sourceUrl: row.source_url,
      sourceFile: row.source_file,
      status: row.status,
      leadScore: Number(row.lead_score || 0),
      email: row.email,
      phone: row.phone,
      linkedinUrl: row.linkedin_url,
      linkedinImageUrl: row.linkedin_image_url,
      avatarUrl: row.avatar_url,
      owner: row.owner,
      lastName: row.last_name ?? row.contact_last_name ?? null,
      siret: row.siret ?? row.contact_siret ?? null,
      siren: row.siren ?? row.contact_siren ?? null,
      companyName: row.company_name ?? row.contact_company_name ?? null,
      companyAddress: row.company_address ?? row.contact_company_address ?? null,
      companyAddressExtra: row.company_address_extra ?? row.contact_company_address_extra ?? null,
      companyPostalCode: row.company_postal_code ?? row.contact_company_postal_code ?? null,
      companyCity: row.company_city ?? row.contact_company_city ?? null,
      companyLegalForm: row.company_legal_form ?? row.contact_company_legal_form ?? null,
      companyCountry: row.company_country ?? row.contact_company_country ?? null,
      companyLinkedinUrl: row.company_linkedin_url ?? row.contact_company_linkedin_url ?? null,
      lastChecked: row.last_checked,
      evidence: row.evidence,
      score: Number(row.score || 0),
      firstName: row.first_name,
      socialLinksJson: socialLinks,
      contactStatus: row.contact_status ?? null,
      contactCheckedAt: row.contact_checked_at ?? null,
      contactEmail: row.email ?? row.contact_email ?? null,
      contactPhone: row.phone ?? row.contact_phone ?? null,
      contactSiret: row.siret ?? row.contact_siret ?? null,
      contactSiren: row.siren ?? row.contact_siren ?? null,
      contactFirstName: row.first_name ?? row.contact_first_name ?? null,
      contactLastName: row.last_name ?? row.contact_last_name ?? null,
      contactOwnerName: row.owner ?? row.contact_owner_name ?? null,
      contactCompanyName: row.company_name ?? row.contact_company_name ?? null,
      contactCompanyAddress: row.company_address ?? row.contact_company_address ?? null,
      contactCompanyAddressExtra: row.company_address_extra ?? row.contact_company_address_extra ?? null,
      contactCompanyPostalCode: row.company_postal_code ?? row.contact_company_postal_code ?? null,
      contactCompanyCity: row.company_city ?? row.contact_company_city ?? null,
      contactCompanyLegalForm: row.company_legal_form ?? row.contact_company_legal_form ?? null,
      contactCompanyCountry: row.company_country ?? row.contact_company_country ?? null,
      contactSourceUrl: row.source_url ?? row.contact_source_url ?? null,
      contactEvidence: row.evidence ?? row.contact_evidence ?? null,
      contactLinkedinUrl: row.linkedin_url ?? row.contact_linkedin_url ?? null,
      contactCompanyLinkedinUrl: row.company_linkedin_url ?? row.contact_company_linkedin_url ?? null,
      contactSocialLinksJson: row.social_links_json ?? row.contact_social_links_json ?? null,
      firstContactEmailSentAt: row.first_contact_email_sent_at,
      firstContactEmailQueuedAt: row.first_contact_email_queued_at,
      firstContactEmailSubject: row.first_contact_email_subject,
      firstContactEmailBody: row.first_contact_email_body,
      quoteFileName: row.quote_file_name,
      quoteSentAt: row.quote_sent_at,
      contractFileName: row.contract_file_name,
      contractSentAt: row.contract_sent_at,
      contractSignedAt: row.contract_signed_at,
      magifyTicketId: row.magify_ticket_id ?? null,
      magifyTicketUrl: row.magify_ticket_url ?? null,
      trashedAt: row.trashed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      url: row.url_url
        ? {
            url: row.url_url,
            siteName: row.url_site_name ?? null,
            siteKey: row.url_site_key ?? null,
            sourceFile: row.url_source_file ?? null,
            createdAt: row.url_created_at ?? null,
            shopifyStatus: row.url_shopify_status,
            shopifyCheckedAt: row.url_shopify_checked_at ?? null,
            httpStatus: row.url_http_status ?? null,
            redesignStatus: row.url_redesign_status,
            redesignDecision: row.url_redesign_decision,
            shopifyThemeSchemaName: row.url_shopify_theme_schema_name,
            shopifyThemeName: row.url_shopify_theme_name,
            shopifyThemeStoreType: row.url_shopify_theme_store_type,
            shopifyThemeId: row.url_shopify_theme_id ?? null,
            shopifyThemeJson: row.url_shopify_theme_json ?? null,
            siteCountryCode: row.url_site_country_code ?? null,
            siteCountryName: row.url_site_country_name ?? null,
            siteLanguageCode: row.url_site_language_code ?? null,
            siteLanguageName: row.url_site_language_name ?? null,
            rescanRequestedAt: row.url_rescan_requested_at ?? null,
            shopifyLegalNoticeStatus: row.url_shopify_legal_notice_status ?? null,
            shopifyLegalNoticeUrl: row.url_shopify_legal_notice_url ?? null,
            shopifyLegalNoticeCheckedAt: row.url_shopify_legal_notice_checked_at ?? null,
            scanTotalMs: row.url_scan_total_ms == null ? null : Number(row.url_scan_total_ms),
            scanTtfbMs: row.url_scan_ttfb_ms == null ? null : Number(row.url_scan_ttfb_ms),
            scanHtmlBytes: row.url_scan_html_bytes == null ? null : Number(row.url_scan_html_bytes),
            productCount: row.url_product_count == null ? null : Number(row.url_product_count),
            medianProductPrice: row.url_median_product_price == null ? null : Number(row.url_median_product_price),
            catalogCheckedAt: row.url_catalog_checked_at,
            giftCardDetected: Boolean(row.url_gift_card_detected),
            cmsName: row.url_cms_name,
            contactStatus: row.contact_status ?? null,
            contactCheckedAt: row.contact_checked_at ?? null,
            contactEmail: row.contact_email ?? null,
            contactPhone: row.contact_phone ?? null,
            contactSiret: row.contact_siret ?? null,
            contactSiren: row.contact_siren ?? null,
            contactFirstName: row.contact_first_name ?? null,
            contactLastName: row.contact_last_name ?? null,
            contactOwnerName: row.contact_owner_name ?? null,
            contactCompanyName: row.contact_company_name ?? null,
            contactCompanyAddress: row.contact_company_address ?? null,
            contactCompanyAddressExtra: row.contact_company_address_extra ?? null,
            contactCompanyPostalCode: row.contact_company_postal_code ?? null,
            contactCompanyCity: row.contact_company_city ?? null,
            contactCompanyLegalForm: row.contact_company_legal_form ?? null,
            contactCompanyCountry: row.contact_company_country ?? null,
            contactSourceUrl: row.contact_source_url ?? null,
            contactEvidence: row.contact_evidence ?? null,
            contactLinkedinUrl: row.contact_linkedin_url ?? null,
            contactCompanyLinkedinUrl: row.contact_company_linkedin_url ?? null,
            contactSocialLinksJson: row.contact_social_links_json ?? null,
            trashedAt: row.url_trashed_at ?? null,
            blacklistedAt: row.url_blacklisted_at ?? null,
            lighthouseCheckedAt: row.url_lighthouse_checked_at,
            lighthouseScore:
              row.url_lighthouse_score == null
                ? null
                : Number(row.url_lighthouse_score),
            lighthousePerformanceScore:
              row.url_lighthouse_performance_score == null
                ? null
                : Number(row.url_lighthouse_performance_score),
            lighthouseAccessibilityScore:
              row.url_lighthouse_accessibility_score == null
                ? null
                : Number(row.url_lighthouse_accessibility_score),
            lighthouseBestPracticesScore:
              row.url_lighthouse_best_practices_score == null
                ? null
                : Number(row.url_lighthouse_best_practices_score),
            lighthouseSeoScore:
              row.url_lighthouse_seo_score == null
                ? null
                : Number(row.url_lighthouse_seo_score),
            lighthouseReportJson: row.url_lighthouse_report_json ?? null,
            lighthouseObservationsJson: row.url_lighthouse_observations_json,
          }
        : null,
    };
  }

  private getProjectedValue(source: Record<string, unknown>, path: string[]) {
    let current: any = source;

    for (const segment of path) {
      if (current == null || typeof current !== 'object' || !(segment in current)) {
        return undefined;
      }

      current = current[segment];
    }

    return current;
  }

  private setProjectedValue(target: Record<string, unknown>, path: string[], value: unknown) {
    if (path.length === 0) {
      return;
    }

    if (path.length === 1) {
      target[path[0]] = value;
      return;
    }

    const [head, ...rest] = path;
    const existing = target[head];

    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      target[head] = {};
    }

    this.setProjectedValue(target[head] as Record<string, unknown>, rest, value);
  }

  private projectProspectRow(item: Record<string, unknown>, fields?: ProspectListField[]) {
    if (!fields || fields.length === 0) {
      return item;
    }

    const projected: Record<string, unknown> = {};
    for (const field of new Set(fields.map((value) => String(value || '').trim()).filter(Boolean))) {
      const path = field.split('.').filter(Boolean);
      if (path.length === 0) {
        continue;
      }

      const value = this.getProjectedValue(item, path);
      if (value !== undefined) {
        this.setProjectedValue(projected, path, value);
      }
    }

    return projected;
  }

  private async ensureProspectsTable() {
    if (this.prospectsTableReady) {
      return;
    }

    await ensureProspectsTableExists(this.prisma);

    const columns = await getTableColumnNames(this.prisma, 'prospects');

    if (!columns.includes('trashed_at')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "prospects" ADD COLUMN "trashed_at" TIMESTAMPTZ',
      );
    }

    if (!columns.includes('linkedin_image_url')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "prospects" ADD COLUMN "linkedin_image_url" TEXT',
      );
    }

    if (!columns.includes('avatar_url')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "prospects" ADD COLUMN "avatar_url" TEXT',
      );
    }

    if (!columns.includes('magify_ticket_id')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "prospects" ADD COLUMN "magify_ticket_id" TEXT',
      );
    }

    if (!columns.includes('magify_ticket_url')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "prospects" ADD COLUMN "magify_ticket_url" TEXT',
      );
    }

    const contactColumns = [
      ['contact_status', 'TEXT NOT NULL DEFAULT \'unknown\''],
      ['contact_checked_at', 'TIMESTAMPTZ'],
      ['last_name', 'TEXT'],
      ['siret', 'TEXT'],
      ['siren', 'TEXT'],
      ['company_name', 'TEXT'],
      ['company_address', 'TEXT'],
      ['company_address_extra', 'TEXT'],
      ['company_postal_code', 'TEXT'],
      ['company_city', 'TEXT'],
      ['company_legal_form', 'TEXT'],
      ['company_country', 'TEXT'],
      ['company_linkedin_url', 'TEXT'],
    ] as const;

    for (const [name, type] of contactColumns) {
      if (!columns.includes(name)) {
        await this.prisma.$executeRawUnsafe(
          `ALTER TABLE "prospects" ADD COLUMN "${name}" ${type}`,
        );
      }
    }

    const processColumns = [
      ['first_contact_email_queued_at', 'TIMESTAMPTZ'],
      ['first_contact_email_sent_at', 'TIMESTAMPTZ'],
      ['first_contact_email_subject', 'TEXT'],
      ['first_contact_email_body', 'TEXT'],
      ['email_send_count', 'INTEGER NOT NULL DEFAULT 0'],
      ['quote_file_name', 'TEXT'],
      ['quote_sent_at', 'TIMESTAMPTZ'],
      ['contract_file_name', 'TEXT'],
      ['contract_sent_at', 'TIMESTAMPTZ'],
      ['contract_signed_at', 'TIMESTAMPTZ'],
    ] as const;

    for (const [name, type] of processColumns) {
      if (!columns.includes(name)) {
        await this.prisma.$executeRawUnsafe(
          `ALTER TABLE "prospects" ADD COLUMN "${name}" ${type}`,
        );
      }
    }

    this.prospectsTableReady = true;
  }

  private buildProspectFilters(options: { status?: string; search?: string; positioning?: string; hideQueuedEmails?: boolean } = {}) {
    const normalizedStatus =
      options.status && PROSPECT_STATUSES.includes(options.status as (typeof PROSPECT_STATUSES)[number])
        ? options.status
        : undefined;
    const normalizedSearch = options.search?.trim().toLowerCase();
    const normalizedPositioning = options.positioning?.trim().toLowerCase();
    const conditions: string[] = ['p.trashed_at IS NULL'];

    if (normalizedStatus) {
      conditions.push(`p.status = ${this.sqlLiteral(normalizedStatus)}`);
    }

    if (normalizedSearch) {
      const like = `%${normalizedSearch}%`;
      conditions.push(`
        (
          LOWER(COALESCE(p.name, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(p.site_name, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(u.url, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(u.site_name, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(p.status, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(p.owner, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(p.email, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(p.phone, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(p.linkedin_url, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(p.source_url, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(p.source_file, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(p.evidence, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(p.first_name, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(p.last_name, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(p.siret, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(p.siren, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(p.company_name, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(p.company_address, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(p.company_address_extra, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(p.company_postal_code, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(p.company_city, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(p.company_legal_form, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(p.company_country, '')) LIKE ${this.sqlLiteral(like)}
          OR LOWER(COALESCE(p.company_linkedin_url, '')) LIKE ${this.sqlLiteral(like)}
        )
      `);
    }

    if (normalizedPositioning && normalizedPositioning !== 'all') {
      if (normalizedPositioning === 'refonte') {
        conditions.push(`LOWER(COALESCE(u.redesign_status, '')) = ${this.sqlLiteral('candidat refonte')}`);
      } else if (normalizedPositioning === 'migration') {
        conditions.push(`LOWER(COALESCE(u.redesign_status, '')) = ${this.sqlLiteral('candidat migration')}`);
      } else if (normalizedPositioning === 'support') {
        conditions.push(
          `LOWER(COALESCE(u.redesign_status, '')) NOT IN (${this.sqlLiteral('candidat refonte')}, ${this.sqlLiteral('candidat migration')})`,
        );
      }
    }

    if (options.hideQueuedEmails) {
      conditions.push('NOT (p.first_contact_email_queued_at IS NOT NULL AND p.first_contact_email_sent_at IS NULL)');
    }

    return {
      whereSql: conditions.join('\n        AND '),
      normalizedStatus,
      normalizedSearch,
    };
  }

  private sqlLiteral(value: unknown) {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }

    return `'${String(value).replace(/'/g, "''")}'`;
  }

  async listProspects(options: { status?: string; search?: string; positioning?: string; hideQueuedEmails?: boolean; page?: number; limit?: number; all?: boolean; fields?: ProspectListField[] } = {}): Promise<ProspectListResponse> {
    await this.ensureProspectsTable();

    const { whereSql } = this.buildProspectFilters({
      status: options.status,
      search: options.search,
      positioning: options.positioning,
      hideQueuedEmails: options.hideQueuedEmails,
    });

    const countRows = await this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `
      SELECT COUNT(*) AS total
      FROM "prospects" p
      LEFT JOIN "urls" u ON u.id = p.url_id
      WHERE ${whereSql}
      `,
    );

    const total = Number(countRows[0]?.total || 0);
    const page = options.all ? 1 : Math.max(1, Math.floor(options.page || 1));
    const limit = options.all ? Math.max(1, total || 1) : Math.min(200, Math.max(10, Math.floor(options.limit || 20)));
    const offset = (page - 1) * limit;

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        p.*,
        u.url AS url_url,
        u.shopify_status AS url_shopify_status,
        u.redesign_status AS url_redesign_status,
        u.redesign_decision AS url_redesign_decision,
        u.shopify_theme_store_type AS url_shopify_theme_store_type,
        u.shopify_theme_schema_name AS url_shopify_theme_schema_name,
        u.shopify_theme_name AS url_shopify_theme_name,
        u.scan_total_ms AS url_scan_total_ms,
        u.scan_ttfb_ms AS url_scan_ttfb_ms,
        u.scan_html_bytes AS url_scan_html_bytes,
        u.cms_name AS url_cms_name,
        u.lighthouse_checked_at AS url_lighthouse_checked_at,
        u.lighthouse_score AS url_lighthouse_score,
        u.lighthouse_performance_score AS url_lighthouse_performance_score,
        u.lighthouse_accessibility_score AS url_lighthouse_accessibility_score,
        u.lighthouse_best_practices_score AS url_lighthouse_best_practices_score,
        u.lighthouse_seo_score AS url_lighthouse_seo_score,
        u.lighthouse_observations_json AS url_lighthouse_observations_json
      FROM "prospects" p
      LEFT JOIN "urls" u ON u.id = p.url_id
      LEFT JOIN "site_qualifications" sq ON sq.url_id = p.url_id
      WHERE ${whereSql}
      ORDER BY COALESCE(p.lead_score, 0) DESC, p.id ASC
      LIMIT ${this.sqlLiteral(limit)}
      OFFSET ${this.sqlLiteral(offset)}
      `,
    );

    return {
      items: rows.map((row) => this.projectProspectRow(this.serializeProspectRow(row), options.fields)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async countProspects(status?: string, search?: string, hideQueuedEmails?: boolean) {
    await this.ensureProspectsTable();

    const { whereSql } = this.buildProspectFilters({
      status,
      search,
      hideQueuedEmails,
    });

    const rows = await this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `
      SELECT COUNT(*) AS total
      FROM "prospects" p
      LEFT JOIN "urls" u ON u.id = p.url_id
      LEFT JOIN "site_qualifications" sq ON sq.url_id = p.url_id
      WHERE ${whereSql}
      `,
    );

    return { total: Number(rows[0]?.total || 0) };
  }

  async countProspectsByStatus(search?: string): Promise<ProspectCountsResponse> {
    await this.ensureProspectsTable();

    const { whereSql } = this.buildProspectFilters({
      search,
    });

    const totalRows = await this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `
      SELECT COUNT(*) AS total
      FROM "prospects" p
      LEFT JOIN "urls" u ON u.id = p.url_id
      LEFT JOIN "site_qualifications" sq ON sq.url_id = p.url_id
      WHERE ${whereSql}
      `,
    );

    const rows = await this.prisma.$queryRawUnsafe<Array<{ status: string | null; total: number }>>(
      `
      SELECT
        p.status AS status,
        COUNT(*) AS total
      FROM "prospects" p
      LEFT JOIN "urls" u ON u.id = p.url_id
      LEFT JOIN "site_qualifications" sq ON sq.url_id = p.url_id
      WHERE ${whereSql}
      GROUP BY p.status
      ORDER BY p.status ASC
      `,
    );

    return {
      total: Number(totalRows[0]?.total || 0),
      counts: PROSPECT_STATUSES.map((status) => ({
        status,
        total: Number(rows.find((row) => row.status === status)?.total || 0),
      })),
    };
  }

  async listProspectsByUrlIds(urlIds: number[]) {
    await this.ensureProspectsTable();
    await this.syncFromUrls();

    const normalizedIds = [...new Set(
      (urlIds || [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    )];

    if (normalizedIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        p.*,
        u.url AS url_url,
        u.shopify_status AS url_shopify_status,
        u.redesign_status AS url_redesign_status,
        u.redesign_decision AS url_redesign_decision,
        u.shopify_theme_schema_name AS url_shopify_theme_schema_name,
        u.shopify_theme_name AS url_shopify_theme_name,
        u.scan_total_ms AS url_scan_total_ms,
        u.scan_ttfb_ms AS url_scan_ttfb_ms,
        u.scan_html_bytes AS url_scan_html_bytes,
        u.cms_name AS url_cms_name,
        u.lighthouse_checked_at AS url_lighthouse_checked_at,
        u.lighthouse_score AS url_lighthouse_score,
        u.lighthouse_performance_score AS url_lighthouse_performance_score,
        u.lighthouse_accessibility_score AS url_lighthouse_accessibility_score,
        u.lighthouse_best_practices_score AS url_lighthouse_best_practices_score,
        u.lighthouse_seo_score AS url_lighthouse_seo_score,
        u.lighthouse_observations_json AS url_lighthouse_observations_json
      FROM "prospects" p
      LEFT JOIN "urls" u ON u.id = p.url_id
      WHERE p.trashed_at IS NULL
        AND p.url_id IN (${normalizedIds.map((id) => this.sqlLiteral(id)).join(', ')})
      ORDER BY p.id ASC
      `,
    );

    return rows.map((row) => this.serializeProspectRow(row));
  }

  async listTrashedProspects(fields?: ProspectListField[]) {
    await this.ensureProspectsTable();
    await this.syncFromUrls();

    const rows = await this.prisma.prospect.findMany({
      where: {
        trashedAt: { not: null },
      },
      orderBy: [{ trashedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        name: true,
        siteName: true,
        sourceFile: true,
        status: true,
        leadScore: true,
        score: true,
        trashedAt: true,
        createdAt: true,
        url: {
          select: {
            url: true,
            shopifyStatus: true,
            cmsName: true,
            shopifyThemeSchemaName: true,
            redesignStatus: true,
          },
        },
      },
    });

    return rows.map((row: any) => ({
      id: row.id,
      name: row.name ?? '',
      siteName: row.siteName ?? '',
      sourceFile: row.sourceFile,
      status: row.status,
      leadScore: row.leadScore,
      score: row.score,
      trashedAt: row.trashedAt,
      createdAt: row.createdAt,
      url: row.url
        ? {
            url: row.url.url,
            shopifyStatus: row.url.shopifyStatus,
            cmsName: row.url.cmsName,
            shopifyThemeSchemaName: row.url.shopifyThemeSchemaName,
            redesignStatus: row.url.redesignStatus,
          }
        : null,
    }));
  }

  async syncFromUrls() {
    await this.ensureProspectsTable();
    const urls = await this.prisma.url.findMany({
      where: {
        trashedAt: null,
        prospect: { isNot: null },
      },
      include: {
        prospect: {
          select: {
            contactStatus: true,
            contactCheckedAt: true,
            email: true,
            phone: true,
            siret: true,
            siren: true,
            firstName: true,
            lastName: true,
            owner: true,
            companyName: true,
            companyAddress: true,
            companyAddressExtra: true,
            companyPostalCode: true,
            companyCity: true,
            companyLegalForm: true,
            companyCountry: true,
            sourceUrl: true,
            evidence: true,
            linkedinUrl: true,
            companyLinkedinUrl: true,
            socialLinksJson: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
    const leadScoreSettings = await this.siteSettingsService.getLeadScoreSettings();

    for (const row of urls) {
      if (row.prospect?.contactStatus !== 'found') {
        continue;
      }

      const trashedProspect = await this.prisma.$queryRawUnsafe<any[]>(
        'SELECT "id" FROM "prospects" WHERE "url_id" = ? AND "trashed_at" IS NOT NULL LIMIT 1',
        row.id,
      );

      if (trashedProspect[0]) {
        continue;
      }

      const contact = row.prospect;
      const nameParts = [contact?.firstName, contact?.lastName].filter(Boolean);
      const name =
        nameParts.join(' ').trim() ||
        contact?.companyName ||
        row.siteName ||
        row.url;
      const siteName = contact?.companyName || row.siteName || row.siteKey || row.url;
      const score =
        [
          contact?.email,
          contact?.phone,
          contact?.owner,
          contact?.companyName,
          contact?.linkedinUrl,
          contact?.companyLinkedinUrl,
        ].filter(Boolean).length * 16;
      const leadScore = computeLeadScore(row, leadScoreSettings);
      const socialLinks = JSON.parse(contact?.socialLinksJson || '[]');

      await this.upsertFromContactResult(row.id, {
        name,
        siteName,
        sourceUrl: contact?.sourceUrl || row.url,
        sourceFile: row.sourceFile,
        contactStatus: contact?.contactStatus || 'found',
        contactCheckedAt: contact?.contactCheckedAt ? new Date(contact.contactCheckedAt) : null,
        email: contact?.email || null,
        phone: contact?.phone || null,
        siret: contact?.siret || null,
        siren: contact?.siren || null,
        companyName: contact?.companyName || null,
        companyAddress: contact?.companyAddress || null,
        companyAddressExtra: contact?.companyAddressExtra || null,
        companyPostalCode: contact?.companyPostalCode || null,
        companyCity: contact?.companyCity || null,
        companyLegalForm: contact?.companyLegalForm || null,
        companyCountry: contact?.companyCountry || null,
        linkedinUrl: contact?.linkedinUrl || contact?.companyLinkedinUrl || null,
        companyLinkedinUrl: contact?.companyLinkedinUrl || null,
        owner: contact?.owner || null,
        lastName: contact?.lastName || null,
        lastChecked: contact?.contactCheckedAt ? new Date(contact.contactCheckedAt) : null,
        evidence: contact?.evidence || null,
        score: Math.min(100, score),
        leadScore,
        firstName: contact?.firstName || null,
        socialLinks,
      });
    }
  }

  async getProspect(id: number) {
    await this.ensureProspectsTable();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        p.id,
        p.url_id,
        p.name,
        p.site_name,
        p.source_url,
        p.source_file,
        p.status,
        p.lead_score,
        p.email,
        p.phone,
        p.linkedin_url,
        p.linkedin_image_url,
        p.avatar_url,
        p.owner,
        p.last_name,
        p.siret,
        p.siren,
        p.company_name,
        p.company_address,
        p.company_address_extra,
        p.company_postal_code,
        p.company_city,
        p.company_legal_form,
        p.company_country,
        p.company_linkedin_url,
        p.last_checked,
        p.evidence,
        p.score,
        p.first_name,
        p.contact_status,
        p.contact_checked_at,
        p.social_links_json,
        p.first_contact_email_sent_at,
        p.first_contact_email_queued_at,
        p.first_contact_email_subject,
        p.first_contact_email_body,
        p.quote_file_name,
        p.quote_sent_at,
        p.contract_file_name,
        p.contract_sent_at,
        p.contract_signed_at,
        p.trashed_at,
        p.created_at,
        p.updated_at,
        u.url AS url_url,
        u.site_name AS url_site_name,
        u.site_key AS url_site_key,
        u.source_file AS url_source_file,
        u.created_at AS url_created_at,
        u.shopify_status AS url_shopify_status,
        u.shopify_checked_at AS url_shopify_checked_at,
        u.http_status AS url_http_status,
        u.redesign_status AS url_redesign_status,
        u.redesign_decision AS url_redesign_decision,
        u.shopify_theme_schema_name AS url_shopify_theme_schema_name,
        u.shopify_theme_name AS url_shopify_theme_name,
        u.shopify_theme_id AS url_shopify_theme_id,
        u.shopify_theme_json AS url_shopify_theme_json,
        u.site_country_code AS url_site_country_code,
        u.site_country_name AS url_site_country_name,
        u.site_language_code AS url_site_language_code,
        u.site_language_name AS url_site_language_name,
        u.rescan_requested_at AS url_rescan_requested_at,
        u.shopify_legal_notice_status AS url_shopify_legal_notice_status,
        u.shopify_legal_notice_url AS url_shopify_legal_notice_url,
        u.shopify_legal_notice_checked_at AS url_shopify_legal_notice_checked_at,
        u.scan_total_ms AS url_scan_total_ms,
        u.scan_ttfb_ms AS url_scan_ttfb_ms,
        u.scan_html_bytes AS url_scan_html_bytes,
        u.cms_name AS url_cms_name,
        u.trashed_at AS url_trashed_at,
        u.blacklisted_at AS url_blacklisted_at,
        u.lighthouse_checked_at AS url_lighthouse_checked_at,
        u.lighthouse_score AS url_lighthouse_score,
        u.lighthouse_performance_score AS url_lighthouse_performance_score,
        u.lighthouse_accessibility_score AS url_lighthouse_accessibility_score,
        u.lighthouse_best_practices_score AS url_lighthouse_best_practices_score,
        u.lighthouse_seo_score AS url_lighthouse_seo_score,
        u.lighthouse_report_json AS url_lighthouse_report_json,
        u.lighthouse_observations_json AS url_lighthouse_observations_json
      FROM "prospects" p
      LEFT JOIN "urls" u ON u.id = p.url_id
      WHERE p.id = ? AND p.trashed_at IS NULL
      LIMIT 1
      `,
      id,
    );
    const prospect = this.serializeProspectRow(rows[0]);

    if (!prospect) {
      throw new NotFoundException(`Prospect introuvable: ${id}`);
    }

    if (prospect.urlId) {
      prospect.url = {
        ...(prospect.url || {}),
        qualification: await loadSiteQualification(this.prisma, prospect.urlId),
      };
    }

    return prospect;
  }

  async getProspectByUrlId(urlId: number) {
    await this.ensureProspectsTable();

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        p.*,
        u.url AS url_url,
        u.site_name AS url_site_name,
        u.site_key AS url_site_key,
        u.source_file AS url_source_file,
        u.created_at AS url_created_at,
        u.shopify_status AS url_shopify_status,
        u.shopify_checked_at AS url_shopify_checked_at,
        u.http_status AS url_http_status,
        u.redesign_status AS url_redesign_status,
        u.redesign_decision AS url_redesign_decision,
        u.shopify_theme_schema_name AS url_shopify_theme_schema_name,
        u.shopify_theme_name AS url_shopify_theme_name,
        u.shopify_theme_id AS url_shopify_theme_id,
        u.shopify_theme_json AS url_shopify_theme_json,
        u.site_country_code AS url_site_country_code,
        u.site_country_name AS url_site_country_name,
        u.site_language_code AS url_site_language_code,
        u.site_language_name AS url_site_language_name,
        u.rescan_requested_at AS url_rescan_requested_at,
        u.shopify_legal_notice_status AS url_shopify_legal_notice_status,
        u.shopify_legal_notice_url AS url_shopify_legal_notice_url,
        u.shopify_legal_notice_checked_at AS url_shopify_legal_notice_checked_at,
        u.scan_total_ms AS url_scan_total_ms,
        u.scan_ttfb_ms AS url_scan_ttfb_ms,
        u.scan_html_bytes AS url_scan_html_bytes,
        u.cms_name AS url_cms_name,
        u.trashed_at AS url_trashed_at,
        u.blacklisted_at AS url_blacklisted_at,
        u.lighthouse_checked_at AS url_lighthouse_checked_at,
        u.lighthouse_score AS url_lighthouse_score,
        u.lighthouse_performance_score AS url_lighthouse_performance_score,
        u.lighthouse_accessibility_score AS url_lighthouse_accessibility_score,
        u.lighthouse_best_practices_score AS url_lighthouse_best_practices_score,
        u.lighthouse_seo_score AS url_lighthouse_seo_score,
        u.lighthouse_report_json AS url_lighthouse_report_json,
        u.lighthouse_observations_json AS url_lighthouse_observations_json
      FROM "prospects" p
      LEFT JOIN "urls" u ON u.id = p.url_id
      WHERE p.url_id = ? AND p.trashed_at IS NULL
      ORDER BY p.id ASC
      LIMIT 1
      `,
      urlId,
    );

    const prospect = rows[0] ? this.serializeProspectRow(rows[0]) : null;

    if (prospect?.urlId) {
      prospect.url = {
        ...(prospect.url || {}),
        qualification: await loadSiteQualification(this.prisma, prospect.urlId),
      };
    }

    return prospect;
  }

  async upsertFromContactResult(urlId: number, payload: {
    name: string;
    siteName: string;
    sourceUrl: string;
    sourceFile: string;
    contactStatus: string;
    contactCheckedAt: Date | null;
    email: string | null;
    phone: string | null;
    siret: string | null;
    siren: string | null;
    companyName: string | null;
    companyAddress: string | null;
    companyAddressExtra: string | null;
    companyPostalCode: string | null;
    companyCity: string | null;
    companyLegalForm: string | null;
    companyCountry: string | null;
    linkedinUrl: string | null;
    companyLinkedinUrl?: string | null;
    linkedinImageUrl?: string | null;
    avatarUrl?: string | null;
    owner: string | null;
    lastChecked: Date | null;
    evidence: string | null;
    score: number;
    leadScore: number;
    firstName: string | null;
    socialLinks: string[];
    lastName?: string | null;
  }) {
    await this.ensureProspectsTable();
    const previousRows = await this.prisma.$queryRawUnsafe<Array<{ status: string | null; email: string | null }>>(
      'SELECT "status", "email" FROM "prospects" WHERE "url_id" = ? LIMIT 1',
      urlId,
    );
    const previousStatus = previousRows[0]?.status || null;
    const resolvedEmail = payload.email ?? previousRows[0]?.email ?? null;
    const nextStatus = resolvedEmail ? undefined : 'Prospect informations manquantes';
    const prospect = await this.prisma.prospect.upsert({
      where: { urlId },
      create: {
        urlId,
        name: payload.name,
        siteName: payload.siteName,
        sourceUrl: payload.sourceUrl,
        sourceFile: payload.sourceFile,
        ...(nextStatus ? { status: nextStatus as any } : {}),
        contactStatus: payload.contactStatus,
        contactCheckedAt: payload.contactCheckedAt,
        email: resolvedEmail,
        phone: payload.phone,
        siret: payload.siret,
        siren: payload.siren,
        firstName: payload.firstName,
        lastName: payload.lastName ?? payload.owner,
        owner: payload.owner,
        companyName: payload.companyName,
        companyAddress: payload.companyAddress,
        companyAddressExtra: payload.companyAddressExtra,
        companyPostalCode: payload.companyPostalCode,
        companyCity: payload.companyCity,
        companyLegalForm: payload.companyLegalForm,
        companyCountry: payload.companyCountry,
        companyLinkedinUrl: payload.companyLinkedinUrl || payload.linkedinUrl,
        linkedinUrl: payload.linkedinUrl,
        lastChecked: payload.lastChecked,
        evidence: payload.evidence,
        score: payload.score,
        leadScore: payload.leadScore,
        socialLinksJson: JSON.stringify(payload.socialLinks || []),
      },
      update: {
        name: payload.name,
        siteName: payload.siteName,
        sourceUrl: payload.sourceUrl,
        sourceFile: payload.sourceFile,
        ...(nextStatus ? { status: nextStatus as any } : {}),
        contactStatus: payload.contactStatus,
        contactCheckedAt: payload.contactCheckedAt,
        email: resolvedEmail,
        phone: payload.phone,
        siret: payload.siret,
        siren: payload.siren,
        firstName: payload.firstName,
        lastName: payload.lastName ?? payload.owner,
        owner: payload.owner,
        companyName: payload.companyName,
        companyAddress: payload.companyAddress,
        companyAddressExtra: payload.companyAddressExtra,
        companyPostalCode: payload.companyPostalCode,
        companyCity: payload.companyCity,
        companyLegalForm: payload.companyLegalForm,
        companyCountry: payload.companyCountry,
        companyLinkedinUrl: payload.companyLinkedinUrl || payload.linkedinUrl,
        linkedinUrl: payload.linkedinUrl,
        lastChecked: payload.lastChecked,
        evidence: payload.evidence,
        score: payload.score,
        leadScore: payload.leadScore,
        socialLinksJson: JSON.stringify(payload.socialLinks || []),
      },
    });

    await this.prisma.$executeRawUnsafe(
      'UPDATE "prospects" SET "trashed_at" = NULL WHERE "url_id" = ?',
      urlId,
    );

    if (payload.linkedinImageUrl !== undefined) {
      await this.prisma.$executeRawUnsafe(
        'UPDATE "prospects" SET "linkedin_image_url" = ? WHERE "url_id" = ?',
        payload.linkedinImageUrl,
        urlId,
      );
    }

    if (payload.avatarUrl !== undefined) {
      await this.prisma.$executeRawUnsafe(
        'UPDATE "prospects" SET "avatar_url" = ? WHERE "url_id" = ?',
        payload.avatarUrl,
        urlId,
      );
    }

    if (resolvedEmail && previousStatus === 'Prospect informations manquantes') {
      await this.prisma.$executeRawUnsafe(
        'UPDATE "prospects" SET "status" = ?, "updated_at" = CURRENT_TIMESTAMP WHERE "url_id" = ? AND "trashed_at" IS NULL',
        'Prospect froid',
        urlId,
      );
    }

    return prospect;
  }

  async setStatus(id: number, status: string) {
    await this.ensureProspectsTable();
    if (!PROSPECT_STATUSES.includes(status as (typeof PROSPECT_STATUSES)[number])) {
      throw new BadRequestException(`Statut prospect invalide. Valeurs: ${PROSPECT_STATUSES.join(', ')}`);
    }

    if (status === 'Prospect froid') {
      await this.prisma.$executeRawUnsafe(
        'UPDATE "prospects" SET "status" = ?, "first_contact_email_queued_at" = NULL, "first_contact_email_sent_at" = NULL, "email_send_count" = 0 WHERE "id" = ? AND "trashed_at" IS NULL',
        status,
        id,
      );
    } else {
      await this.prisma.$executeRawUnsafe(
        'UPDATE "prospects" SET "status" = ? WHERE "id" = ? AND "trashed_at" IS NULL',
        status,
        id,
      );
    }

    return this.getProspect(id);
  }

  async trashProspect(id: number) {
    await this.ensureProspectsTable();

    const prospect = await this.prisma.prospect.findFirst({
      where: { id, trashedAt: null },
      select: { id: true, urlId: true },
    });

    if (!prospect) {
      throw new NotFoundException(`Prospect introuvable: ${id}`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.prospect.update({
        where: { id: prospect.id },
        data: { trashedAt: new Date() },
      });

      if (prospect.urlId) {
        await tx.url.update({
          where: { id: prospect.urlId },
          data: { trashedAt: new Date() },
        });
      }
    });

    return { trashed: true, id };
  }

  async updateProcess(id: number, body: any) {
    await this.ensureProspectsTable();
    const updatedFields = new Set<string>();

    const allowedStatuses = new Set(PROSPECT_STATUSES);
    const status = typeof body.status === 'string' ? body.status : null;
    if (status && !allowedStatuses.has(status as (typeof PROSPECT_STATUSES)[number])) {
      throw new BadRequestException(`Statut prospect invalide. Valeurs: ${PROSPECT_STATUSES.join(', ')}`);
    }

    const assignments: string[] = [];
    const values: unknown[] = [];
    const columnByField: Record<string, string> = {
      name: 'name',
      companyName: 'company_name',
      siteName: 'site_name',
      firstName: 'first_name',
      email: 'email',
      phone: 'phone',
      siren: 'siren',
      owner: 'owner',
      ownerName: 'owner',
      companyAddress: 'company_address',
      companyAddressExtra: 'company_address_extra',
      companyPostalCode: 'company_postal_code',
      companyCity: 'company_city',
      companyLegalForm: 'company_legal_form',
      companyCountry: 'company_country',
      firstContactEmailSubject: 'first_contact_email_subject',
      firstContactEmailBody: 'first_contact_email_body',
      quoteFileName: 'quote_file_name',
      contractFileName: 'contract_file_name',
      firstContactEmailSentAt: 'first_contact_email_sent_at',
      quoteSentAt: 'quote_sent_at',
      contractSentAt: 'contract_sent_at',
      contractSignedAt: 'contract_signed_at',
      status: 'status',
    };
    const textFields = [
      'companyName',
      'siteName',
      'firstName',
      'email',
      'phone',
      'siren',
      'owner',
      'ownerName',
      'companyAddress',
      'companyAddressExtra',
      'companyPostalCode',
      'companyCity',
      'companyLegalForm',
      'companyCountry',
      'firstContactEmailSubject',
      'firstContactEmailBody',
      'quoteFileName',
      'contractFileName',
    ] as const;
    const booleanDateFields = [
      'quoteSentAt',
      'contractSentAt',
    ] as const;
    const dateFields = [
      'firstContactEmailSentAt',
      'contractSignedAt',
    ] as const;

    for (const field of textFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        assignments.push(`"${columnByField[field]}" = ?`);
        const normalizedValue = body[field] == null ? null : String(body[field]).trim();
        values.push(normalizedValue === '' ? null : normalizedValue);
        updatedFields.add(field);
      }
    }

    for (const field of booleanDateFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        const value = body[field];

        assignments.push(`"${columnByField[field]}" = ?`);
        if (value === true || value === 'true' || value === 1 || value === '1') {
          values.push(new Date().toISOString());
        } else if (value === false || value === 'false' || value === 0 || value === '0' || value == null || value === '') {
          values.push(null);
        } else {
          values.push(new Date(String(value)).toISOString());
        }
        updatedFields.add(field);
      }
    }

    for (const field of dateFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        assignments.push(`"${columnByField[field]}" = ?`);
        values.push(body[field] == null ? null : new Date(String(body[field])).toISOString());
        updatedFields.add(field);
      }
    }

    if (status) {
      assignments.push('"status" = ?');
      values.push(status);
      updatedFields.add('status');

      if (status === 'Prospect froid') {
        assignments.push('"first_contact_email_queued_at" = NULL');
        assignments.push('"first_contact_email_sent_at" = NULL');
        assignments.push('"email_send_count" = 0');
      }
    }

    const hasSiteLanguageUpdate =
      Object.prototype.hasOwnProperty.call(body, 'siteLanguageCode')
      || Object.prototype.hasOwnProperty.call(body, 'siteLanguageName');

    const hasSiteNameUpdate = Object.prototype.hasOwnProperty.call(body, 'siteName');
    const hasLastNameUpdate = Object.prototype.hasOwnProperty.call(body, 'lastName');
    const hasSirenUpdate =
      Object.prototype.hasOwnProperty.call(body, 'siren')
      || Object.prototype.hasOwnProperty.call(body, 'contactSiren');
    const hasPhoneUpdate = Object.prototype.hasOwnProperty.call(body, 'phone');
    const hasOwnerNameUpdate =
      Object.prototype.hasOwnProperty.call(body, 'ownerName')
      || Object.prototype.hasOwnProperty.call(body, 'contactOwnerName')
      || Object.prototype.hasOwnProperty.call(body, 'owner');
    const hasCompanyAddressUpdate =
      Object.prototype.hasOwnProperty.call(body, 'companyAddress')
      || Object.prototype.hasOwnProperty.call(body, 'contactCompanyAddress');
    const hasCompanyAddressExtraUpdate =
      Object.prototype.hasOwnProperty.call(body, 'companyAddressExtra')
      || Object.prototype.hasOwnProperty.call(body, 'contactCompanyAddressExtra');
    const hasCompanyPostalCodeUpdate =
      Object.prototype.hasOwnProperty.call(body, 'companyPostalCode')
      || Object.prototype.hasOwnProperty.call(body, 'contactCompanyPostalCode');
    const hasCompanyCityUpdate =
      Object.prototype.hasOwnProperty.call(body, 'companyCity')
      || Object.prototype.hasOwnProperty.call(body, 'contactCompanyCity');
    const hasCompanyLegalFormUpdate =
      Object.prototype.hasOwnProperty.call(body, 'companyLegalForm')
      || Object.prototype.hasOwnProperty.call(body, 'contactCompanyLegalForm');
    const hasCompanyCountryUpdate =
      Object.prototype.hasOwnProperty.call(body, 'companyCountry')
      || Object.prototype.hasOwnProperty.call(body, 'contactCompanyCountry');
    const hasLegalNoticeUrlUpdate = Object.prototype.hasOwnProperty.call(body, 'shopifyLegalNoticeUrl');
    const hasNameUpdate = Object.prototype.hasOwnProperty.call(body, 'name');

    if (
      assignments.length === 0
      && !hasSiteLanguageUpdate
      && !hasSiteNameUpdate
      && !hasLastNameUpdate
      && !hasSirenUpdate
      && !hasPhoneUpdate
      && !hasOwnerNameUpdate
      && !hasCompanyAddressUpdate
      && !hasCompanyAddressExtraUpdate
      && !hasCompanyPostalCodeUpdate
      && !hasCompanyCityUpdate
      && !hasCompanyLegalFormUpdate
      && !hasCompanyCountryUpdate
      && !hasLegalNoticeUrlUpdate
      && !hasNameUpdate
    ) {
      return this.getProspect(id);
    }

    if (assignments.length > 0) {
      values.push(id);
      await this.prisma.$executeRawUnsafe(
        `UPDATE "prospects" SET ${assignments.join(', ')} WHERE "id" = ? AND "trashed_at" IS NULL`,
        ...values,
      );
    }

    if (
      hasSiteLanguageUpdate
      || hasSiteNameUpdate
      || hasLastNameUpdate
      || hasSirenUpdate
      || hasPhoneUpdate
      || hasOwnerNameUpdate
      || hasCompanyAddressUpdate
      || hasCompanyAddressExtraUpdate
      || hasCompanyPostalCodeUpdate
      || hasCompanyCityUpdate
      || hasCompanyLegalFormUpdate
      || hasCompanyCountryUpdate
      || hasLegalNoticeUrlUpdate
      || hasNameUpdate
    ) {
      const currentProspectMetaRows = await this.prisma.$queryRawUnsafe<Array<{ name: string | null; url_id: number | null }>>(
        'SELECT "name", "url_id" FROM "prospects" WHERE "id" = ? AND "trashed_at" IS NULL LIMIT 1',
        id,
      );
      const currentProspectName = currentProspectMetaRows[0]?.name ?? null;
      const urlId = currentProspectMetaRows[0]?.url_id ?? null;
      const nextProspectName = hasNameUpdate
        ? body.name == null || String(body.name).trim() === ''
          ? null
          : String(body.name).trim()
        : currentProspectName;

      if (hasNameUpdate) {
        await this.prisma.$executeRawUnsafe(
          'UPDATE "prospects" SET "name" = ? WHERE "id" = ? AND "trashed_at" IS NULL',
          nextProspectName,
          id,
        );
        updatedFields.add('name');
      }

      if (urlId) {
        const siteLanguageCode = Object.prototype.hasOwnProperty.call(body, 'siteLanguageCode')
          ? body.siteLanguageCode == null || body.siteLanguageCode === ''
            ? null
            : String(body.siteLanguageCode)
          : undefined;
        const siteLanguageName = Object.prototype.hasOwnProperty.call(body, 'siteLanguageName')
          ? body.siteLanguageName == null || body.siteLanguageName === ''
            ? null
            : String(body.siteLanguageName)
          : undefined;

        const pickRaw = (...keys: string[]) => {
          for (const key of keys) {
            if (Object.prototype.hasOwnProperty.call(body, key)) {
              const value = body[key];
              if (value == null || value === '') {
                return null;
              }
              return String(value).trim();
            }
          }
          return undefined;
        };

        const pickDecoded = (...keys: string[]) => {
          for (const key of keys) {
            if (Object.prototype.hasOwnProperty.call(body, key)) {
              const value = body[key];
              if (value == null || value === '') {
                return null;
              }
              return decodeHtmlEntities(String(value));
            }
          }
          return undefined;
        };

        const lastName = hasLastNameUpdate
          ? body.lastName == null || body.lastName === ''
            ? null
            : String(body.lastName).trim()
          : undefined;
        const siteName = hasSiteNameUpdate
          ? body.siteName == null || body.siteName === ''
            ? null
            : decodeHtmlEntities(String(body.siteName))
          : undefined;
        const contactSiren = pickRaw('siren', 'contactSiren');
        const contactPhone = hasPhoneUpdate
          ? body.phone == null || body.phone === ''
            ? null
            : String(body.phone).trim()
          : undefined;
        const contactOwnerName = pickDecoded('ownerName', 'contactOwnerName', 'owner');
        const contactCompanyAddress = pickDecoded('companyAddress', 'contactCompanyAddress');
        const contactCompanyAddressExtra = pickDecoded('companyAddressExtra', 'contactCompanyAddressExtra');
        const contactCompanyPostalCode = pickRaw('companyPostalCode', 'contactCompanyPostalCode');
        const contactCompanyCity = pickDecoded('companyCity', 'contactCompanyCity');
        const contactCompanyLegalForm = pickDecoded('companyLegalForm', 'contactCompanyLegalForm');
        const contactCompanyCountry = pickDecoded('companyCountry', 'contactCompanyCountry');
        const shopifyLegalNoticeUrl = hasLegalNoticeUrlUpdate
          ? body.shopifyLegalNoticeUrl == null || body.shopifyLegalNoticeUrl === ''
            ? null
            : String(body.shopifyLegalNoticeUrl).trim()
          : undefined;

        const currentSiteRows = await this.prisma.$queryRawUnsafe<Array<{
          url: string | null;
          site_name: string | null;
          site_language_code: string | null;
          site_language_name: string | null;
          siren: string | null;
          phone: string | null;
          owner: string | null;
          last_name: string | null;
          company_address: string | null;
          company_address_extra: string | null;
          company_postal_code: string | null;
          company_city: string | null;
          company_legal_form: string | null;
          company_country: string | null;
          shopify_legal_notice_url: string | null;
          shopify_status: string | null;
          cms_name: string | null;
          shopify_theme_store_type: string | null;
          shopify_theme_name: string | null;
          shopify_theme_schema_name: string | null;
          shopify_theme_json: string | null;
          lighthouse_performance_score: number | null;
          lighthouse_accessibility_score: number | null;
          lighthouse_best_practices_score: number | null;
          lighthouse_seo_score: number | null;
          site_country_code: string | null;
          product_count: number | null;
          median_product_price: number | null;
          shopify_legal_notice_status: string | null;
        }>>(
          `
          SELECT
            u.url AS url,
            u.site_name AS site_name,
            u.site_language_code AS site_language_code,
            u.site_language_name AS site_language_name,
            p.siren AS siren,
            p.phone AS phone,
            p.owner AS owner,
            p.last_name AS last_name,
            p.company_address AS company_address,
            p.company_address_extra AS company_address_extra,
            p.company_postal_code AS company_postal_code,
            p.company_city AS company_city,
            p.company_legal_form AS company_legal_form,
            p.company_country AS company_country,
            u.shopify_legal_notice_url AS shopify_legal_notice_url,
            u.shopify_status AS shopify_status,
            u.cms_name AS cms_name,
            u.shopify_theme_store_type AS shopify_theme_store_type,
            u.shopify_theme_name AS shopify_theme_name,
            u.shopify_theme_schema_name AS shopify_theme_schema_name,
            u.shopify_theme_json AS shopify_theme_json,
          u.lighthouse_performance_score AS lighthouse_performance_score,
          u.lighthouse_accessibility_score AS lighthouse_accessibility_score,
          u.lighthouse_best_practices_score AS lighthouse_best_practices_score,
          u.lighthouse_seo_score AS lighthouse_seo_score,
          u.site_country_code AS site_country_code,
          u.product_count AS product_count,
          u.median_product_price AS median_product_price,
          u.shopify_legal_notice_status AS shopify_legal_notice_status
          FROM "urls" u
          LEFT JOIN "prospects" p ON p."url_id" = u."id" AND p."trashed_at" IS NULL
          WHERE u."id" = ?
          LIMIT 1
          `,
          urlId,
        );

        if (currentSiteRows[0]) {
        const nextSiteName = hasSiteNameUpdate ? siteName : currentSiteRows[0].site_name;
        const nextContactSiren = hasSirenUpdate ? contactSiren : currentSiteRows[0].siren;
          const nextContactPhone = hasPhoneUpdate ? contactPhone : currentSiteRows[0].phone;
          const nextContactOwnerName = hasOwnerNameUpdate ? contactOwnerName : currentSiteRows[0].owner;
          const nextContactLastName = hasLastNameUpdate ? lastName : currentSiteRows[0].last_name;
          const nextContactCompanyAddress = hasCompanyAddressUpdate ? contactCompanyAddress : currentSiteRows[0].company_address;
          const nextContactCompanyAddressExtra = hasCompanyAddressExtraUpdate
            ? contactCompanyAddressExtra
            : currentSiteRows[0].company_address_extra;
          const nextContactCompanyPostalCode = hasCompanyPostalCodeUpdate ? contactCompanyPostalCode : currentSiteRows[0].company_postal_code;
          const nextContactCompanyCity = hasCompanyCityUpdate ? contactCompanyCity : currentSiteRows[0].company_city;
          const nextContactCompanyLegalForm = hasCompanyLegalFormUpdate ? contactCompanyLegalForm : currentSiteRows[0].company_legal_form;
          const nextContactCompanyCountry = hasCompanyCountryUpdate ? contactCompanyCountry : currentSiteRows[0].company_country;
          const nextShopifyLegalNoticeUrl = hasLegalNoticeUrlUpdate ? shopifyLegalNoticeUrl : currentSiteRows[0].shopify_legal_notice_url;
          const nextSiteLanguageCode = hasSiteLanguageUpdate ? siteLanguageCode : currentSiteRows[0].site_language_code;
          const nextSiteLanguageName = hasSiteLanguageUpdate ? siteLanguageName : currentSiteRows[0].site_language_name;

          if (hasSiteLanguageUpdate) {
            updatedFields.add('siteLanguageCode');
            updatedFields.add('siteLanguageName');
          }
          if (hasSiteNameUpdate) {
            updatedFields.add('siteName');
          }
          if (hasSirenUpdate) updatedFields.add('siren');
          if (hasPhoneUpdate) updatedFields.add('phone');
          if (hasOwnerNameUpdate) updatedFields.add('ownerName');
          if (hasLastNameUpdate) updatedFields.add('lastName');
          if (hasCompanyAddressUpdate) updatedFields.add('companyAddress');
          if (hasCompanyAddressExtraUpdate) updatedFields.add('companyAddressExtra');
          if (hasCompanyPostalCodeUpdate) updatedFields.add('companyPostalCode');
          if (hasCompanyCityUpdate) updatedFields.add('companyCity');
          if (hasCompanyLegalFormUpdate) updatedFields.add('companyLegalForm');
          if (hasCompanyCountryUpdate) updatedFields.add('companyCountry');
          if (hasLegalNoticeUrlUpdate) updatedFields.add('shopifyLegalNoticeUrl');

          await this.prisma.$executeRawUnsafe(
            `
            UPDATE "urls"
            SET
              "site_name" = ?,
              "shopify_legal_notice_url" = ?,
              "site_language_code" = ?,
              "site_language_name" = ?
            WHERE "id" = ?
            `,
            nextSiteName,
            nextShopifyLegalNoticeUrl,
            nextSiteLanguageCode,
            nextSiteLanguageName,
            urlId,
          );

          await this.prisma.$executeRawUnsafe(
            `
            UPDATE "prospects"
            SET
              "siren" = ?,
              "phone" = ?,
              "owner" = ?,
              "last_name" = ?,
              "company_address" = ?,
              "company_address_extra" = ?,
              "company_postal_code" = ?,
              "company_city" = ?,
              "company_legal_form" = ?,
              "company_country" = ?
            WHERE "url_id" = ? AND "trashed_at" IS NULL
            `,
            nextContactSiren,
            nextContactPhone,
            nextContactOwnerName,
            nextContactLastName,
            nextContactCompanyAddress,
            nextContactCompanyAddressExtra,
            nextContactCompanyPostalCode,
            nextContactCompanyCity,
            nextContactCompanyLegalForm,
            nextContactCompanyCountry,
            urlId,
          );

          const leadScoreSettings = await this.siteSettingsService.getLeadScoreSettings();
          const refreshedSite = {
            ...currentSiteRows[0],
            site_name: nextSiteName,
            site_language_code: nextSiteLanguageCode,
            site_language_name: nextSiteLanguageName,
            siren: nextContactSiren,
            phone: nextContactPhone,
            owner: nextContactOwnerName,
            last_name: nextContactLastName,
            company_address: nextContactCompanyAddress,
            company_address_extra: nextContactCompanyAddressExtra,
            company_postal_code: nextContactCompanyPostalCode,
            company_city: nextContactCompanyCity,
            company_legal_form: nextContactCompanyLegalForm,
            company_country: nextContactCompanyCountry,
            shopify_legal_notice_url: nextShopifyLegalNoticeUrl,
          };
          const leadScore = computeLeadScore({
            shopifyStatus: refreshedSite.shopify_status || 'unknown',
            cmsName: refreshedSite.cms_name,
            shopifyThemeStoreType: refreshedSite.shopify_theme_store_type,
            shopifyThemeName: refreshedSite.shopify_theme_name,
            shopifyThemeSchemaName: refreshedSite.shopify_theme_schema_name,
            shopifyThemeJson: refreshedSite.shopify_theme_json,
            lighthousePerformanceScore: refreshedSite.lighthouse_performance_score,
            lighthouseAccessibilityScore: refreshedSite.lighthouse_accessibility_score,
            lighthouseBestPracticesScore: refreshedSite.lighthouse_best_practices_score,
            lighthouseSeoScore: refreshedSite.lighthouse_seo_score,
            siteLanguageCode: refreshedSite.site_language_code,
            siteLanguageName: refreshedSite.site_language_name,
            siteCountryCode: refreshedSite.site_country_code,
            companyCountry: refreshedSite.company_country,
            productCount: refreshedSite.product_count,
            medianProductPrice: refreshedSite.median_product_price,
            shopifyLegalNoticeStatus: refreshedSite.shopify_legal_notice_status,
          }, leadScoreSettings);

          await this.prisma.$executeRawUnsafe(
            'UPDATE "prospects" SET "lead_score" = ?, "updated_at" = CURRENT_TIMESTAMP WHERE "url_id" = ? AND "trashed_at" IS NULL',
            leadScore,
            urlId,
          );
        }
      }
    }

    return {
      prospect: await this.getProspect(id),
      updatedFields: [...updatedFields],
    };
  }

  async removeByUrlId(urlId: number) {
    await this.ensureProspectsTable();
    return this.prisma.prospect.deleteMany({
      where: { urlId },
    });
  }

  async trashByUrlId(urlId: number) {
    await this.ensureProspectsTable();

    return this.prisma.prospect.updateMany({
      where: {
        urlId,
        trashedAt: null,
      },
      data: {
        trashedAt: new Date(),
      },
    });
  }

  async resetProspects() {
    await this.ensureProspectsTable();
    const result = await this.prisma.$executeRawUnsafe(
      'UPDATE "prospects" SET "trashed_at" = CURRENT_TIMESTAMP WHERE "trashed_at" IS NULL',
    );

    return { trashed: Number(result || 0) };
  }

  async restoreProspect(id: number) {
    await this.ensureProspectsTable();

    const result = await this.prisma.$executeRawUnsafe(
      'UPDATE "prospects" SET "trashed_at" = NULL WHERE "id" = ? AND "trashed_at" IS NOT NULL',
      id,
    );

    if (!result) {
      throw new NotFoundException(`Prospect introuvable: ${id}`);
    }

    return this.getProspect(id);
  }

  async deleteTrashedProspect(id: number) {
    await this.ensureProspectsTable();

    const result = await this.prisma.$executeRawUnsafe(
      'DELETE FROM "prospects" WHERE "id" = ? AND "trashed_at" IS NOT NULL',
      id,
    );

    if (!result) {
      throw new NotFoundException(`Prospect introuvable: ${id}`);
    }

    return { deleted: true, id };
  }

  async emptyTrash() {
    await this.ensureProspectsTable();

    const result = await this.prisma.$executeRawUnsafe(
      'DELETE FROM "prospects" WHERE "trashed_at" IS NOT NULL',
    );

    return { deleted: Number(result || 0) };
  }
}

