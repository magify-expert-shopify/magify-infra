import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GoogleAuthController } from './google-auth.controller';
import { GoogleAuthService } from './google-auth.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [GoogleAuthController],
  providers: [GoogleAuthService],
  exports: [GoogleAuthService],
})
export class GoogleAuthModule {}
