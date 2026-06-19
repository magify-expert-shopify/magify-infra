import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DiscordBotService {
  constructor(private readonly configService: ConfigService) {}

  getBotToken() {
    return this.configService.get<string>('DISCORD_BOT_TOKEN') ?? '';
  }

  isConfigured() {
    return !!this.getBotToken().trim();
  }

  async getCurrentBotProfile() {
    const token = this.getBotToken().trim();

    if (!token) {
      throw new Error('Discord bot token is missing.');
    }

    const response = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bot ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Discord bot request failed with status ${response.status}`,
      );
    }

    const payload = (await response.json()) as {
      id: string;
      username: string;
      global_name?: string | null;
      avatar?: string | null;
      bot?: boolean;
    };

    return {
      id: payload.id,
      username: payload.username,
      displayName: payload.global_name ?? payload.username,
      avatarUrl: payload.avatar
        ? `https://cdn.discordapp.com/avatars/${payload.id}/${payload.avatar}.png`
        : null,
      isBot: payload.bot ?? true,
    };
  }
}
