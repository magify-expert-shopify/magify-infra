import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { GoogleAuthService, type GoogleOauthTokens } from './google-auth.service';

@Controller('api/google')
export class GoogleAuthController {
  constructor(private readonly googleAuthService: GoogleAuthService) {}

  @Get('auth-url')
  getAuthUrl(@Res() res: Response) {
    return this.renderAuthPage(
      res,
      'Connexion Google',
      'Lancez ici le flow OAuth Google pour autoriser l’application et récupérer les tokens nécessaires.',
      'Continuer avec Google',
      this.googleAuthService.generateAuthUrl(),
    );
  }

  @Get('callback')
  async callback(@Query('code') code: string | undefined, @Res() res: Response) {
    if (!code?.trim()) {
      throw new BadRequestException('Query parameter "code" is required');
    }

    const tokens: GoogleOauthTokens =
      await this.googleAuthService.exchangeCodeForTokens(code);
    await this.googleAuthService.storeOauthTokens(tokens);

    return res.redirect(this.googleAuthService.getOauthRedirectUrl());
  }

  private renderAuthPage(
    res: Response,
    title: string,
    description: string,
    buttonLabel: string,
    url: string,
  ) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    return res.send(`
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background:
          radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 32%),
          linear-gradient(160deg, #f8fafc 0%, #eef2ff 100%);
        color: #0f172a;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }
      .card {
        width: min(100%, 720px);
        border: 1px solid #dbeafe;
        border-radius: 28px;
        background: rgba(255, 255, 255, 0.92);
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12);
        overflow: hidden;
        backdrop-filter: blur(16px);
      }
      .content {
        padding: 32px;
      }
      h1 {
        margin: 0 0 10px;
        font-size: 30px;
        line-height: 1.1;
      }
      p {
        margin: 0;
        color: #475569;
        line-height: 1.7;
      }
      .actions {
        margin-top: 24px;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 14px 18px;
        border-radius: 14px;
        background: #0f172a;
        color: white;
        font-weight: 600;
        text-decoration: none;
        transition: transform 120ms ease, opacity 120ms ease;
      }
      .button:hover {
        opacity: 0.92;
        transform: translateY(-1px);
      }
      .url-box {
        margin-top: 24px;
        padding: 16px;
        border-radius: 18px;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        word-break: break-word;
        color: #334155;
        font-size: 14px;
        line-height: 1.7;
      }
      .label {
        display: block;
        margin-bottom: 8px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #64748b;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="content">
        <h1>${title}</h1>
        <p>${description}</p>

        <div class="actions">
          <a class="button" href="${url}">${buttonLabel}</a>
        </div>

        <div class="url-box">
          <span class="label">URL générée</span>
          ${url}
        </div>
      </div>
    </main>
  </body>
</html>`);
  }
}
