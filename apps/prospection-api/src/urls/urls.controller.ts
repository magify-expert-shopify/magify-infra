import { BadRequestException, Body, Controller, Delete, Get, MessageEvent, Param, ParseIntPipe, Patch, Post, Query, Sse } from '@nestjs/common';
import { concat, from, map, Observable } from 'rxjs';
import { ScanningService } from 'src/scanning/scanning.service';
import { ProspectsService } from 'src/prospects/prospects.service';
import { SiteSettingsService } from 'src/site-settings/site-settings.service';
import { AddUrlDto } from './dto/add-url.dto';
import { ImportUrlsDto } from './dto/import-urls.dto';
import { SetSiteQualificationDto, isSiteQualificationPositioning } from './dto/set-site-qualification.dto';
import { SetRedesignStatusDto } from './dto/set-redesign-status.dto';
import { UrlLeadScoreRecalcEventsService } from './url-lead-score-recalc-events.service';
import { UrlsService, type LeadScoreRecalcStatus, type UrlListField } from './urls.service';

@Controller('urls')
export class UrlsController {
  constructor(
    private readonly urlsService: UrlsService,
    private readonly urlLeadScoreRecalcEventsService: UrlLeadScoreRecalcEventsService,
    private readonly scanningService: ScanningService,
    private readonly prospectsService: ProspectsService,
    private readonly siteSettingsService: SiteSettingsService,
  ) {}

  private async resolveTimeoutMs(timeoutMs?: number) {
    if (Number.isFinite(timeoutMs as number) && Number(timeoutMs) > 0) {
      return Number(timeoutMs);
    }

    const settings = await this.siteSettingsService.getScanTimeout();
    return settings.timeoutMs;
  }

  @Post('import')
  async importUrls(@Body() body: ImportUrlsDto) {
    if (!body.text) {
      throw new BadRequestException('Le champ text est requis.');
    }

    const result = await this.urlsService.importUrlText(body.text, body.sourceFile);
    const shouldScan = result.found > 0 && result.found <= 10;
    const scanResults = [];

    if (shouldScan) {
      const scanTargets = result.importedSites.filter((site) => !site.shopifyCheckedAt);

      for (const site of scanTargets) {
        const scan = await this.scanningService.rescanSite(site.id, {
          timeoutMs: await this.resolveTimeoutMs(),
        });
        scanResults.push({
          id: site.id,
          url: site.url,
          scan,
        });
      }
    }

    return {
      ...result,
      imported: result.importedSites.length,
      scanned: scanResults.length,
      scanResults,
    };
  }

  @Post()
  async addUrl(@Body() body: AddUrlDto) {
    if (!body.url) {
      throw new BadRequestException('Le champ url est requis.');
    }

    const { site, ignored } = await this.urlsService.insertSingleUrl(body.url, body.sourceFile);

    const existingProspect = await this.prospectsService.getProspectByUrlId(site.id);
    if (existingProspect) {
      return {
        site,
        scan: null,
        prospect: existingProspect,
        outcome: 'existing_prospect',
        message: 'Cette URL est déjà liée à un prospect existant.',
        destination: {
          label: 'Ouvrir la fiche prospect',
          href: `/prospects/${existingProspect.id}`,
        },
      };
    }

    if (ignored) {
      return {
        site,
        scan: null,
        prospect: null,
        outcome: 'url_detail',
        message: 'Cette URL est dans la black list. Elle a été ignorée.',
        destination: {
          label: 'Voir la fiche URL',
          href: `/urls/${site.id}`,
        },
      };
    }

    if (!body.scan) {
      return {
        site,
        scan: null,
        prospect: null,
        outcome: 'url_detail',
        message: 'Le site a été ajouté. Le scan peut être lancé ensuite.',
        destination: {
          label: 'Voir la fiche URL',
          href: `/urls/${site.id}`,
        },
      };
    }

    const scan = await this.scanningService.rescanSite(site.id, {
      timeoutMs: await this.resolveTimeoutMs(body.timeoutMs),
    });

    const prospect = await this.prospectsService.getProspectByUrlId(site.id);

    if (prospect) {
      return {
        site,
        scan,
        prospect,
        outcome: 'prospect_found',
        message: 'Le scan a trouvé un contact et un prospect a été créé.',
        destination: {
          label: 'Ouvrir la fiche prospect',
          href: `/prospects/${prospect.id}`,
        },
      };
    }

    return {
      site,
      scan,
      prospect: null,
      outcome: 'url_detail',
      message: 'Le scan est terminé. Aucun contact n’a été trouvé pour le moment.',
      destination: {
        label: 'Voir la fiche URL',
        href: `/urls/${site.id}`,
      },
    };
  }

