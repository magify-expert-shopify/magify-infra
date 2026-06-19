import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  constructor() {}

  @Get()
  getApiInfo() {
    return {
      name: 'Blog Magify API',
      version: '1.0.0',
      status: 'ok',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('environment')
  getEnvironment() {
    return { ...process.env };
  }

  @Get('api/environment')
  getApiEnvironment() {
    return { ...process.env };
  }
}
