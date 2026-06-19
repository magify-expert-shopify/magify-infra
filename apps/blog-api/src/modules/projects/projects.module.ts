import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SupabaseAuthModule } from '../auth/supabase-auth/supabase-auth.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [PrismaModule, SupabaseAuthModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
