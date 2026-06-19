import { Module } from '@nestjs/common';
import { MailModule } from 'src/mail/mail.module';
import { GoogleController } from './google.controller';

@Module({
  imports: [MailModule],
  controllers: [GoogleController],
})
export class GoogleModule {}
