import type { Client } from 'discord.js';

export type DiscordModuleStatus = 'disabled' | 'connecting' | 'ready' | 'error';

export type DiscordBotConfig = {
  token: string | null;
  applicationName: string;
  activityName: string | null;
  devUserIds: string[];
  sendStartupNotification: boolean;
};

export type DiscordClient = Client<true | false>;

export const DISCORD_BOT_TOKEN_ENV = 'DISCORD_BOT_TOKEN';
export const DISCORD_BOT_ACTIVITY_ENV = 'DISCORD_BOT_ACTIVITY';
export const DISCORD_BOT_APPLICATION_NAME_ENV = 'DISCORD_BOT_APPLICATION_NAME';
export const DISCORD_SEND_STARTUP_NOTIFICATION_ENV = 'DISCORD_SEND_STARTUP_NOTIFICATION';
