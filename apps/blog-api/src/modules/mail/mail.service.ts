import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleAuthService } from '../auth/google-auth/google-auth.service';

@Injectable()
export class GmailMailService {
  constructor(private readonly googleAuthService: GoogleAuthService) {}

  async getProfile() {
    const refreshToken = (
      await this.googleAuthService.getStoredOauthRefreshToken()
    ).trim();

    if (!refreshToken) {
      throw new Error('No Google refresh token configured.');
    }

    const oauth2Client = this.googleAuthService.createOAuth2Client();

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const refreshResponse = await oauth2Client.refreshAccessToken();
    const accessToken = refreshResponse.credentials.access_token ?? '';

    if (!accessToken) {
      throw new Error('No Gmail access token could be generated.');
    }

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const gmail = google.gmail({
      version: 'v1',
      auth: oauth2Client,
    });

    const { data } = await gmail.users.getProfile({
      userId: 'me',
    });

    return {
      accessToken,
      email: data.emailAddress ?? null,
      messagesTotal: data.messagesTotal ?? null,
      threadsTotal: data.threadsTotal ?? null,
    };
  }

  async send(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    from?: string;
  }): Promise<unknown> {
    const refreshToken = (
      await this.googleAuthService.getStoredOauthRefreshToken()
    ).trim();

    if (!refreshToken) {
      throw new Error('No Google refresh token configured.');
    }

    const oauth2Client = this.googleAuthService.createOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const refreshResponse = await oauth2Client.refreshAccessToken();
    const accessToken = refreshResponse.credentials.access_token ?? '';

    if (!accessToken) {
      throw new Error('No Gmail access token could be generated.');
    }

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const gmail = google.gmail({
      version: 'v1',
      auth: oauth2Client,
    });

    const encodeMimeHeader = (value: string) => {
      const safeValue = value.replace(/[\r\n]+/g, ' ').trim();
      return `=?UTF-8?B?${Buffer.from(safeValue, 'utf8').toString('base64')}?=`;
    };

    const message = [
      `To: ${params.to}`,
      `Subject: ${encodeMimeHeader(params.subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      '',
      params.html,
    ].join('\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });
  }
}
