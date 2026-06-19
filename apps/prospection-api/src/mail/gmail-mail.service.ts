// google-gmail.service.ts
import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';

export type GmailOAuthTokens = {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
  expiry_date?: number | null;
};

@Injectable()
export class GmailMailService {
  private oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_GMAIL_CLIENT_ID,
    process.env.GOOGLE_GMAIL_CLIENT_SECRET,
    process.env.GOOGLE_GMAIL_REDIRECT_URI,
  );

  generateAuthUrl() {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/gmail.send'],
    });
  }

  getAuthUrl() {
    return this.generateAuthUrl();
  }

  async exchangeCodeForTokens(code: string): Promise<GmailOAuthTokens> {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  async getTokensFromCode(code: string): Promise<GmailOAuthTokens> {
    return this.exchangeCodeForTokens(code);
  }

  async send(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    from?: string;
    signal?: AbortSignal;
  }): Promise<unknown> {
    this.oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_GMAIL_REFRESH_TOKEN,
    });

    const gmail = google.gmail({
      version: 'v1',
      auth: this.oauth2Client,
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
    }, params.signal ? { signal: params.signal } : undefined);
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    from?: string;
    signal?: AbortSignal;
  }): Promise<unknown> {
    return this.send(params);
  }
}
