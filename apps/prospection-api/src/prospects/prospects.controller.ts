import { BadRequestException, Body, Controller, Delete, Get, MessageEvent, Param, ParseIntPipe, Patch, Post, Query, Sse } from '@nestjs/common';
import { concat, from, map, Observable } from 'rxjs';
import { SendProspectEmailDto } from './dto/send-prospect-email.dto';
import { UpdateProspectStatusDto } from './dto/update-prospect-status.dto';
import { ProspectStatusRecalcEventsService } from './prospect-status-recalc-events.service';
import { ProspectsService, type ProspectStatusRecalcStatus } from './prospects.service';

function parseBooleanQuery(value?: string) {
  return value === 'true' || value === '1'
}

@Controller('prospects')
export class ProspectsController {
  constructor(
    private readonly prospectsService: ProspectsService,
    private readonly prospectStatusRecalcEventsService: ProspectStatusRecalcEventsService,
  ) {}

  @Get()
  listProspects(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('positioning') positioning?: string,
    @Query('hideQueuedEmails') hideQueuedEmails?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('all') all?: string,
    @Query('fields') fields?: string,
  ) {
    return this.prospectsService.listProspects({
      status,
      search,
      positioning,
      hideQueuedEmails: parseBooleanQuery(hideQueuedEmails),
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      all: all === 'true',
      fields: fields ? fields.split(',').map((field) => field.trim()).filter(Boolean) : undefined,
    });
  }

  @Get('count')
  countProspects(@Query('status') status?: string, @Query('search') search?: string, @Query('hideQueuedEmails') hideQueuedEmails?: string) {
    return this.prospectsService.countProspects(status, search, parseBooleanQuery(hideQueuedEmails));
  }

  @Get('counts')
  countProspectsByStatus(@Query('search') search?: string) {
    return this.prospectsService.countProspectsByStatus(search);
  }

  @Get('relaunch')
  listProspectsToRelaunch(@Query('fields') fields?: string) {
    return this.prospectsService.listProspectsToRelaunch(
      fields ? fields.split(',').map((field) => field.trim()).filter(Boolean) : undefined,
    );
  }

  @Get('relaunch/count')
  countProspectsToRelaunch() {
    return this.prospectsService.countProspectsToRelaunch();
  }

  @Get('status/recalculate/status')
  getStatusRecalculateStatus(): Promise<ProspectStatusRecalcStatus> {
    return this.prospectsService.getProspectStatusRecalcStatus();
  }

  @Sse('status/recalculate/events')
  streamStatusRecalculateEvents(): Observable<MessageEvent> {
    const initialEvent = from(this.prospectsService.getProspectStatusRecalcStatus()).pipe(
      map((status) => ({
        type: 'prospect-status-recalc.snapshot',
        data: status,
      })),
    );

    return concat(initialEvent, this.prospectStatusRecalcEventsService.stream());
  }

  @Post('status/recalculate')
  startStatusRecalculate() {
    return this.prospectsService.startProspectStatusRecalculation();
  }

  @Delete('reset')
  resetProspects() {
    return this.prospectsService.resetProspects();
  }

  @Get('trash')
  listTrashedProspects(@Query('fields') fields?: string) {
    return this.prospectsService.listTrashedProspects(
      fields ? fields.split(',').map((field) => field.trim()).filter(Boolean) : undefined,
    );
  }

  @Patch(':id/restore')
  restoreProspect(@Param('id', ParseIntPipe) id: number) {
    return this.prospectsService.restoreProspect(id);
  }

  @Patch(':id/trash')
  trashProspect(@Param('id', ParseIntPipe) id: number) {
    return this.prospectsService.trashProspect(id);
  }

  @Delete(':id/permanent')
  deleteTrashedProspect(@Param('id', ParseIntPipe) id: number) {
    return this.prospectsService.deleteTrashedProspect(id);
  }

  @Delete('trash/reset')
  emptyTrash(@Query('confirm') confirm?: string) {
    if (confirm !== 'true') {
      throw new BadRequestException('Ajoutez ?confirm=true pour vider la corbeille.');
    }

    return this.prospectsService.emptyTrash();
  }

  @Get(':id/email')
  getEmailComposer(@Param('id', ParseIntPipe) id: number) {
    return this.prospectsService.getEmailComposer(id);
  }

  @Get('email-queue')
  listQueuedEmails() {
    return this.prospectsService.listQueuedProspectEmails();
  }

  @Get('email-queue/count')
  countQueuedEmails() {
    return this.prospectsService.countQueuedProspectEmails();
  }

  @Post('email-queue/requeue')
  requeueQueuedEmails() {
    return this.prospectsService.requeueQueuedProspectEmails();
  }

  @Post('email-queue/stop-active')
  stopActiveQueuedEmails() {
    return this.prospectsService.stopActiveQueuedEmails();
  }

  @Post('email-queue/remove-waiting')
  removeWaitingQueuedEmails() {
    return this.prospectsService.removeWaitingQueuedEmails();
  }

  @Patch(':id/email/queue/sent')
  markQueuedEmailAsSent(@Param('id', ParseIntPipe) id: number) {
    return this.prospectsService.markQueuedEmailAsSent(id);
  }

  @Post(':id/email/queue/send-now')
  sendQueuedEmailNow(@Param('id', ParseIntPipe) id: number) {
    return this.prospectsService.sendQueuedEmailNow(id);
  }

  @Post(':id/contact/refresh')
  refreshContactFromProspect(@Param('id', ParseIntPipe) id: number) {
    return this.prospectsService.refreshContactFromProspect(id);
  }

  @Post('relaunch')
  relaunchProspects(@Body('ids') ids?: number[]) {
    if (ids != null && !Array.isArray(ids)) {
      throw new BadRequestException('Le champ ids doit etre un tableau.');
    }

    return this.prospectsService.relaunchProspects(Array.isArray(ids) ? ids : undefined);
  }

  @Post(':id/magify-ticket')
  createMagifyTicket(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    return this.prospectsService.createMagifyOsTicket(id, body || {});
  }

  @Patch(':id/email')
  saveEmailDraft(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    return this.prospectsService.saveEmailDraft(id, body);
  }

  @Patch(':id/contacted')
  markProspectContactedExternally(@Param('id', ParseIntPipe) id: number) {
    return this.prospectsService.markProspectContactedExternally(id);
  }

  @Delete(':id/email/queue')
  removeQueuedEmail(@Param('id', ParseIntPipe) id: number) {
    return this.prospectsService.removeQueuedEmail(id);
  }

  @Post(':id/email/send')
  sendEmail(@Param('id', ParseIntPipe) id: number, @Body() body: SendProspectEmailDto) {
    return this.prospectsService.sendEmail(id, body);
  }

  @Post(':id/relaunch')
  relaunchProspect(@Param('id', ParseIntPipe) id: number) {
    return this.prospectsService.relaunchProspect(id);
  }

  @Get(':id')
  getProspect(@Param('id', ParseIntPipe) id: number) {
    return this.prospectsService.getProspect(id);
  }

  @Patch(':id/process')
  updateProcess(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    return this.prospectsService.updateProcess(id, body);
  }

  @Patch(':id/status')
  setStatus(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateProspectStatusDto) {
    if (!body.status) {
      throw new BadRequestException('Le champ status est requis.');
    }

    return this.prospectsService.setStatus(id, body.status);
  }
}
