import { Module } from '@nestjs/common';
import { GoogleAuthModule } from '../auth/google-auth/google-auth.module';
import { GmailMailService } from './mail.service';

@Module({
  imports: [GoogleAuthModule],
  providers: [GmailMailService],
  exports: [GmailMailService],
})
export class MailModule {}
