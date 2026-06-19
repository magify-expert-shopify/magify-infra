import { Injectable } from '@nestjs/common';
import { BlogArticlesService } from '../blog-articles/blog-articles.service';
import { BlogsService } from '../blogs/blogs.service';
import { BlogDiscoveryService } from '../competitor-agency-sites/blog-discovery.service';
import { CompetitorAgencySitesService } from '../competitor-agency-sites/competitor-agency-sites.service';
import { AuthorsService } from '../authors/authors.service';
import { SeoClustersService } from '../seo-clusters/seo-clusters.service';
import { isUrl, toBaseUrl } from '../../common/utils/url.util';
import { EMPTY_SEARCH_RESULT } from './constants/search.constants';

@Injectable()
export class SearchService {
  constructor(
    private readonly competitorAgencySitesService: CompetitorAgencySitesService,
    private readonly blogDiscoveryService: BlogDiscoveryService,
    private readonly blogsService: BlogsService,
    private readonly authorsService: AuthorsService,
    private readonly blogArticlesService: BlogArticlesService,
    private readonly seoClustersService: SeoClustersService,
  ) {}

  async search(query: string) {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return { ...EMPTY_SEARCH_RESULT };
    }

    let effectiveQuery = trimmedQuery;
    let createdAgencySite = false;
    let createdAgencySiteJob: Awaited<
      ReturnType<BlogDiscoveryService['enqueueDiscovery']>
    > | null = null;

    if (isUrl(trimmedQuery)) {
      const baseUrl = toBaseUrl(trimmedQuery);
      const existingSite =
        await this.competitorAgencySitesService.findByBaseUrl(baseUrl);

      if (!existingSite) {
        const created = await this.competitorAgencySitesService.create({
          baseUrl,
        });

        createdAgencySite = true;
        createdAgencySiteJob = created.shouldEnqueueDiscovery
          ? await this.blogDiscoveryService.enqueueDiscovery(created.site.id)
          : null;
      }

      effectiveQuery = baseUrl;
    }

    const [competitorAgencySites, blogs, authors, blogArticles, seoClusters] =
      await Promise.all([
        this.competitorAgencySitesService.search(effectiveQuery),
        this.blogsService.search(effectiveQuery),
        this.authorsService.search(effectiveQuery),
        this.blogArticlesService.search(effectiveQuery),
        this.seoClustersService.search(effectiveQuery),
      ]);

    return {
      createdAgencySite,
      createdAgencySiteJob,
      competitorAgencySites,
      blogs,
      authors,
      blogArticles,
      seoClusters,
    };
  }
}
