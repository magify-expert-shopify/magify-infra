import { Module } from '@nestjs/common';
import { GmailMailService } from './gmail-mail.service';

@Module({
  providers: [GmailMailService],
  exports: [GmailMailService],
})
export class MailModule {}
