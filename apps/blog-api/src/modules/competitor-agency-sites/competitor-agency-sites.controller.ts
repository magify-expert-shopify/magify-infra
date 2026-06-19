import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CompetitorAgencySitesService } from './competitor-agency-sites.service';
import { BlogsService } from '../blogs/blogs.service';
import { BlogDiscoveryService } from './blog-discovery.service';
import { BatchDiscoverBlogsDto, CreateAgencySiteDto, DiscoverBlogsDto, UpdateAgencySiteDto } from './dto';

@Controller('agency-sites')
export class CompetitorAgencySitesController {
  constructor(
    private readonly competitorAgencySitesService: CompetitorAgencySitesService,
    private readonly blogsService: BlogsService,
    private readonly blogDiscoveryService: BlogDiscoveryService,
  ) {}

  @Get()
  findAll() {
    return this.competitorAgencySitesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.competitorAgencySitesService.findOne(id);
  }

  @Get(':id/blogs')
  findBlogs(@Param('id') id: string) {
    return this.blogsService.findByAgencySite(id);
  }

  @Post()
  async create(@Body() dto: CreateAgencySiteDto) {
    const created = await this.competitorAgencySitesService.create(dto);
    const job = created.shouldEnqueueDiscovery
      ? await this.blogDiscoveryService.enqueueDiscovery(created.site.id)
      : null;

    return {
      site: created.site,
      job,
    };
  }

  @Post('discover-blogs')
  async discoverBlogsBatch(@Body() dto: BatchDiscoverBlogsDto) {
    const ids = dto.ids?.length
      ? dto.ids
      : await this.competitorAgencySitesService.findAllIds();

    if (dto.mode === 'async') {
      const jobs = await this.blogDiscoveryService.enqueueDiscoveryMany(ids);

      return {
        mode: 'async',
        ids,
        jobs,
      };
    }

    const results = await this.blogDiscoveryService.discoverAndPersistMany(ids);

    return {
      mode: 'sync',
      ids,
      results,
    };
  }

  @Post(':id/discover-blogs')
  async discoverBlogs(
    @Param('id') id: string,
    @Body() dto: DiscoverBlogsDto,
  ) {
    if (dto.mode === 'async') {
      const job = await this.blogDiscoveryService.enqueueDiscovery(id);

      return {
        mode: 'async',
        competitorAgencySiteId: id,
        job,
      };
    }

    const result = await this.blogDiscoveryService.discoverAndPersist(id);

    return {
      mode: 'sync',
      competitorAgencySiteId: id,
      ...result,
    };
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAgencySiteDto) {
    return this.competitorAgencySitesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.competitorAgencySitesService.remove(id);
  }
}
