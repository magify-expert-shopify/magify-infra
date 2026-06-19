import {
  ActivityType,
  Client,
  GatewayIntentBits,
  Partials,
  type PresenceData,
} from 'discord.js';
import type { DiscordBotConfig, DiscordClient } from './discord.types';

export function createDiscordClient(config: DiscordBotConfig): DiscordClient {
  const presence: PresenceData | undefined = config.activityName
    ? {
        activities: [
          {
            name: config.activityName,
            type: ActivityType.Watching,
          },
        ],
        status: 'online',
      }
    : undefined;

  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
    presence,
  }) as DiscordClient;
}
