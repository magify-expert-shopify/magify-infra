import { Controller, Post, Query } from '@nestjs/common';
import { UrlsService } from 'src/urls/urls.service';
import { ContactsService } from './contacts.service';

@Controller('contacts')
export class ContactsController {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly urlsService: UrlsService,
  ) {}

  @Post('shopify')
  async findShopifyContacts(@Query('force') force?: string, @Query('timeoutMs') timeoutMs?: string) {
    const rows = await this.urlsService.getPendingContactSites(force === 'true');
    const results = [];

    for (const row of rows) {
      const result = await this.contactsService.findOneContact(
        {
          id: row.id,
          url: row.url,
          siteName: row.siteName,
          siren: row.contactSiren ?? null,
          companyName: row.contactCompanyName ?? null,
          firstName: row.contactFirstName ?? null,
          lastName: row.contactLastName ?? null,
          ownerName: row.contactOwnerName ?? null,
        },
        {
          timeoutMs: timeoutMs ? Number(timeoutMs) : undefined,
          preferLegalNoticeFirst: true,
        },
      );
      await this.urlsService.updateContactResult(row.id, result, { writeMode: 'clear' });
      results.push({
        id: row.id,
        url: row.url,
        siteName: row.siteName,
        ...result,
      });
    }

    return {
      scanned: results.length,
      results,
      counts: results.reduce(
        (accumulator, row) => {
          accumulator[row.status] += 1;
          return accumulator;
        },
        { found: 0, not_found: 0, error: 0 } as Record<string, number>,
      ),
    };
  }
}
