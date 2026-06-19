import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleAuthService } from '../auth/google-auth/google-auth.service';
import type {
  GoogleBusinessKpis,
  GoogleBusinessKpisInput,
} from './google-business-kpis.types';

@Injectable()
export class GoogleBusinessKpisService {
  constructor(private readonly googleAuthService: GoogleAuthService) {}

  async getBusinessKpis(
    input: GoogleBusinessKpisInput,
  ): Promise<GoogleBusinessKpis> {
    const oauth2Client = this.googleAuthService.createOAuth2Client();

    oauth2Client.setCredentials({
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
    });

    const leadEventName = input.leadEventName || 'generate_lead';
    const formSubmitEventName = input.formSubmitEventName || 'form_submit';
    const articlePathPrefix = input.articlePathPrefix || '/blog';

    const [
      sosDevLeadsGenerated,
      formsSubmitted,
      convertingPages,
      articlesGeneratingRequests,
    ] = await Promise.all([
      this.getEventCount(oauth2Client, input, leadEventName),
      this.getEventCount(oauth2Client, input, formSubmitEventName),
      this.getConvertingPagesCount(oauth2Client, input, leadEventName),
      this.getArticlesGeneratingRequestsCount(
        oauth2Client,
        input,
        leadEventName,
        articlePathPrefix,
      ),
    ]);

    return {
      configured: true,
      sosDevLeadsGenerated,
      formsSubmitted,
      convertingPages,
      articlesGeneratingRequests,
    };
  }

  private getAnalyticsDataClient(
    oauth2Client: InstanceType<typeof google.auth.OAuth2>,
  ) {
    return google.analyticsdata({
      version: 'v1beta',
      auth: oauth2Client,
    });
  }

  private async getEventCount(
    oauth2Client: InstanceType<typeof google.auth.OAuth2>,
    input: GoogleBusinessKpisInput,
    eventName: string,
  ) {
    const analyticsData = this.getAnalyticsDataClient(oauth2Client);

    const response = await analyticsData.properties.runReport({
      property: `properties/${input.ga4PropertyId}`,
      requestBody: {
        dateRanges: [
          {
            startDate: input.startDate,
            endDate: input.endDate,
          },
        ],
        metrics: [{ name: 'eventCount' }],
        dimensions: [
          { name: 'eventName' },
          { name: 'sessionDefaultChannelGroup' },
        ],
        dimensionFilter: {
          andGroup: {
            expressions: [
              {
                filter: {
                  fieldName: 'eventName',
                  stringFilter: {
                    matchType: 'EXACT',
                    value: eventName,
                  },
                },
              },
              {
                filter: {
                  fieldName: 'sessionDefaultChannelGroup',
                  stringFilter: {
                    matchType: 'EXACT',
                    value: 'Organic Search',
                  },
                },
              },
            ],
          },
        },
      },
    });

    return Number(response.data.rows?.[0]?.metricValues?.[0]?.value ?? 0);
  }

  private async getConvertingPagesCount(
    oauth2Client: InstanceType<typeof google.auth.OAuth2>,
    input: GoogleBusinessKpisInput,
    eventName: string,
  ) {
    const analyticsData = this.getAnalyticsDataClient(oauth2Client);

    const response = await analyticsData.properties.runReport({
      property: `properties/${input.ga4PropertyId}`,
      requestBody: {
        dateRanges: [
          {
            startDate: input.startDate,
            endDate: input.endDate,
          },
        ],
        metrics: [{ name: 'eventCount' }],
        dimensions: [
          { name: 'landingPagePlusQueryString' },
          { name: 'eventName' },
          { name: 'sessionDefaultChannelGroup' },
        ],
        dimensionFilter: {
          andGroup: {
            expressions: [
              {
                filter: {
                  fieldName: 'eventName',
                  stringFilter: {
                    matchType: 'EXACT',
                    value: eventName,
                  },
                },
              },
              {
                filter: {
                  fieldName: 'sessionDefaultChannelGroup',
                  stringFilter: {
                    matchType: 'EXACT',
                    value: 'Organic Search',
                  },
                },
              },
            ],
          },
        },
        keepEmptyRows: false,
        limit: '1000',
      },
    });

    const rows = response.data.rows ?? [];

    return (
      rows.filter(
        (row) => (row.dimensionValues?.[0]?.value ?? '').trim().length > 0,
      ).length ?? 0
    );
  }

  private async getArticlesGeneratingRequestsCount(
    oauth2Client: InstanceType<typeof google.auth.OAuth2>,
    input: GoogleBusinessKpisInput,
    eventName: string,
    articlePathPrefix: string,
  ) {
    const analyticsData = this.getAnalyticsDataClient(oauth2Client);

    const response = await analyticsData.properties.runReport({
      property: `properties/${input.ga4PropertyId}`,
      requestBody: {
        dateRanges: [
          {
            startDate: input.startDate,
            endDate: input.endDate,
          },
        ],
        metrics: [{ name: 'eventCount' }],
        dimensions: [
          { name: 'landingPagePlusQueryString' },
          { name: 'eventName' },
          { name: 'sessionDefaultChannelGroup' },
        ],
        dimensionFilter: {
          andGroup: {
            expressions: [
              {
                filter: {
                  fieldName: 'eventName',
                  stringFilter: {
                    matchType: 'EXACT',
                    value: eventName,
                  },
                },
              },
              {
                filter: {
                  fieldName: 'sessionDefaultChannelGroup',
                  stringFilter: {
                    matchType: 'EXACT',
                    value: 'Organic Search',
                  },
                },
              },
              {
                filter: {
                  fieldName: 'landingPagePlusQueryString',
                  stringFilter: {
                    matchType: 'BEGINS_WITH',
                    value: articlePathPrefix,
                  },
                },
              },
            ],
          },
        },
        keepEmptyRows: false,
        limit: '1000',
      },
    });

    const rows = response.data.rows ?? [];

    return (
      rows.filter(
        (row) => (row.dimensionValues?.[0]?.value ?? '').trim().length > 0,
      ).length ?? 0
    );
  }
}
