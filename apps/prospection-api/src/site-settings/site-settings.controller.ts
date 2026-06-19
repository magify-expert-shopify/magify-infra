import { Body, Controller, Get, Put } from '@nestjs/common';
import {
  type LeadScoreSettingsResponse,
  SiteSettingsService,
  type EmailTemplateSetting,
  type HomepageCardSetting,
  type EmailSendingSetting,
  type DiscordReminderSetting,
  type EmailSignatureSetting,
  type SiteLinkSetting,
  type ScanStepsResponse,
  type ScanTimeoutResponse,
  type ProspectRelaunchResponse,
} from './site-settings.service';

@Controller('site-settings')
export class SiteSettingsController {
  constructor(private readonly siteSettingsService: SiteSettingsService) {}

  @Get('homepage-cards')
  getHomepageCards() {
    return this.siteSettingsService.getHomepageCards();
  }

  @Put('homepage-cards')
  updateHomepageCards(@Body('blocks') blocks?: HomepageCardSetting[]) {
    return this.siteSettingsService.updateHomepageCards(Array.isArray(blocks) ? blocks : []);
  }

  @Get('email-templates')
  getEmailTemplates() {
    return this.siteSettingsService.getEmailTemplates();
  }

  @Put('email-templates')
  updateEmailTemplates(@Body('templates') templates?: EmailTemplateSetting[]) {
    return this.siteSettingsService.updateEmailTemplates(Array.isArray(templates) ? templates : []);
  }

  @Get('site-links')
  getSiteLinks() {
    return this.siteSettingsService.getSiteLinks();
  }

  @Put('site-links')
  updateSiteLinks(@Body() body?: Partial<SiteLinkSetting>) {
    return this.siteSettingsService.updateSiteLinks(body || {});
  }

  @Get('email-sending')
  getEmailSending() {
    return this.siteSettingsService.getEmailSending();
  }

  @Put('email-sending')
  updateEmailSending(@Body() body?: Partial<EmailSendingSetting>) {
    return this.siteSettingsService.updateEmailSending(body || {});
  }

  @Get('discord-reminder')
  getDiscordReminderSettings() {
    return this.siteSettingsService.getDiscordReminderSettings();
  }

  @Put('discord-reminder')
  updateDiscordReminderSettings(@Body() body?: Partial<DiscordReminderSetting>) {
    return this.siteSettingsService.updateDiscordReminderSettings(body || {});
  }

  @Get('email-signature')
  getEmailSignature() {
    return this.siteSettingsService.getEmailSignature();
  }

  @Put('email-signature')
  updateEmailSignature(@Body() body?: Partial<EmailSignatureSetting>) {
    return this.siteSettingsService.updateEmailSignature(body || {});
  }

  @Get('lead-score')
  getLeadScoreSettings(): Promise<LeadScoreSettingsResponse> {
    return this.siteSettingsService.getLeadScoreSettings();
  }

  @Put('lead-score')
  updateLeadScoreSettings(@Body() body?: Partial<LeadScoreSettingsResponse>) {
    return this.siteSettingsService.updateLeadScoreSettings(body || {});
  }

  @Get('scan-steps')
  getScanSteps(): Promise<ScanStepsResponse> {
    return this.siteSettingsService.getScanSteps();
  }

  @Put('scan-steps')
  updateScanSteps(@Body() body?: Partial<ScanStepsResponse>) {
    return this.siteSettingsService.updateScanSteps({
      steps: Array.isArray(body?.steps) ? body.steps : [],
    });
  }

  @Get('scan-timeout')
  getScanTimeout(): Promise<ScanTimeoutResponse> {
    return this.siteSettingsService.getScanTimeout();
  }

  @Put('scan-timeout')
  updateScanTimeout(@Body() body?: Partial<ScanTimeoutResponse>) {
    return this.siteSettingsService.updateScanTimeout(body || {});
  }

  @Get('prospect-relaunch')
  getProspectRelaunchSettings(): Promise<ProspectRelaunchResponse> {
    return this.siteSettingsService.getProspectRelaunchSettings();
  }

  @Put('prospect-relaunch')
  updateProspectRelaunchSettings(@Body() body?: Partial<ProspectRelaunchResponse>) {
    return this.siteSettingsService.updateProspectRelaunchSettings(body || {});
  }
}
