import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { EmbedBuilder, Events, type Message } from 'discord.js';
import { SiteSettingsService } from 'src/site-settings/site-settings.service';
import { createDiscordClient } from './discord.client';
import type { DiscordBotConfig, DiscordClient, DiscordModuleStatus } from './discord.types';
import { ProspectsService } from 'src/prospects/prospects.service';
import { ScanningService } from 'src/scanning/scanning.service';
import { UrlsService, extractUrls, normalizeSiteUrl } from 'src/urls/urls.service';

@Injectable()
export class DiscordService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(DiscordService.name);
  private readonly config: DiscordBotConfig = {
    token: process.env.DISCORD_BOT_TOKEN?.trim() || null,
    activityName: process.env.DISCORD_BOT_ACTIVITY?.trim() || null,
    applicationName: process.env.DISCORD_BOT_APPLICATION_NAME?.trim() || 'Prospection Magify',
    devUserIds: String(process.env.DEV_USER_ID || '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
    sendStartupNotification: String(process.env.DISCORD_SEND_STARTUP_NOTIFICATION || '')
      .trim()
      .toLowerCase() === 'true',
  };
  private client: DiscordClient | null = null;
  private connectPromise: Promise<void> | null = null;
  private reminderWatcher: NodeJS.Timeout | null = null;
  private startupNotificationSent = false;
  private status: DiscordModuleStatus = 'disabled';

  constructor(
    private readonly siteSettingsService: SiteSettingsService,
    private readonly urlsService: UrlsService,
    private readonly prospectsService: ProspectsService,
    private readonly scanningService: ScanningService,
  ) {}

  async onApplicationBootstrap() {
    await this.connect();
  }

  async onApplicationShutdown() {
    await this.disconnect();
  }

  getStatus() {
    return this.status;
  }

  isEnabled() {
    return this.config.token != null;
  }

  isReady() {
    return this.status === 'ready';
  }

  getClient() {
    if (!this.client) {
      throw new Error('Le client Discord n’est pas initialisé.');
    }

    return this.client;
  }

  async connect() {
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.connectInternal().finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  async disconnect() {
    this.stopReminderWatcher();

    if (!this.client) {
      this.status = this.isEnabled() ? 'connecting' : 'disabled';
      return;
    }

    const client = this.client;
    this.client = null;
    this.status = this.isEnabled() ? 'connecting' : 'disabled';

    client.removeAllListeners();
    await client.destroy();
  }

  private startReminderWatcher() {
    this.stopReminderWatcher();

    if (this.config.devUserIds.length === 0) {
      this.logger.warn('Aucun DEV_USER_ID défini, le rappel quotidien Discord est désactivé.');
      return;
    }

    void this.evaluateReminderSchedule();

    this.reminderWatcher = setInterval(() => {
      void this.evaluateReminderSchedule();
    }, 60_000);
  }

  private stopReminderWatcher() {
    if (this.reminderWatcher) {
      clearInterval(this.reminderWatcher);
      this.reminderWatcher = null;
    }
  }

  private getLocalDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseReminderTime(sendAtTime: string) {
    const match = sendAtTime.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

    if (!match) {
      return { hour: 16, minute: 45 };
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return { hour: 16, minute: 45 };
    }

    return {
      hour: Math.min(23, Math.max(0, Math.floor(hour))),
      minute: Math.min(59, Math.max(0, Math.floor(minute))),
    };
  }

  private async evaluateReminderSchedule() {
    if (!this.isReady() || this.config.devUserIds.length === 0) {
      return;
    }

    try {
      const [settings, reminderState] = await Promise.all([
        this.siteSettingsService.getDiscordReminderSettings(),
        this.siteSettingsService.getDiscordReminderState(),
      ]);

      const now = new Date();
      const todayKey = this.getLocalDateKey(now);

      if (reminderState.lastSentDate === todayKey) {
        return;
      }

      const { hour, minute } = this.parseReminderTime(settings.sendAtTime);
      const scheduledTime = new Date(now);
      scheduledTime.setHours(hour, minute, 0, 0);

      if (now < scheduledTime) {
        return;
      }

      await this.sendDailyReminder();
      await this.siteSettingsService.updateDiscordReminderState({ lastSentDate: todayKey });
    } catch (error) {
      this.logger.error(
        'Impossible de vérifier ou d’envoyer le rappel quotidien Discord.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async sendDailyReminder() {
    if (this.config.devUserIds.length === 0) {
      return;
    }

    const client = this.getClient();
    for (const userId of this.config.devUserIds) {
      try {
        const user = await client.users.fetch(userId);
        await user.send('Rappel quotidien: le bot Discord est en ligne.');
        this.logger.log(`Rappel quotidien envoyé à ${userId}.`);
      } catch (error) {
        this.logger.error(
          `Impossible d’envoyer le rappel quotidien à ${userId}.`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  private async sendStartupNotification() {
    if (
      !this.config.sendStartupNotification ||
      this.startupNotificationSent ||
      this.config.devUserIds.length === 0
    ) {
      return;
    }

    this.startupNotificationSent = true;

    const client = this.getClient();
    for (const userId of this.config.devUserIds) {
      try {
        const user = await client.users.fetch(userId);
        await user.send('L’API Magify est en marche.');
        this.logger.log(`Notification de démarrage envoyée à ${userId}.`);
      } catch (error) {
        this.logger.error(
          `Impossible d’envoyer la notification de démarrage à ${userId}.`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  private normalizeUrlForDisplay(value: string) {
    try {
      return normalizeSiteUrl(value);
    } catch {
      return value;
    }
  }

  private getSharedUrl(content: string) {
    const urls = extractUrls(content);
    return urls[0] || null;
  }

  private getProspectDisplayName(prospect: {
    name?: string | null;
    firstName?: string | null;
    siteName?: string | null;
    owner?: string | null;
  }) {
    const composedName = [prospect.firstName, prospect.name]
      .map((value) => String(value || '').trim())
      .filter((value) => value.length > 0)
      .join(' ')
      .trim();

    return composedName || prospect.name || prospect.firstName || prospect.owner || 'Prospect';
  }

  private buildUrlSummaryEmbed(params: {
    url: string;
    prospect: {
      name?: string | null;
      firstName?: string | null;
      siteName?: string | null;
      status?: string | null;
      owner?: string | null;
    } | null;
    site: {
      siteName: string | null;
      cmsName: string | null;
      shopifyThemeName: string | null;
      shopifyThemeSchemaName: string | null;
      shopifyStatus: string | null;
    };
  }) {
    const normalizedUrl = this.normalizeUrlForDisplay(params.url);
    const embed = new EmbedBuilder()
      .setColor(params.prospect ? 0x2563eb : 0x0f766e)
      .setTitle(params.prospect ? 'Prospect trouvé' : 'URL analysée')
      .setURL(normalizedUrl)
      .setFooter({ text: 'Magify' });

    if (params.prospect) {
      const prospectName = this.getProspectDisplayName(params.prospect);
      const siteName = params.prospect.siteName || params.site.siteName || 'Site non renseigné';
      const status = params.prospect.status || 'Statut inconnu';
      embed.addFields(
        { name: 'URL', value: normalizedUrl, inline: false },
        { name: 'Prospect', value: prospectName, inline: true },
        { name: 'Site', value: siteName, inline: true },
        { name: 'Statut', value: status, inline: true },
      );
      return embed;
    }

    const themeName =
      params.site.shopifyThemeSchemaName ||
      params.site.shopifyThemeName ||
      (params.site.shopifyStatus === 'shopify' ? 'Thème non détecté' : null);
    const siteName = params.site.siteName || 'Site non renseigné';
    const cmsName = params.site.cmsName || 'Non détecté';
    embed.addFields(
      { name: 'URL', value: normalizedUrl, inline: false },
      { name: 'Site', value: siteName, inline: true },
      { name: 'CMS', value: cmsName, inline: true },
    );

    if (params.site.shopifyStatus === 'shopify') {
      embed.addFields({ name: 'Thème Shopify', value: themeName || 'Non détecté', inline: true });
    }

    return embed;
  }

  private async handleSharedUrlMessage(message: Message<boolean>) {
    const sharedUrl = this.getSharedUrl(message.content);
    if (!sharedUrl) {
      return false;
    }

    try {
      const existing = await this.urlsService.findExistingSiteByUrl(sharedUrl);
      let siteId = existing.site?.id ?? null;

      if (!existing.exists) {
        const inserted = await this.urlsService.insertSingleUrl(sharedUrl, 'discord');

        if (inserted.ignored) {
          await message.reply(`Cette URL est ignorée par Magify: ${this.normalizeUrlForDisplay(sharedUrl)}.`);
          return true;
        }

        siteId = inserted.site.id;
        if ('sendTyping' in message.channel) {
          await message.channel.sendTyping().catch(() => undefined);
        }
        if (typeof siteId === 'number') {
          await this.scanningService.rescanSite(siteId, { force: true });
        }
      }

      const refreshedSite = existing.exists
        ? existing.site
        : siteId
          ? await this.urlsService.getSite(siteId).catch(() => null)
          : null;

      if (!refreshedSite) {
        await message.reply(`Je n’ai pas pu retrouver les informations pour ${this.normalizeUrlForDisplay(sharedUrl)}.`);
        return true;
      }

      const prospect = refreshedSite.id
        ? await this.prospectsService.getProspectByUrlId(refreshedSite.id).catch(() => null)
        : null;

      const response = this.buildUrlSummaryEmbed({
        url: sharedUrl,
        prospect,
        site: {
          siteName: refreshedSite.siteName || null,
          cmsName: refreshedSite.cmsName || null,
          shopifyThemeName: refreshedSite.shopifyThemeName || null,
          shopifyThemeSchemaName: refreshedSite.shopifyThemeSchemaName || null,
          shopifyStatus: refreshedSite.shopifyStatus || null,
        },
      });

      await message.reply({ embeds: [response] });
      return true;
    } catch (error) {
      this.logger.error(
        `Impossible de traiter l’URL partagée ${sharedUrl}.`,
        error instanceof Error ? error.stack : undefined,
      );
      await message.reply(`Je n’ai pas pu traiter cette URL: ${this.normalizeUrlForDisplay(sharedUrl)}.`).catch(() => undefined);
      return true;
    }
  }

  async sendMessage(channelId: string, content: string) {
    const client = this.getClient();
    const channel = await client.channels.fetch(channelId);

    if (!channel || !channel.isTextBased() || !('send' in channel)) {
      throw new Error(`Le salon Discord ${channelId} est introuvable ou n’est pas textuel.`);
    }

    return channel.send({ content });
  }

  private async connectInternal() {
    if (!this.config.token) {
      this.status = 'disabled';
      this.logger.warn('Bot Discord désactivé: DISCORD_BOT_TOKEN manquant.');
      return;
    }

    if (this.client) {
      if (this.client.isReady()) {
        this.status = 'ready';
        return;
      }

      return;
    }

    this.status = 'connecting';
    const client = createDiscordClient(this.config);
    this.attachClientEvents(client);
    this.client = client;

    try {
      await client.login(this.config.token);
    } catch (error) {
      this.status = 'error';
      this.client = null;
      client.removeAllListeners();
      try {
        await client.destroy();
      } catch {
        // Best effort cleanup.
      }
      this.logger.error(
        'Impossible de connecter le bot Discord.',
        error instanceof Error ? error.stack : undefined,
      );
      if (error instanceof Error && error.message.toLowerCase().includes('used disallowed intents')) {
        this.logger.warn(
          'Active les intents privilégiés GuildMessages et MessageContent dans le portail Discord de l’application.',
        );
      }
    }
  }

  private attachClientEvents(client: DiscordClient) {
    client.once(Events.ClientReady, (readyClient) => {
      this.status = 'ready';
      this.logger.log(
        `Bot Discord connecté en tant que ${readyClient.user.tag} (${this.config.applicationName}).`,
      );
      void this.sendStartupNotification();
      this.startReminderWatcher();
    });

    client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot) {
        return;
      }

      if (await this.handleSharedUrlMessage(message)) {
        return;
      }

      if (message.content.trim() !== '!ping') {
        return;
      }

      try {
        await message.reply('pong 🏓');
      } catch (error) {
        this.logger.error(
          'Impossible de répondre au message Discord !ping.',
          error instanceof Error ? error.stack : undefined,
        );
      }
    });

    client.on(Events.Warn, (warning) => {
      this.logger.warn(`Discord warn: ${warning}`);
    });

    client.on(Events.Error, (error) => {
      this.status = 'error';
      this.logger.error(
        'Erreur Discord inattendue.',
        error instanceof Error ? error.stack : undefined,
      );
    });

    client.on(Events.ShardDisconnect, (event) => {
      this.status = 'connecting';
      this.logger.warn(`Discord shard déconnecté: ${event.code}.`);
    });
  }
}
