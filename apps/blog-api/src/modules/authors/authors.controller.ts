import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AuthorsService } from './authors.service';
import { CreateMagifyAuthorDto } from './dto/create-magify-author.dto';
import { UpdateMagifyAuthorDto } from './dto/update-magify-author.dto';
import { requireProjectId } from '../../common/project-query';

@Controller('authors')
export class AuthorsController {
  constructor(private readonly authorsService: AuthorsService) {}

  @Get()
  findAll() {
    return this.authorsService.findAll();
  }

  @Get('magify')
  findMagifyAuthors(@Query('projectId') projectId?: string) {
    return this.authorsService.findMagifyAuthors(
      requireProjectId(projectId, 'authors'),
    );
  }

  @Post('magify')
  createMagifyAuthor(
    @Body() dto: CreateMagifyAuthorDto,
    @Query('projectId') projectId?: string,
  ) {
    return this.authorsService.createMagifyAuthor(
      requireProjectId(projectId, 'authors'),
      dto,
    );
  }

  @Patch('magify/:id')
  updateMagifyAuthor(
    @Param('id') id: string,
    @Body() dto: UpdateMagifyAuthorDto,
    @Query('projectId') projectId?: string,
  ) {
    return this.authorsService.updateMagifyAuthor(
      requireProjectId(projectId, 'authors'),
      id,
      dto,
    );
  }

  @Delete('magify/:id')
  removeMagifyAuthor(
    @Param('id') id: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.authorsService.removeMagifyAuthor(
      requireProjectId(projectId, 'authors'),
      id,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('projectId') projectId?: string) {
    return this.authorsService.findOne(requireProjectId(projectId, 'authors'), id);
  }

  @Get(':id/articles')
  findArticles(@Param('id') id: string, @Query('projectId') projectId?: string) {
    return this.authorsService.findArticles(
      requireProjectId(projectId, 'authors'),
      id,
    );
  }

  @Get(':id/blogs')
  findBlogs(@Param('id') id: string, @Query('projectId') projectId?: string) {
    return this.authorsService.findBlogs(
      requireProjectId(projectId, 'authors'),
      id,
    );
  }
}