  @Get()
  listUrls(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('direction') direction?: string,
    @Query('cmsName') cmsName?: string,
    @Query('shopifyStatus') shopifyStatus?: string,
    @Query('contactStatus') contactStatus?: string,
    @Query('fields') fields?: string,
  ) {
    return this.urlsService.searchUrls({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      cmsName,
      sortBy: sortBy === 'source' || sortBy === 'shopifyStatus' || sortBy === 'scanDate' || sortBy === 'siteName'
        ? sortBy
        : 'createdAt',
      direction: direction === 'asc' ? 'asc' : 'desc',
      shopifyStatus:
        shopifyStatus && shopifyStatus !== 'all' ? shopifyStatus : undefined,
      contactStatus:
        contactStatus && contactStatus !== 'all' ? contactStatus : undefined,
      fields: fields ? fields.split(',').map((field) => field.trim()).filter(Boolean) as UrlListField[] : undefined,
    });
  }

  @Get('shopify')
  listShopifyUrls() {
    return this.urlsService.searchUrls({ shopifyOnly: true });
  }

  @Get('lead-score/recalculate/status')
  getLeadScoreRecalculateStatus(): Promise<LeadScoreRecalcStatus> {
    return this.urlsService.getLeadScoreRecalcStatus();
  }

  @Sse('lead-score/recalculate/events')
  streamLeadScoreRecalculateEvents(): Observable<MessageEvent> {
    const initialEvent = from(this.urlsService.getLeadScoreRecalcStatus()).pipe(
      map((status) => ({
        type: 'lead-score-recalc.snapshot',
        data: status,
      })),
    );

    return concat(initialEvent, this.urlLeadScoreRecalcEventsService.stream());
  }

  @Post('lead-score/recalculate')
  startLeadScoreRecalculate() {
    return this.urlsService.startLeadScoreRecalculation();
  }

  @Get('exists')
  checkUrlExists(@Query('url') url?: string) {
    if (!url) {
      throw new BadRequestException('Le champ url est requis.');
    }

    return this.urlsService.findExistingSiteByUrl(url);
  }

  @Delete('non-shopify')
  purgeNonShopifyUrls() {
    return this.urlsService.purgeNonShopifyUrls();
  }

  @Delete('unknown-cms')
  purgeUnknownCmsUrls() {
    return this.urlsService.purgeUnknownCmsUrls();
  }

  @Get('trash')
  listTrashedUrls() {
    return this.urlsService.listTrashedUrls();
  }

  @Get('blacklist')
  listBlacklistedUrls() {
    return this.urlsService.listBlacklistedUrls();
  }

  @Get('observations/suggestions')
  searchObservationSuggestions(
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.urlsService.searchObservationTitleSuggestions(search || '', limit ? Number(limit) : 6);
  }

  @Patch(':id/blacklist')
  blacklistUrl(@Param('id', ParseIntPipe) id: number) {
    return this.urlsService.blacklistSite(id);
  }

  @Patch(':id/unblacklist')
  unblacklistUrl(@Param('id', ParseIntPipe) id: number) {
    return this.urlsService.unblacklistSite(id);
  }

  @Patch(':id/restore')
  restoreUrl(@Param('id', ParseIntPipe) id: number) {
    return this.urlsService.restoreSite(id);
  }

  @Delete(':id/permanent')
  deleteTrashedUrl(@Param('id', ParseIntPipe) id: number) {
    return this.urlsService.deleteTrashedSite(id);
  }

  @Delete('trash/reset')
  emptyTrash(@Query('confirm') confirm?: string) {
    if (confirm !== 'true') {
      throw new BadRequestException('Ajoutez ?confirm=true pour vider la corbeille.');
    }

    return this.urlsService.emptyTrash();
  }

  @Delete('reset')
  resetDatabase(@Query('confirm') confirm?: string) {
    if (confirm !== 'true') {
      throw new BadRequestException('Ajoutez ?confirm=true pour vider la table urls.');
    }

    return this.urlsService.resetDatabase();
  }

  @Get(':id')
  getUrl(@Param('id', ParseIntPipe) id: number) {
    return this.urlsService.getSite(id);
  }

  @Delete(':id')
  deleteUrl(@Param('id', ParseIntPipe) id: number) {
    return this.urlsService.deleteSite(id);
  }

  @Patch('redesign')
  setRedesignStatus(@Body() body: SetRedesignStatusDto) {
    if (!Array.isArray(body.ids)) {
      throw new BadRequestException('Le champ ids doit etre un tableau.');
    }

    return this.urlsService.setRedesignStatus(body.ids, body.status ?? 'cible', body.decision ?? 'manual');
  }

  @Patch(':id/qualification')
  setQualification(@Param('id', ParseIntPipe) id: number, @Body() body: SetSiteQualificationDto) {
    if (!isSiteQualificationPositioning(body.positioning)) {
      throw new BadRequestException('Le champ positioning est invalide.');
    }

    return this.urlsService.saveQualification(id, {
      positioning: body.positioning,
      abandonReason: body.abandonReason,
      mainObservationKey: body.mainObservationKey,
      observations: body.observations,
      verificationChecklist: body.verificationChecklist,
    });
  }
}
