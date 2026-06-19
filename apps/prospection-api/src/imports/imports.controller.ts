import { BadRequestException, Body, Controller, Delete, Get, MessageEvent, Param, ParseIntPipe, Post, Query, Sse } from '@nestjs/common';
import { concat, from, map, Observable } from 'rxjs';
import { CreateImportDto } from './dto/create-import.dto';
import { ImportEventsService } from './import-events.service';
import { ImportsService } from './imports.service';

@Controller('imports')
export class ImportsController {
  constructor(
    private readonly importsService: ImportsService,
    private readonly importEventsService: ImportEventsService,
  ) {}

  @Get()
  listImports(@Query('status') status?: string) {
    return this.importsService.listImports(status);
  }

  @Get('count')
  countImports(@Query('status') status?: string) {
    return this.importsService.countImports(status);
  }

  @Get('trash')
  listTrashedImports() {
    return this.importsService.listTrashedImports();
  }

  @Sse(':id/events')
  streamImportEvents(@Param('id', ParseIntPipe) id: number): Observable<MessageEvent> {
    const initialEvent = from(this.importsService.getImportRealtimeSnapshot(id)).pipe(
      map((importDetail) => ({
        type: 'import.snapshot',
        data: importDetail,
      })),
    );

    return concat(initialEvent, this.importEventsService.stream(id));
  }

  @Sse('events')
  streamImportsListEvents(): Observable<MessageEvent> {
    const initialEvent = from(this.importsService.listImports()).pipe(
      map((imports) => ({
        type: 'imports.snapshot',
        data: {
          imports,
        },
      })),
    );

    return concat(initialEvent, this.importEventsService.streamAll());
  }

  @Post()
  createImport(@Body() body: CreateImportDto) {
    if (!Array.isArray(body.urls)) {
      throw new BadRequestException('Le champ urls doit etre un tableau.');
    }

    return this.importsService.createImport(body.urls || [], body.sourceFile);
  }

  @Get(':id')
  getImport(@Param('id', ParseIntPipe) id: number, @Query('view') view?: string) {
    return this.importsService.getImport(id, {
      view: view === 'page' ? 'page' : 'full',
    });
  }

  @Get(':id/prospects')
  getImportProspects(@Param('id', ParseIntPipe) id: number) {
    return this.importsService.getImportProspects(id);
  }

  @Get(':id/urls')
  getImportUrls(@Param('id', ParseIntPipe) id: number) {
    return this.importsService.getImportUrls(id);
  }

  @Post(':id/rescan')
  rescanImport(
    @Param('id', ParseIntPipe) id: number,
    @Body('urlIds') urlIds?: number[],
  ) {
    if (!Array.isArray(urlIds)) {
      throw new BadRequestException('Le champ urlIds doit etre un tableau.');
    }

    return this.importsService.rescanImportUrls(id, urlIds);
  }

  @Delete(':id/trash')
  trashImport(@Param('id', ParseIntPipe) id: number) {
    return this.importsService.trashImport(id);
  }

  @Delete(':id/permanent')
  deleteTrashedImport(@Param('id', ParseIntPipe) id: number) {
    return this.importsService.deleteTrashedImport(id);
  }

  @Delete('trash/reset')
  emptyTrash(@Query('confirm') confirm?: string) {
    if (confirm !== 'true') {
      throw new BadRequestException('Ajoutez ?confirm=true pour vider la corbeille.');
    }

    return this.importsService.emptyTrash();
  }

  @Post(':id/steps/shopify')
  runShopifyStep(
    @Param('id', ParseIntPipe) id: number,
    @Query('timeoutMs') timeoutMs?: string,
    @Query('force') force?: string,
    @Query('scope') scope?: string,
  ) {
    return this.importsService.runShopifyStep(id, {
      timeoutMs: timeoutMs ? Number(timeoutMs) : undefined,
      force: force === 'true',
      scope: scope === 'existing' || scope === 'new' || scope === 'all' ? scope : 'new',
    });
  }

  @Post(':id/steps/contact')
  runContactStep(
    @Param('id', ParseIntPipe) id: number,
    @Query('timeoutMs') timeoutMs?: string,
    @Query('force') force?: string,
    @Query('scope') scope?: string,
  ) {
    return this.importsService.runContactStep(id, {
      timeoutMs: timeoutMs ? Number(timeoutMs) : undefined,
      force: force === 'true',
      scope: scope === 'existing' || scope === 'new' || scope === 'all' ? scope : 'new',
    });
  }

  @Post(':id/steps/linkedin')
  runLinkedinStep(
    @Param('id', ParseIntPipe) id: number,
    @Query('timeoutMs') timeoutMs?: string,
    @Query('force') force?: string,
    @Query('scope') scope?: string,
  ) {
    return this.importsService.runLinkedinStep(id, {
      timeoutMs: timeoutMs ? Number(timeoutMs) : undefined,
      force: force === 'true',
      scope: scope === 'existing' || scope === 'new' || scope === 'all' ? scope : 'new',
    });
  }

  @Post(':id/steps/social')
  runSocialStep(
    @Param('id', ParseIntPipe) id: number,
    @Query('force') force?: string,
    @Query('scope') scope?: string,
  ) {
    return this.importsService.runSocialStep(id, {
      force: force === 'true',
      scope: scope === 'existing' || scope === 'new' || scope === 'all' ? scope : 'new',
    });
  }

  @Post(':id/steps/technical')
  runTechnicalStep(
    @Param('id', ParseIntPipe) id: number,
    @Query('timeoutMs') timeoutMs?: string,
    @Query('force') force?: string,
    @Query('scope') scope?: string,
  ) {
    return this.importsService.runTechnicalStep(id, {
      timeoutMs: timeoutMs ? Number(timeoutMs) : undefined,
      force: force === 'true',
      scope: scope === 'existing' || scope === 'new' || scope === 'all' ? scope : 'new',
    });
  }

  @Post(':id/steps/lighthouse')
  runLighthouseStep(
    @Param('id', ParseIntPipe) id: number,
    @Query('timeoutMs') timeoutMs?: string,
    @Query('force') force?: string,
    @Query('scope') scope?: string,
  ) {
    return this.importsService.runLighthouseStep(id, {
      timeoutMs: timeoutMs ? Number(timeoutMs) : undefined,
      force: force === 'true',
      scope: scope === 'existing' || scope === 'new' || scope === 'all' ? scope : 'new',
    });
  }
}
