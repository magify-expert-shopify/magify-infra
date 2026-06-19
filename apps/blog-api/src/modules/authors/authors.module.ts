import { Module } from '@nestjs/common';
import { AuthorsController } from './authors.controller';
import { AuthorsService } from './authors.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ShopifyModule } from '../shopify/shopify.module';

@Module({
  imports: [PrismaModule, ShopifyModule],
  controllers: [AuthorsController],
  providers: [AuthorsService],
  exports: [AuthorsService],
})
export class AuthorsModule {}
