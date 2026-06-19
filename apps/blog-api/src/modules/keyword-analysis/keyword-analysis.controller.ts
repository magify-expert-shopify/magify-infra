import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { KeywordAnalysisService } from './keyword-analysis.service';
import { AnalyzeKeywordDto } from './dto/analyze-keyword.dto';
import { AnalyzeKeywordWithAiDto } from './dto/analyze-keyword-with-ai.dto';

@Controller('keyword-analysis')
export class KeywordAnalysisController {
  constructor(private readonly keywordAnalysisService: KeywordAnalysisService) {}

  @Get('suggestions')
  suggest(@Query('q') query?: string, @Query('limit') limit?: string) {
    const parsedLimit =
      typeof limit === 'string' && limit.trim()
        ? Number.parseInt(limit, 10)
        : undefined;

    return this.keywordAnalysisService.suggest(query ?? '', parsedLimit);
  }

  @Get('stored')
  getStoredAnalysis(@Query() query: AnalyzeKeywordDto) {
    const keyword = query.q?.trim();

    if (!keyword) {
      throw new BadRequestException('Query parameter "q" is required');
    }

    return this.keywordAnalysisService.getStoredAnalysis(keyword);
  }

  @Get()
  analyze(@Query() query: AnalyzeKeywordDto, @Query('force') force?: string) {
    const keyword = query.q?.trim();

    if (!keyword) {
      throw new BadRequestException('Query parameter "q" is required');
    }

    return this.keywordAnalysisService.analyze(
      keyword,
      force === 'true' || force === '1',
    );
  }

  @Post('ai-review')
  analyzeWithAi(@Body() body: AnalyzeKeywordWithAiDto) {
    if (!body.keyword?.trim()) {
      throw new BadRequestException('Body field "keyword" is required');
    }

    if (!Array.isArray(body.serpResults) || body.serpResults.length === 0) {
      throw new BadRequestException(
        'Body field "serpResults" must contain at least one result',
      );
    }

    return this.keywordAnalysisService.analyzeWithAi(body);
  }

}
