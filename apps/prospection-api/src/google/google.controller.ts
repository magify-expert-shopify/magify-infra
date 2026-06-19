import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { GmailMailService, type GmailOAuthTokens } from 'src/mail/gmail-mail.service';

type GoogleCallbackResponse =
  | {
      message: string;
      authUrl: string;
    }
  | {
      message: string;
      tokens: GmailOAuthTokens;
    };

@Controller('api/google')
export class GoogleController {
  constructor(private readonly gmailMailService: GmailMailService) {}

  @Get('auth-url')
  getAuthUrl(@Res() res: Response) {
    return res.redirect(this.gmailMailService.generateAuthUrl());
  }

  @Get('callback')
  async handleCallback(@Query('code') code?: string): Promise<GoogleCallbackResponse> {
    if (!code) {
      return {
        message:
          'Aucun code OAuth reçu. Lance d’abord /api/google/auth-url, puis reviens ici après l’autorisation Google.',
        authUrl: this.gmailMailService.generateAuthUrl(),
      };
    }

    const tokens = await this.gmailMailService.exchangeCodeForTokens(code || '');

    return {
      message:
        'Autorisation Gmail reçue. Copie le refresh token dans GOOGLE_GMAIL_REFRESH_TOKEN puis redémarre l’API.',
      tokens,
    };
  }
}
