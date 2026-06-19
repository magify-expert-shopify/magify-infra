import { forwardRef, Module } from '@nestjs/common';
import { UrlsModule } from 'src/urls/urls.module';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

@Module({
  imports: [forwardRef(() => UrlsModule)],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
