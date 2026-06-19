import { Module } from '@nestjs/common';
import { LighthouseService } from './lighthouse.service';
import { LighthouseController } from './lighthouse.controller';

@Module({
  providers: [LighthouseService],
  controllers: [LighthouseController],
  exports: [LighthouseService],
})
export class LighthouseModule {}
