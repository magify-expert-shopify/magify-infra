import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { SupabaseUser } from '../auth/supabase-auth/supabase-auth.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth/supabase-auth.guard';
import type { SupabaseAuthenticatedUser } from '../auth/supabase-auth/supabase-auth.types';
import { CreateProjectDto, JoinProjectDto } from './dto';

@Controller('projects')
@UseGuards(SupabaseAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list(@SupabaseUser() user: SupabaseAuthenticatedUser | null) {
    return this.projectsService.listForUser(user as SupabaseAuthenticatedUser);
  }

  @Get(':id/members')
  listMembers(
    @SupabaseUser() user: SupabaseAuthenticatedUser | null,
    @Param('id') projectId: string,
  ) {
    return this.projectsService.listMembersForUser(
      user as SupabaseAuthenticatedUser,
      projectId,
    );
  }

  @Post()
  create(
    @SupabaseUser() user: SupabaseAuthenticatedUser | null,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.createForUser(
      user as SupabaseAuthenticatedUser,
      dto,
    );
  }

  @Patch(':id')
  update(
    @SupabaseUser() user: SupabaseAuthenticatedUser | null,
    @Param('id') projectId: string,
    @Body()
    body: {
      name?: string | null;
      description?: string | null;
      shopifyStoreDomain?: string | null;
    },
  ) {
    return this.projectsService.updateForUser(
      user as SupabaseAuthenticatedUser,
      projectId,
      body,
    );
  }

  @Post('join')
  join(
    @SupabaseUser() user: SupabaseAuthenticatedUser | null,
    @Body() dto: JoinProjectDto,
  ) {
    return this.projectsService.joinForUser(
      user as SupabaseAuthenticatedUser,
      dto,
    );
  }

  @Delete(':id')
  remove(
    @SupabaseUser() user: SupabaseAuthenticatedUser | null,
    @Param('id') projectId: string,
  ) {
    return this.projectsService.deleteForUser(
      user as SupabaseAuthenticatedUser,
      projectId,
    );
  }
}
