import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CustomerProblemCategoriesController } from './customer-problem-categories.controller';
import { CustomerProblemCategoriesService } from './customer-problem-categories.service';

@Module({
  imports: [PrismaModule],
  controllers: [CustomerProblemCategoriesController],
  providers: [CustomerProblemCategoriesService],
  exports: [CustomerProblemCategoriesService],
})
export class CustomerProblemCategoriesModule {}
