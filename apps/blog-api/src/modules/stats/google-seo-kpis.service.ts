import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleAuthService } from '../auth/google-auth/google-auth.service';
import type {
  GoogleSeoKpis,
  GoogleSeoKpisInput,
} from './google-seo-kpis.types';

@Injectable()
export class GoogleSeoKpisService {
  constructor(private readonly googleAuthService: GoogleAuthService) {}

  async getSeoKpis(input: GoogleSeoKpisInput): Promise<GoogleSeoKpis> {
    const oauth2Client = this.googleAuthService.createOAuth2Client();

    oauth2Client.setCredentials({
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
    });

    const [searchConsoleKpis, organicVisitors, indexedPages] =
      await Promise.all([
        this.getSearchConsolePerformanceKpis(oauth2Client, input),
        this.getOrganicVisitors(oauth2Client, input),
        this.getIndexedPages(oauth2Client, input.siteUrl),
      ]);

    return {
      configured: true,
      range: input.range,
      totalClicks: searchConsoleKpis.totalClicks,
      organicVisitors,
      googleClicks: searchConsoleKpis.totalClicks,
      impressions: searchConsoleKpis.impressions,
      ctr: searchConsoleKpis.ctr,
      averagePosition: searchConsoleKpis.averagePosition,
      articlesAnalyzed: searchConsoleKpis.articlesAnalyzed,
      indexedPages,
    };
  }

  private async getSearchConsolePerformanceKpis(
    oauth2Client: InstanceType<typeof google.auth.OAuth2>,
    input: GoogleSeoKpisInput,
  ) {
    const searchConsole = google.searchconsole({
      version: 'v1',
      auth: oauth2Client,
    });

    const [performanceResponse, articlePagesResponse] = await Promise.all([
      searchConsole.searchanalytics.query({
        siteUrl: input.siteUrl,
        requestBody: {
          startDate: input.startDate,
          endDate: input.endDate,
          dimensions: ['date'],
          rowLimit: 25000,
        },
      }),
      searchConsole.searchanalytics.query({
        siteUrl: input.siteUrl,
        requestBody: {
          startDate: input.startDate,
          endDate: input.endDate,
          dimensions: ['page'],
          rowLimit: 25000,
        },
      }),
    ]);

    const rows = performanceResponse.data.rows ?? [];
    let clicks = 0;
    let impressions = 0;
    let weightedCtr = 0;
    let weightedPosition = 0;

    for (const row of rows) {
      const rowClicks = Number(row.clicks ?? 0);
      const rowImpressions = Number(row.impressions ?? 0);
      const rowCtr = Number(row.ctr ?? 0);
      const rowPosition = Number(row.position ?? 0);

      clicks += rowClicks;
      impressions += rowImpressions;
      weightedCtr += rowCtr * rowImpressions;
      weightedPosition += rowPosition * rowImpressions;
    }

    const articlePathPrefix = input.articlePathPrefix ?? '/blog';
    const articlePages =
      articlePagesResponse.data.rows?.filter((row) =>
        this.isArticlePage(row.keys?.[0] ?? '', articlePathPrefix),
      ) ?? [];

    return {
      totalClicks: clicks,
      impressions,
      ctr: impressions > 0 ? weightedCtr / impressions : 0,
      averagePosition: impressions > 0 ? weightedPosition / impressions : 0,
      articlesAnalyzed: articlePages.length,
    };
  }

  private isArticlePage(pageUrl: string, articlePathPrefix: string) {
    if (!pageUrl) {
      return false;
    }

    try {
      const { pathname } = new URL(pageUrl);

      return pathname.startsWith(articlePathPrefix);
    } catch {
      return pageUrl.includes(articlePathPrefix);
    }
  }

  private async getOrganicVisitors(
    oauth2Client: InstanceType<typeof google.auth.OAuth2>,
    input: GoogleSeoKpisInput,
  ) {
    if (!input.ga4PropertyId) {
      return null;
    }

    const analyticsData = google.analyticsdata({
      version: 'v1beta',
      auth: oauth2Client,
    });

    const response = await analyticsData.properties.runReport({
      property: `properties/${input.ga4PropertyId}`,
      requestBody: {
        dateRanges: [
          {
            startDate: input.startDate,
            endDate: input.endDate,
          },
        ],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        dimensionFilter: {
          filter: {
            fieldName: 'sessionDefaultChannelGroup',
            stringFilter: {
              matchType: 'EXACT',
              value: 'Organic Search',
            },
          },
        },
      },
    });

    const organicRow = response.data.rows?.[0];
    const metricValue = organicRow?.metricValues?.[0]?.value;

    return metricValue ? Number(metricValue) : 0;
  }

  private async getIndexedPages(
    oauth2Client: InstanceType<typeof google.auth.OAuth2>,
    siteUrl: string,
  ) {
    const searchConsole = google.searchconsole({
      version: 'v1',
      auth: oauth2Client,
    });

    const response = await searchConsole.sitemaps.list({
      siteUrl,
    });

    const sitemaps = response.data.sitemap ?? [];
    const indexedPages = sitemaps.reduce((total, sitemap) => {
      const sitemapIndexed = Number(sitemap.contents?.[0]?.indexed ?? 0);

      return total + sitemapIndexed;
    }, 0);

    return indexedPages || null;
  }
}
