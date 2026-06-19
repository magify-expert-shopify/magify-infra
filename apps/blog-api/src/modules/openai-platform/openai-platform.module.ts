import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { OpenAiPlatformService } from './openai-platform.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [OpenAiPlatformService],
  exports: [OpenAiPlatformService],
})
export class OpenAiPlatformModule {}
