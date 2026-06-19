import { Body, Controller, Get, MessageEvent, Param, ParseIntPipe, Post, Query, Sse } from '@nestjs/common';
import { concat, from, map, Observable } from 'rxjs';
import { ScanningService } from './scanning.service';
import type { ScanLaunchFilters, ScanLaunchOverwriteMode, ScanLaunchStepKey } from 'src/urls/urls.service';
import { SiteSettingsService } from 'src/site-settings/site-settings.service';

@Controller('scanning')
export class ScanningController {
  constructor(
    private readonly scanningService: ScanningService,
    private readonly siteSettingsService: SiteSettingsService,
  ) {}

  private async resolveTimeoutMs(timeoutMs?: number) {
    if (Number.isFinite(timeoutMs as number) && Number(timeoutMs) > 0) {
      return Number(timeoutMs);
    }

    const settings = await this.siteSettingsService.getScanTimeout();
    return settings.timeoutMs;
  }

  @Get('launch/status')
  getLaunchStatus() {
    return this.scanningService.getLaunchStatus();
  }

  @Sse('launch/events')
  streamLaunchEvents(): Observable<MessageEvent> {
    const initialEvent = from(Promise.resolve(this.scanningService.getLaunchStatus())).pipe(
      map((status) => ({
        type: 'scan-launch.snapshot',
        data: status,
      })),
    );

    return concat(initialEvent, this.scanningService.streamLaunchEvents());
  }

  @Get('launch/preview')
  previewLaunchScans(
    @Query('cmsName') cmsName?: string,
    @Query('importRange') importRange?: string,
    @Query('themeType') themeType?: string,
    @Query('prospectScope') prospectScope?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.scanningService.previewLaunchScans(
      {
        cmsName: cmsName || undefined,
        importRange: importRange === 'today' || importRange === 'week' ? importRange : 'all',
        themeType: themeType === 'free' || themeType === 'paid' || themeType === 'custom' ? themeType : 'all',
        prospectScope: prospectScope === 'with' || prospectScope === 'without' ? prospectScope : 'all',
      },
      {
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 50,
      },
    );
  }

  @Post('launch')
  async launchScans(@Body() body: { filters?: ScanLaunchFilters; steps?: ScanLaunchStepKey[]; overwriteMode?: ScanLaunchOverwriteMode; timeoutMs?: number }) {
    const filters = body.filters || {};
    const steps = Array.isArray(body.steps) ? body.steps : [];
    const overwriteMode = body.overwriteMode === 'clear' || body.overwriteMode === 'fill_missing' ? body.overwriteMode : 'merge';
    const timeoutMs = await this.resolveTimeoutMs(body.timeoutMs);

    return this.scanningService.startLaunchScans(filters, steps, {
      overwriteMode,
      timeoutMs,
    });
  }

  @Post('shopify')
  async checkShopify(@Query('force') force?: string, @Query('timeoutMs') timeoutMs?: string) {
    return this.scanningService.checkShopify({
      force: force === 'true',
      timeoutMs: await this.resolveTimeoutMs(timeoutMs ? Number(timeoutMs) : undefined),
    });
  }

  @Post('all')
  async rescanAllSites(@Query('force') force?: string, @Query('timeoutMs') timeoutMs?: string) {
    return this.scanningService.rescanAllSites({
      force: force === 'true',
      timeoutMs: await this.resolveTimeoutMs(timeoutMs ? Number(timeoutMs) : undefined),
    });
  }

  @Post('language')
  async rescanAllSiteLanguages(@Query('timeoutMs') timeoutMs?: string) {
    return this.scanningService.rescanAllSiteLanguages({
      timeoutMs: await this.resolveTimeoutMs(timeoutMs ? Number(timeoutMs) : undefined),
    });
  }

  @Post('sites/:id')
  async rescanSite(
    @Param('id', ParseIntPipe) id: number,
    @Query('force') force?: string,
    @Query('timeoutMs') timeoutMs?: string,
  ) {
    return this.scanningService.rescanSite(id, {
      force: force === 'true',
      timeoutMs: await this.resolveTimeoutMs(timeoutMs ? Number(timeoutMs) : undefined),
    });
  }

  @Post('sites/:id/language')
  async rescanSiteLanguage(
    @Param('id', ParseIntPipe) id: number,
    @Query('force') force?: string,
    @Query('timeoutMs') timeoutMs?: string,
  ) {
    return this.scanningService.rescanSiteLanguage(id, {
      force: force === 'true',
      timeoutMs: await this.resolveTimeoutMs(timeoutMs ? Number(timeoutMs) : undefined),
    });
  }

  @Post('sites/:id/steps/:step')
  async runSiteStep(
    @Param('id', ParseIntPipe) id: number,
    @Param('step') step: 'shopify' | 'cms_detection' | 'language' | 'seo_meta' | 'legal_notice' | 'contact' | 'linkedin' | 'social' | 'technical' | 'lighthouse',
    @Query('force') force?: string,
    @Query('timeoutMs') timeoutMs?: string,
  ) {
    return this.scanningService.runSiteStep(id, step, {
      force: force === 'true',
      timeoutMs: await this.resolveTimeoutMs(timeoutMs ? Number(timeoutMs) : undefined),
    });
  }
}
