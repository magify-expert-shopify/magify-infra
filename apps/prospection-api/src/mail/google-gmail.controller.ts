// google-gmail.controller.ts
import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { GmailMailService, type GmailOAuthTokens } from './gmail-mail.service';

type GoogleGmailCallbackResponse = {
  message: string;
  access_token?: GmailOAuthTokens['access_token'];
  refresh_token?: GmailOAuthTokens['refresh_token'];
};

@Controller('google')
export class GoogleGmailController {
  constructor(private readonly gmailService: GmailMailService) {}

  @Get('connect')
  connect(@Res() res: Response) {
    const url = this.gmailService.generateAuthUrl();
    return res.redirect(url);
  }

  @Get('callback')
  async callback(@Query('code') code: string): Promise<GoogleGmailCallbackResponse> {
    const tokens = await this.gmailService.exchangeCodeForTokens(code);

    return {
      message: 'Connexion Gmail réussie',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    };
  }
}
