import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { ShopifyAuthService } from './shopify-auth.service';
import { ShopifyController } from './shopify.controller';
import { ShopifyService } from './shopify.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [ShopifyController],
  providers: [ShopifyAuthService, ShopifyService],
  exports: [ShopifyAuthService, ShopifyService],
})
export class ShopifyModule {}
