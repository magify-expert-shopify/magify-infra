import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscordBotService } from './discord-bot.service';

@Module({
  imports: [ConfigModule],
  providers: [DiscordBotService],
  exports: [DiscordBotService],
})
export class DiscordBotModule {}
