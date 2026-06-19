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
import { SeoClustersService } from './seo-clusters.service';
import { CreateSeoClusterDto } from './dto/create-seo-cluster.dto';
import { SetClusterPillarArticleDto } from './dto/set-cluster-pillar-article.dto';
import { UpdateSeoClusterDto } from './dto/update-seo-cluster.dto';
import { requireProjectId } from '../../common/project-query';

@Controller('seo-clusters')
export class SeoClustersController {
  constructor(private readonly seoClustersService: SeoClustersService) {}

  @Get()
  findAll(@Query('projectId') projectId?: string) {
    return this.seoClustersService.findAll(
      requireProjectId(projectId, 'seo clusters'),
    );
  }

  @Post()
  create(@Body() dto: CreateSeoClusterDto) {
    return this.seoClustersService.create(dto);
  }

  @Get(':clusterId')
  findOne(
    @Param('clusterId') clusterId: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.seoClustersService.findOne(
      clusterId,
      requireProjectId(projectId, 'seo clusters'),
    );
  }

  @Post('keyword-groups/:keywordGroupId/suggest-cluster')
  suggestClusterForKeywordGroup(
    @Param('keywordGroupId') keywordGroupId: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.seoClustersService.suggestClusterForKeywordGroup(
      keywordGroupId,
      requireProjectId(projectId, 'seo clusters'),
    );
  }

  @Patch(':clusterId')
  update(
    @Param('clusterId') clusterId: string,
    @Body() dto: UpdateSeoClusterDto,
  ) {
    return this.seoClustersService.update(clusterId, dto);
  }

  @Post(':clusterId/pillar/from-article')
  setPillarFromArticle(
    @Param('clusterId') clusterId: string,
    @Body() dto: SetClusterPillarArticleDto,
  ) {
    return this.seoClustersService.setPillarFromArticle(clusterId, dto.articleId);
  }

  @Post(':clusterId/pillar/create-article')
  createPillarArticle(@Param('clusterId') clusterId: string) {
    return this.seoClustersService.createPillarArticle(clusterId);
  }

  @Post(':clusterId/pillar/clear')
  clearPillar(@Param('clusterId') clusterId: string) {
    return this.seoClustersService.clearPillar(clusterId);
  }

  @Delete(':clusterId')
  remove(@Param('clusterId') clusterId: string) {
    return this.seoClustersService.remove(clusterId);
  }
}
