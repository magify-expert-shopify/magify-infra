import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { toAuthorSlug } from '../../common/utils/slug.utils';
import { ShopifyAuthService } from './shopify-auth.service';
import { ShopifyService } from './shopify.service';
import { requireProjectId } from '../../common/project-query';
import { ShopifyGraphqlDto, UpdateShopifyAuthorDto } from './dto';

@Controller('shopify')
export class ShopifyController {
  constructor(
    private readonly shopifyService: ShopifyService,
    private readonly shopifyAuthService: ShopifyAuthService,
  ) {}

  @Get('status')
  getStatus() {
    return this.shopifyAuthService.getStatus();
  }

  @Get('shop')
  getShop(@Query('projectId') projectId?: string) {
    return this.shopifyService.getShop(requireProjectId(projectId, 'shopify'));
  }

  @Get('author')
  getAuthorMetaobjects(@Query('projectId') projectId?: string) {
    return this.shopifyService.getAuthorMetaobjects(
      requireProjectId(projectId, 'shopify'),
    );
  }

  @Get('author/:id')
  getAuthorMetaobject(
    @Param('id') id: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.shopifyService.getAuthorMetaobject(
      requireProjectId(projectId, 'shopify'),
      id,
    );
  }

  private toMetaobjectStringValue(value?: string | null) {
    return value ?? '';
  }

  @Patch('author/:id')
  updateAuthorMetaobject(
    @Param('id') id: string,
    @Body() dto: UpdateShopifyAuthorDto,
    @Query('projectId') projectId?: string,
  ) {
    const displayName = dto.displayName?.trim() || null;
    const slug = dto.slug?.trim() || null;

    return this.shopifyService.updateAuthorMetaobject(
      requireProjectId(projectId, 'shopify'),
      {
        id,
        values: {
          handle:
            (slug ? toAuthorSlug(slug) : null) ||
            (displayName ? toAuthorSlug(displayName) : `author-${Date.now()}`),
          displayName: this.toMetaobjectStringValue(dto.displayName),
          jobTitle: this.toMetaobjectStringValue(dto.jobTitle),
          shopifyAvatarId: this.toMetaobjectStringValue(dto.shopifyAvatarId),
          firstName: this.toMetaobjectStringValue(dto.firstName),
          lastName: this.toMetaobjectStringValue(dto.lastName),
          email: this.toMetaobjectStringValue(dto.email),
          phoneNumber: this.toMetaobjectStringValue(dto.phoneNumber),
          bio: this.toMetaobjectStringValue(dto.bio),
          shopifyPageId: this.toMetaobjectStringValue(dto.shopifyPageId),
          linkedinProfileUrl: this.toMetaobjectStringValue(
            dto.linkedinProfileUrl,
          ),
          slug: this.toMetaobjectStringValue(dto.slug),
        },
      },
    );
  }

  @Get('blogs')
  getBlogs(
    @Query('projectId') projectId?: string,
    @Query('first') first?: string,
    @Query('after') after?: string,
    @Query('last') last?: string,
    @Query('before') before?: string,
  ) {
    const normalizedFirst = this.parseOptionalPositiveInteger(first, 'first');
    const normalizedLast = this.parseOptionalPositiveInteger(last, 'last');

    return this.shopifyService.getBlogs(
      requireProjectId(projectId, 'shopify'),
      {
        ...(normalizedFirst ? { first: normalizedFirst } : {}),
        ...(after !== undefined ? { after } : {}),
        ...(normalizedLast ? { last: normalizedLast } : {}),
        ...(before !== undefined ? { before } : {}),
      },
    );
  }

