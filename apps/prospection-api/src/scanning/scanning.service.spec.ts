import { Test, TestingModule } from '@nestjs/testing';
import { ContactsService } from 'src/contacts/contacts.service';
import { UrlsService } from 'src/urls/urls.service';
import { ScanningService } from './scanning.service';

describe('ScanningService', () => {
  let service: ScanningService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScanningService,
        {
          provide: UrlsService,
          useValue: {},
        },
        {
          provide: ContactsService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ScanningService>(ScanningService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
