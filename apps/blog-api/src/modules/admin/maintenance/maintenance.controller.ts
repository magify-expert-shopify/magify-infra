import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';

@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get('summary')
  getSummary() {
    return this.maintenanceService.getSummary();
  }

  @Post('purge-trash')
  purgeTrash() {
    return this.maintenanceService.purgeTrashAll();
  }

  @Post('purge/:target')
  purge(@Param('target') target: string) {
    return this.maintenanceService.purge(target);
  }

  @Post('purge-table/:target')
  purgeTable(@Param('target') target: string) {
    return this.maintenanceService.purgeTable(target);
  }

  @Post('unlink-group-relations')
  unlinkGroupRelations() {
    return this.maintenanceService.unlinkKeywordGroupRelations();
  }

  @Post('export')
  exportCsv(@Body() body: { targets?: string[] }) {
    return this.maintenanceService.exportCsv(body.targets ?? []);
  }
}