  @Get('pages')
  getPages(
    @Query('projectId') projectId?: string,
    @Query('first') first?: string,
    @Query('after') after?: string,
    @Query('last') last?: string,
    @Query('before') before?: string,
  ) {
    const normalizedFirst = this.parseOptionalPositiveInteger(first, 'first');
    const normalizedLast = this.parseOptionalPositiveInteger(last, 'last');

    return this.shopifyService.getPages(
      requireProjectId(projectId, 'shopify'),
      {
        ...(normalizedFirst ? { first: normalizedFirst } : {}),
        ...(after !== undefined ? { after } : {}),
        ...(normalizedLast ? { last: normalizedLast } : {}),
        ...(before !== undefined ? { before } : {}),
      },
    );
  }

  @Get('images')
  getImages(@Query('projectId') projectId?: string) {
    return this.shopifyService.getImages(
      requireProjectId(projectId, 'shopify'),
    );
  }

  @Get('blogs/:id/articles')
  getBlogArticles(
    @Param('id') id: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.shopifyService.getBlogArticles(
      requireProjectId(projectId, 'shopify'),
      id,
    );
  }

  @Get('articles')
  getBlogArticlesList(
    @Query('projectId') projectId?: string,
    @Query('first') first?: string,
    @Query('after') after?: string,
    @Query('last') last?: string,
    @Query('before') before?: string,
    @Query('includePublishedAt') includePublishedAt?: string,
    @Query('includeAssociatedBlogArticle')
    includeAssociatedBlogArticle?: string,
  ) {
    const normalizedFirst = this.parseOptionalPositiveInteger(first, 'first');
    const normalizedLast = this.parseOptionalPositiveInteger(last, 'last');
    const normalizedIncludePublishedAt = this.parseOptionalBoolean(
      includePublishedAt,
      'includePublishedAt',
    );
    const normalizedIncludeAssociatedBlogArticle = this.parseOptionalBoolean(
      includeAssociatedBlogArticle,
      'includeAssociatedBlogArticle',
    );

    return this.shopifyService.getBlogArticlesListPage(
      requireProjectId(projectId, 'shopify'),
      {
        ...(normalizedFirst ? { first: normalizedFirst } : {}),
        ...(after !== undefined ? { after } : {}),
        ...(normalizedLast ? { last: normalizedLast } : {}),
        ...(before !== undefined ? { before } : {}),
        ...(normalizedIncludePublishedAt !== undefined
          ? { includePublishedAt: normalizedIncludePublishedAt }
          : {}),
        ...(normalizedIncludeAssociatedBlogArticle !== undefined
          ? {
              includeAssociatedBlogArticle:
                normalizedIncludeAssociatedBlogArticle,
            }
          : {}),
      },
    );
  }

  @Get('articles/:id')
  getArticle(@Param('id') id: string, @Query('projectId') projectId?: string) {
    return this.shopifyService.getArticle(
      requireProjectId(projectId, 'shopify'),
      id,
    );
  }

  @Post('articles/:id/pull')
  pullArticle(@Param('id') id: string, @Query('projectId') projectId?: string) {
    return this.shopifyService.pullArticle(
      requireProjectId(projectId, 'shopify'),
      id,
    );
  }

  @Post('graphql')
  graphql(
    @Body() dto: ShopifyGraphqlDto,
    @Query('projectId') projectId?: string,
  ) {
    return this.shopifyService.graphql(
      requireProjectId(projectId, 'shopify'),
      dto.query,
      dto.variables,
    );
  }

  private parseOptionalPositiveInteger(
    value: string | undefined,
    name: string,
  ) {
    if (value === undefined) {
      return undefined;
    }

    const normalizedValue = Number.parseInt(value, 10);

    if (!Number.isFinite(normalizedValue) || normalizedValue < 1) {
      throw new BadRequestException(
        `Query param "${name}" must be a positive integer`,
      );
    }

    return normalizedValue;
  }

  private parseOptionalBoolean(value: string | undefined, name: string) {
    if (value === undefined) {
      return undefined;
    }

    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    throw new BadRequestException(
      `Query param "${name}" must be "true" or "false"`,
    );
  }
}
